import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MarsService } from '../mars/mars.service';
import {
  MarsTutorsStatsResponse,
  MarsTutorStat,
  MarsCompany,
  MarsV2User,
  MarsUserSlotDay,
  MarsSlot,
  MarsSlotTemplate,
  TutorBrief,
  TutorCandidate,
  TutorCandidatesResponse,
  TutorsResponse,
  TutorSlotsResponse,
  TutorWriteResult,
  ScheduleDay,
  ScheduleSlot,
  ScheduleRange,
  Weekday,
  Branch,
  BranchesResponse,
  CreateTutorAccountResult,
  TutorScheduleType,
  BookingEntry,
  TutorBookingStats,
} from './tutors.types';
import { CreateTutorAccountDto } from './dto/create-tutor-account.dto';

/** Mars department id used for teaching staff (tutors are teachers). */
const TEACHER_DEPARTMENT = 5;

/** Du..Ya order for the weekly grid. */
const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

@Injectable()
export class TutorsService {
  private readonly logger = new Logger(TutorsService.name);

  // Short cache — Mars can be slow and the data changes rarely.
  private cachedTutors: TutorsResponse | null = null;
  private tutorsLoadedAt = 0;
  private readonly slotsCache = new Map<
    number,
    { data: TutorSlotsResponse; at: number }
  >();
  private readonly TTL_MS = 5 * 60 * 1000;

  constructor(private readonly mars: MarsService) {}

  invalidateCache(): void {
    this.cachedTutors = null;
    this.tutorsLoadedAt = 0;
    this.slotsCache.clear();
  }

  /** Returned when Mars is unreachable — empty but valid (graceful degrade). */
  private emptyTutors(): TutorsResponse {
    return { available: false, total: 0, branches: [], tutors: [] };
  }

  private emptySlots(tutorId: number): TutorSlotsResponse {
    return {
      available: false,
      tutorId,
      days: WEEKDAYS.map((weekday) => ({
        weekday,
        date: null,
        slots: [],
        ranges: [],
      })),
      totalSlots: 0,
      workingDays: 0,
      totalHours: 0,
    };
  }

  /**
   * Map a stats row into the dashboard brief.
   *
   * The filial (branch) is taken from `active` — the tutor's CURRENTLY ACTIVE
   * branch read from GET /api/v2/users/teachers-and-tutors (profile.branches[]
   * with is_active=true). The tutor-stats payload also carries `branch`/
   * `branch_id`, but that field is NOT refreshed when a tutor is moved between
   * filials (PUT company/activate only flips profile.branches), so it goes stale.
   * We therefore prefer the active-branch override and fall back to the stats
   * value only when the staff list has no entry for this tutor.
   */
  private toBrief(
    t: MarsTutorStat,
    active?: { branchId: number | null; branch: string },
  ): TutorBrief {
    const name =
      `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() ||
      (t.username ?? '').trim() ||
      `#${t.id}`;
    const branchId =
      active && active.branchId != null
        ? active.branchId
        : typeof t.branch_id === 'number'
          ? t.branch_id
          : null;
    const branch =
      active && active.branch ? active.branch : (t.branch ?? '');
    return {
      id: t.id,
      name,
      username: t.username ?? '',
      branch,
      branchId,
      avgRating: typeof t.avg_rating === 'number' ? t.avg_rating : null,
      totalRatings: t.total_ratings ?? 0,
      interestingPercent:
        typeof t.interesting_percent === 'number'
          ? t.interesting_percent
          : null,
      understandablePercent:
        typeof t.understandable_percent === 'number'
          ? t.understandable_percent
          : null,
    };
  }

  /** All tutors (paged) with branch list. Caches for 5 min; never throws. */
  async getTutors(): Promise<TutorsResponse> {
    const now = Date.now();
    if (this.cachedTutors && now - this.tutorsLoadedAt < this.TTL_MS) {
      this.logger.log(
        `Returning cached tutors (${Math.round((now - this.tutorsLoadedAt) / 1000)}s old)`,
      );
      return this.cachedTutors;
    }

    try {
      const pageSize = 100;
      let page = 1;
      const all: MarsTutorStat[] = [];
      // Page until we have everything (total_count) or a page comes back empty.
      // Cap pages defensively so a misbehaving API can't loop forever.
      for (let guard = 0; guard < 20; guard++) {
        const resp = await this.mars.authedGet<MarsTutorsStatsResponse>(
          '/api/v2/controls/tutors/stats/get',
          { page, page_size: pageSize },
        );
        const list = Array.isArray(resp?.tutors) ? resp.tutors : [];
        all.push(...list);
        const total = resp?.total_count ?? all.length;
        if (list.length === 0 || all.length >= total) break;
        page++;
      }

      // Resolve each tutor's LIVE filial from the staff list (profile.branches
      // is_active), since the stats payload's branch field goes stale on moves.
      // One extra request covers everyone. If it fails, fall back to stats.
      let activeBranchById = new Map<
        number,
        { branchId: number | null; branch: string }
      >();
      try {
        const staff = await this.fetchStaffList();
        activeBranchById = this.buildActiveBranchMap(staff);
      } catch (e) {
        this.logger.warn(
          `Active-branch map unavailable, using stats branch: ${(e as Error).message}`,
        );
      }

      const tutors = all.map((t) =>
        this.toBrief(t, activeBranchById.get(t.id)),
      );
      tutors.sort((a, b) => a.name.localeCompare(b.name));
      const branches = Array.from(
        new Set(tutors.map((t) => t.branch).filter((b) => b.length > 0)),
      ).sort();

      const result: TutorsResponse = {
        available: true,
        total: tutors.length,
        branches,
        tutors,
      };
      this.cachedTutors = result;
      this.tutorsLoadedAt = Date.now();
      this.logger.log(`Tutors cached: ${tutors.length}`);
      return result;
    } catch (err) {
      this.logger.error(
        `Mars unavailable — empty tutors: ${(err as Error).message}`,
      );
      return this.emptyTutors();
    }
  }

  /** Trim "HH:MM:SS" -> "HH:MM" (leave anything unexpected untouched). */
  private hm(s: string | undefined): string {
    if (!s) return '';
    return s.length >= 5 ? s.slice(0, 5) : s;
  }

  private toScheduleSlot(s: MarsSlot): ScheduleSlot {
    return {
      id: s.id,
      fromHour: this.hm(s.from_hour),
      tillHour: this.hm(s.till_hour),
      range: s.time_range ?? `${this.hm(s.from_hour)}-${this.hm(s.till_hour)}`,
    };
  }

  /**
   * Merge a day's half-hour slots into compact working intervals.
   *
   * The slots come sorted by start time. Adjacent slots (the previous slot's
   * `tillHour` equals the next slot's `fromHour`) fold into one range; a gap
   * (lunch break) starts a new range. So 09:00–13:00 + 14:00–19:00 stays two
   * ranges, while a solid 09:00..19:00 block collapses to a single 09:00–19:00.
   */
  private mergeRanges(slots: ScheduleSlot[]): ScheduleRange[] {
    const ranges: ScheduleRange[] = [];
    for (const s of slots) {
      const from = s.fromHour;
      const to = s.tillHour;
      if (!from || !to) continue;
      const last = ranges[ranges.length - 1];
      if (last && last.to === from) {
        last.to = to; // contiguous — extend the open range
      } else {
        ranges.push({ from, to });
      }
    }
    return ranges;
  }

  /**
   * Weekly schedule for one tutor, normalized to a fixed Du..Ya grid.
   *
   * The Mars payload is a list of day objects; each carries `date` plus exactly
   * one weekday key (monday..sunday) holding that day's booked slots. We fold it
   * into a 7-entry grid (one per weekday) so the frontend can render a stable
   * table even when some weekdays are absent. Caches per tutor; never throws.
   */
  async getTutorSlots(tutorId: number): Promise<TutorSlotsResponse> {
    const now = Date.now();
    const hit = this.slotsCache.get(tutorId);
    if (hit && now - hit.at < this.TTL_MS) {
      return hit.data;
    }

    try {
      const raw = await this.mars.authedGet<MarsUserSlotDay[]>(
        '/api/v1/users/user_slots',
        { user_id: tutorId },
      );
      const list = Array.isArray(raw) ? raw : [];

      // Aggregate slots per weekday (dedupe by slot id) and remember a date.
      const byDay = new Map<
        Weekday,
        { date: string | null; slots: Map<number, ScheduleSlot> }
      >();
      for (const wd of WEEKDAYS) {
        byDay.set(wd, { date: null, slots: new Map() });
      }

      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const date = typeof entry.date === 'string' ? entry.date : null;
        for (const wd of WEEKDAYS) {
          const slots = entry[wd];
          if (!Array.isArray(slots)) continue;
          const bucket = byDay.get(wd)!;
          if (date && !bucket.date) bucket.date = date;
          for (const s of slots) {
            if (!s || typeof s.id !== 'number') continue;
            if (!bucket.slots.has(s.id)) {
              bucket.slots.set(s.id, this.toScheduleSlot(s));
            }
          }
        }
      }

      let totalSlots = 0;
      let workingDays = 0;
      const days: ScheduleDay[] = WEEKDAYS.map((weekday) => {
        const bucket = byDay.get(weekday)!;
        const slots = Array.from(bucket.slots.values()).sort((a, b) =>
          a.fromHour.localeCompare(b.fromHour),
        );
        totalSlots += slots.length;
        const ranges = this.mergeRanges(slots);
        if (ranges.length > 0) workingDays += 1;
        return { weekday, date: bucket.date, slots, ranges };
      });

      const result: TutorSlotsResponse = {
        available: true,
        tutorId,
        days,
        totalSlots,
        workingDays,
        // Each booked slot is a half hour.
        totalHours: Math.round(totalSlots * 0.5 * 10) / 10,
      };
      this.slotsCache.set(tutorId, { data: result, at: Date.now() });
      return result;
    } catch (err) {
      this.logger.warn(
        `Could not fetch slots for tutor ${tutorId}: ${(err as Error).message}`,
      );
      return this.emptySlots(tutorId);
    }
  }

  // ──────────── write (edit) operations ────────────

  /** "HH:MM" / "HH:MM:SS" -> minutes since midnight (or null if unparsable). */
  private toMinutes(hhmm: string): number | null {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 24 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  /**
   * Replace ONE weekday's working interval for a tutor.
   *
   * Picks every 30-minute template from GET /users/slots_list that falls inside
   * the requested [fromHour, tillHour) window, then POSTs them as that day's
   * slots. Mars treats POST /users/user_slots as a per-day REPLACE, so an empty
   * window (from === till) clears the day. The `day` field must be a STRING
   * weekday name (monday..sunday). Idempotent: re-posting the same window leaves
   * Mars unchanged.
   */
  async updateTutorSlots(
    tutorId: number,
    day: Weekday,
    fromHour: string,
    tillHour: string,
  ): Promise<TutorWriteResult> {
    const fromM = this.toMinutes(fromHour);
    const tillM = this.toMinutes(tillHour);
    if (fromM == null || tillM == null || tillM < fromM) {
      return { ok: false, message: 'Vaqt oraligʻi notoʻgʻri' };
    }

    // Fetch the 30-min slot templates and select those inside the window.
    const templates = await this.mars.authedGet<MarsSlotTemplate[]>(
      '/api/v1/users/slots_list',
    );
    const list = Array.isArray(templates) ? templates : [];

    const chosen = list
      .map((tpl) => {
        const s = this.toMinutes(this.hm(tpl.from_hour));
        const e = this.toMinutes(this.hm(tpl.till_hour));
        return s != null && e != null
          ? { id: tpl.id, s, e, from: this.hm(tpl.from_hour), to: this.hm(tpl.till_hour) }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      // Slot fully contained in the requested window.
      .filter((x) => x.s >= fromM && x.e <= tillM)
      .sort((a, b) => a.s - b.s);

    const slots = chosen.map((x) => ({
      id: x.id,
      day, // STRING weekday name (monday..sunday) — required by Mars
      from_hour: x.from,
      till_hour: x.to,
    }));

    await this.mars.authedPost('/api/v1/users/user_slots', {
      user_id: tutorId,
      slots,
    });

    // Drop the per-tutor slots cache so the next GET reflects the change.
    this.slotsCache.delete(tutorId);
    return {
      ok: true,
      message: `${slots.length} ta slot saqlandi`,
    };
  }

  /**
   * Look up a single Mars user (full record) by id.
   *
   * Mars has no GET /users/{id} endpoint (it 404s), so we read the staff list
   * GET /api/v2/users/teachers-and-tutors — which returns full user objects
   * (first/last name, phone, and the branch under profile.branches[]) — and find
   * the tutor by id. Returns null if not present.
   */
  private async findV2User(userId: number): Promise<MarsV2User | null> {
    const list = await this.fetchStaffList();
    return list.find((u) => Number(u.id) === userId) ?? null;
  }

  /**
   * The full staff list (teachers + tutors) from GET
   * /api/v2/users/teachers-and-tutors. One request returns every user with their
   * `profile.branches[]` (carrying `is_active` + nested `branch.title`), so we use
   * it both to look up a single user and to resolve every tutor's live filial.
   */
  private async fetchStaffList(): Promise<MarsV2User[]> {
    const resp = await this.mars.authedGet<unknown>(
      '/api/v2/users/teachers-and-tutors',
    );
    const list: unknown[] = Array.isArray(resp)
      ? resp
      : ((resp as Record<string, unknown>)?.users as unknown[]) ??
        ((resp as Record<string, unknown>)?.data as unknown[]) ??
        ((resp as Record<string, unknown>)?.results as unknown[]) ??
        [];
    return list.filter(
      (u): u is MarsV2User =>
        !!u && typeof u === 'object' && typeof (u as MarsV2User).id === 'number',
    );
  }

  /**
   * Resolve every staff member's CURRENTLY ACTIVE filial, keyed by user id.
   *
   * Mars keeps one `profile.branches[]` row per branch the user was ever in and
   * flips `is_active`; the live filial is the active row (falling back to the
   * first row if none is flagged). Each row also nests `branch.title`, so we get
   * both the id and the display name from this single payload — no per-tutor
   * request and no dependency on the (stale) tutor-stats branch field.
   */
  private buildActiveBranchMap(
    list: MarsV2User[],
  ): Map<number, { branchId: number | null; branch: string }> {
    const map = new Map<number, { branchId: number | null; branch: string }>();
    for (const u of list) {
      const branches = u.profile?.branches ?? [];
      const active = branches.find((b) => b.is_active) ?? branches[0];
      if (!active) continue;
      const branchId =
        typeof active.branch_id === 'number' ? active.branch_id : null;
      const branch =
        typeof active.branch?.title === 'string' ? active.branch.title : '';
      map.set(Number(u.id), { branchId, branch });
    }
    return map;
  }

  /**
   * Branch id currently assigned to a user. Mars keeps one row per branch the
   * user was ever in and flips `is_active`; the live branch is the active one
   * (fall back to the first row if none is flagged active).
   */
  private currentBranchId(user: MarsV2User | null): number | null {
    const branches = user?.profile?.branches ?? [];
    const active = branches.find((b) => b.is_active);
    const id = (active ?? branches[0])?.branch_id;
    return typeof id === 'number' ? id : null;
  }

  /** The profile id (NOT the user id) — required by company/activate. */
  private profileId(user: MarsV2User | null): number | null {
    const id = user?.profile?.id;
    return typeof id === 'number' ? id : null;
  }

  /**
   * Update a tutor's profile — first/last name and/or branch (filial).
   *
   * NAME — PUT /api/v2/users/update-extended (keyed on `user_id`, NOT `id`)
   * reliably updates `first_name` / `last_name`. GET /api/v1/users/{id} does not
   * exist, so we read the current record from the staff list and resend the
   * current name when the caller didn't change it, keeping the call idempotent.
   *
   * BRANCH — PUT /api/v2/users/company/activate moves an existing tutor between
   * filials. It is keyed on the PROFILE id (`profile.id`, NOT the user id) and
   * takes the FULL desired branch set as `company_ids` (REPLACE semantics: it
   * flags those branches active and the rest inactive). A tutor sits in exactly
   * one filial, so we send `company_ids: [branchId]`. Verified live against
   * testTutor (user 1692, profile_id 683): the active branch flips as requested.
   *
   * Both parts run independently when both are supplied. If the branch part fails
   * (e.g. profile id missing) we surface that honestly rather than faking success.
   */
  async updateTutorProfile(
    tutorId: number,
    fields: { firstName?: string; lastName?: string; branchId?: number },
  ): Promise<TutorWriteResult> {
    const current = await this.findV2User(tutorId);

    // Detect a real branch change (a supplied branch that differs from current).
    const currentBranch = this.currentBranchId(current);
    const branchChangeRequested =
      fields.branchId !== undefined && fields.branchId !== currentBranch;

    // ── name (update-extended) ──
    const nameChangeRequested =
      fields.firstName !== undefined || fields.lastName !== undefined;
    if (nameChangeRequested) {
      const body: Record<string, unknown> = { user_id: tutorId };
      // Prefer the supplied value, else keep the current one (idempotent).
      const firstName = fields.firstName ?? current?.first_name;
      const lastName = fields.lastName ?? current?.last_name;
      if (firstName !== undefined) body.first_name = firstName;
      if (lastName !== undefined) body.last_name = lastName;
      await this.mars.authedPut('/api/v2/users/update-extended', body);
    }

    // ── branch (company/activate) ──
    if (branchChangeRequested) {
      const profileId = this.profileId(current);
      if (profileId == null) {
        this.invalidateCache();
        return {
          ok: false,
          message:
            'Tutorning profil ID si topilmadi — filialni oʻzgartirib boʻlmadi.',
        };
      }
      await this.mars.authedPut('/api/v2/users/company/activate', {
        profile_id: profileId,
        company_ids: [fields.branchId],
      });
    }

    this.invalidateCache();
    return { ok: true, message: 'Tutor maʼlumotlari yangilandi' };
  }

  /** Back-compat thin wrapper around {@link updateTutorProfile}. */
  async updateTutorName(
    tutorId: number,
    firstName: string,
    lastName: string,
  ): Promise<TutorWriteResult> {
    return this.updateTutorProfile(tutorId, { firstName, lastName });
  }

  /**
   * Drop a user from the tutor role (is_tutor=false) so they become a plain
   * mentor again: PATCH /api/v1/users/tutors/{user_id}?status=0.
   */
  async removeTutor(tutorId: number): Promise<TutorWriteResult> {
    await this.mars.authedPatch(
      `/api/v1/users/tutors/${tutorId}`,
      {},
      { status: 0 },
    );
    this.invalidateCache();
    return { ok: true, message: 'Tutorlikdan chiqarildi' };
  }

  /**
   * Permanently DELETE a user from Mars — DELETE /api/v2/users/{user_id}.
   *
   * ⚠️ DESTRUCTIVE and irreversible: this does NOT demote the tutor to a mentor
   * (that's {@link removeTutor}); it removes the underlying Mars account
   * entirely. The caller (controller + frontend) gates this behind a strong
   * "type the tutor's name" confirmation.
   */
  async deleteTutor(tutorId: number): Promise<TutorWriteResult> {
    await this.mars.authedDelete(`/api/v2/users/${tutorId}`);
    this.invalidateCache();
    return { ok: true, message: 'Foydalanuvchi Marsʼdan butunlay oʻchirildi' };
  }

  /**
   * Promote a user TO the tutor role (is_tutor=true): the inverse of
   * {@link removeTutor} — PATCH /api/v1/users/tutors/{user_id}?status=1.
   */
  async addTutor(userId: number): Promise<TutorWriteResult> {
    await this.mars.authedPatch(
      `/api/v1/users/tutors/${userId}`,
      {},
      { status: 1 },
    );
    this.invalidateCache();
    return { ok: true, message: 'Tutor qoʻshildi' };
  }

  /**
   * Candidates that can be promoted to tutor: active mentors who are NOT already
   * tutors. We reuse the dashboard's mentor list (MarsService.computeMentorStats)
   * and subtract the current tutor ids. Never throws — returns an empty,
   * unavailable response if Mars is unreachable.
   */
  async getCandidates(): Promise<TutorCandidatesResponse> {
    try {
      const [tutors, mentors] = await Promise.all([
        this.getTutors(),
        this.mars.computeMentorStats(),
      ]);
      if (!tutors.available) {
        return { available: false, total: 0, candidates: [] };
      }

      const tutorIds = new Set(tutors.tutors.map((t) => t.id));
      const candidates: TutorCandidate[] = mentors
        .filter((m) => !tutorIds.has(m.id))
        .map((m) => ({
          id: m.id,
          name: m.name || `#${m.id}`,
          branch: m.branch ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { available: true, total: candidates.length, candidates };
    } catch (err) {
      this.logger.error(
        `Mars unavailable — empty candidates: ${(err as Error).message}`,
      );
      return { available: false, total: 0, candidates: [] };
    }
  }

  /**
   * Branches (filials) available for assigning a new tutor.
   *
   * GET /api/v1/company returns the canonical [{id, title}] filial list (the `id`
   * is the same branch_id used everywhere else), so we use it directly. This is
   * the source of truth for filial names and matches the active-branch ids resolved
   * for the tutor list, keeping names consistent. Never throws.
   */
  async getBranches(): Promise<BranchesResponse> {
    try {
      const resp = await this.mars.authedGet<MarsCompany[]>('/api/v1/company');
      const list = Array.isArray(resp) ? resp : [];
      const branches: Branch[] = list
        .filter((c) => typeof c.id === 'number' && !!c.title)
        .map((c) => ({ id: c.id, title: c.title }))
        .sort((a, b) => a.title.localeCompare(b.title));
      return { available: branches.length > 0, branches };
    } catch (err) {
      this.logger.error(
        `Mars unavailable — empty branches: ${(err as Error).message}`,
      );
      return { available: false, branches: [] };
    }
  }

  /**
   * Pull a human-readable reason out of a failed Mars call so the dashboard can
   * show *why* a create/promote failed instead of a generic "couldn't create".
   * Logs the full status + body for the server operator, returns a short message
   * for the UI.
   */
  private marsErrorMessage(stage: string, err: unknown): string {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      const body =
        typeof data === 'string' ? data : JSON.stringify(data ?? {});
      this.logger.error(
        `Tutor create — ${stage} failed (HTTP ${status ?? 'no-response'}): ${body.slice(0, 400)}`,
      );
      // Surface Mars's own message when it sends one.
      const marsMsg =
        (data as Record<string, unknown> | undefined)?.['message'] ??
        (data as Record<string, unknown> | undefined)?.['detail'];
      if (typeof marsMsg === 'string' && marsMsg.trim()) {
        return `Mars: ${marsMsg}`;
      }
      if (status === 401 || status === 403) {
        return 'Mars sessiyasi yaroqsiz — admin tokenni yangilang.';
      }
      if (status === 409 || status === 400) {
        // Most commonly a duplicate phone.
        return 'Bu telefon raqam allaqachon roʻyxatdan oʻtgan boʻlishi mumkin.';
      }
      return `Mars xatosi (HTTP ${status ?? '—'})`;
    }
    this.logger.error(`Tutor create — ${stage} failed: ${(err as Error).message}`);
    return 'Akkaunt yaratib boʻlmadi';
  }

  /**
   * Create a brand-new Mars account for a new hire and promote it to tutor.
   *
   * Two steps:
   *  1. POST /api/v2/users/create — Mars requires first_name, last_name, phone,
   *     branch_id, department (int) and schedule ('full-time' | 'part-time'). We
   *     also send is_tutor/is_teacher/grade up front (matching the verified Mars
   *     payload) so the account is correctly typed even if step 2 is skipped.
   *     Password is optional and forwarded only when provided.
   *  2. PATCH /api/v1/users/tutors/{id}?status=1 (via {@link addTutor}) to flip
   *     the new user into the tutor role — a safety net that also (re)confirms the
   *     tutor flag in Mars's own tutor table.
   *
   * The schedule (weekly slots) is set afterwards by the client through the
   * existing {@link updateTutorSlots} flow, so it's not part of creation.
   *
   * Failures at either step are caught and reported with Mars's actual reason
   * (logged in full server-side) instead of bubbling up as a generic 500.
   */

  /** Booking stats for one tutor from Mars API (`/api/v2/controls/booking/all`). Never throws. */
  async getTutorBookingStats(tutorId: number): Promise<TutorBookingStats> {
    const empty: TutorBookingStats = { tutorId, total: 0, byStatus: {}, recent: [] };
    try {
      const pageSize = 100;
      let page = 1;
      const all: BookingEntry[] = [];

      for (let guard = 0; guard < 20; guard++) {
        const rows = await this.mars.authedGet<unknown[]>(
          '/api/v2/controls/booking/all',
          { page, per_page: pageSize } as Record<string, number>,
        );
        if (!Array.isArray(rows) || rows.length === 0) break;

        for (const r of rows) {
          const row = r as Record<string, unknown>;
          if (Number(row['user_id']) !== tutorId) continue;
          const student = (row['student'] as Record<string, string> | null) ?? {};
          const name = `${student['first_name'] ?? ''} ${student['last_name'] ?? ''}`.trim() || `#${row['student_id']}`;
          all.push({
            id: Number(row['id']),
            studentName: name,
            topic: String(row['topic'] ?? ''),
            dateTime: String(row['dateTime'] ?? ''),
            status: String(row['status'] ?? ''),
          });
        }

        if (rows.length < pageSize) break;
        page++;
      }

      all.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
      const byStatus: Record<string, number> = {};
      for (const e of all) {
        byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      }

      return { tutorId, total: all.length, byStatus, recent: all.slice(0, 20) };
    } catch (err) {
      this.logger.warn(`getTutorBookingStats(${tutorId}): ${(err as Error).message}`);
      return empty;
    }
  }

  async createTutorAccount(
    dto: CreateTutorAccountDto,
  ): Promise<CreateTutorAccountResult> {
    const phone = dto.phone.startsWith('+') ? dto.phone : `+${dto.phone}`;
    const schedule: TutorScheduleType = dto.schedule ?? 'full-time';
    const department = dto.department ?? TEACHER_DEPARTMENT;

    const body: Record<string, unknown> = {
      first_name: dto.firstName.trim(),
      last_name: dto.lastName.trim(),
      phone,
      branch_id: dto.branchId,
      department,
      schedule,
      // Type the account as a tutor from the start (verified Mars payload).
      is_tutor: true,
      is_teacher: false,
      grade: 'junior',
    };
    if (dto.password) body.password = dto.password;

    // ── step 1: create the Mars account ──
    let created: Record<string, unknown>;
    try {
      created = await this.mars.authedPost<Record<string, unknown>>(
        '/api/v2/users/create',
        body,
      );
    } catch (err) {
      return { ok: false, message: this.marsErrorMessage('create', err) };
    }

    // The new user id may surface under a few keys depending on Mars's response.
    const idVal =
      (created?.['id'] as number | undefined) ??
      ((created?.['user'] as Record<string, unknown> | undefined)?.['id'] as
        | number
        | undefined);
    const userId = Number(idVal);
    if (!Number.isFinite(userId) || userId <= 0) {
      this.logger.error(
        `create returned no usable id: ${JSON.stringify(created).slice(0, 300)}`,
      );
      return {
        ok: false,
        message: 'Akkaunt yaratildi, lekin ID aniqlanmadi',
      };
    }

    // ── step 2: confirm the tutor role (safety net) ──
    try {
      await this.addTutor(userId);
    } catch (err) {
      // The account exists; only the explicit role flip failed. Report honestly
      // but still hand back the id so the operator can recover from the UI.
      const message = this.marsErrorMessage('promote', err);
      this.invalidateCache();
      return {
        ok: false,
        message: `Akkaunt yaratildi (ID ${userId}), lekin tutor rolini berishda xato — ${message}`,
        userId,
        name: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
        branchId: dto.branchId,
      };
    }

    this.invalidateCache();

    return {
      ok: true,
      message: 'Yangi tutor akkaunti yaratildi',
      userId,
      name: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
      branchId: dto.branchId,
    };
  }
}
