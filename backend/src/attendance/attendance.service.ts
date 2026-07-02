import { Injectable, Logger } from '@nestjs/common';
import { MarsService } from '../mars/mars.service';
import { MarsGroup } from '../mars/mars.types';
import { InternsService } from '../interns/interns.service';
import {
  AttendanceCell,
  AttendanceDay,
  AttendanceOverview,
  AttendanceStudentRow,
  CellState,
  GroupAttendance,
  GroupIssueSummary,
  GroupListItem,
  MarkResult,
  MentorAttendanceIssues,
  STATUS_TYPE_ACTIVE,
  STATUS_TYPE_FROZEN,
} from './attendance.types';

// ──────────── raw Mars shapes (what GET /attendance/{id} returns) ────────────

interface RawAttendanceRecord {
  id?: number;
  status?: number; // 1 = present, 0 = absent
  attend_date?: string; // YYYY-MM-DD
  process_type?: string;
}

interface RawStudent {
  student_id?: number;
  first_name?: string;
  last_name?: string;
  status_type?: number;
  attendances?: RawAttendanceRecord[];
}

interface RawDay {
  date?: string;
  is_replaced?: boolean;
  comment?: string;
  user?: { first_name?: string; last_name?: string };
}

interface RawAttendance {
  days?: RawDay[];
  students?: RawStudent[];
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  // Lookback window. 14 days reliably covers the last 2–3 lessons of any group
  // (even weekly ones) without paging.
  private readonly WINDOW_DAYS = 14;
  // How many of the most recent lesson days count as "recent" for violet detection.
  private readonly RECENT_DAYS = 2;
  // A recent day is a "violet day" (mentor likely never took attendance) when at
  // least this share of active students are absent or unmarked on it.
  private readonly VIOLET_RATIO = 0.7;

  // Overview is expensive (one Mars call per active group), so cache it.
  private readonly OVERVIEW_TTL_MS = 30 * 60 * 1000;
  private overviewCache: AttendanceOverview | null = null;
  private overviewLoadedAt = 0;
  private overviewInFlight: Promise<AttendanceOverview> | null = null;

  // Max concurrent Mars attendance calls during an overview scan.
  private readonly SCAN_CONCURRENCY = 8;

  /**
   * Normalize a display name for intern–student matching.
   * Collapses internal whitespace and standardises apostrophe variants that
   * are common in Uzbek names (o'zbek, g'ulom, …) so names stored with
   * different Unicode code-points still compare equal.
   */
  private normalizeName(raw: string): string {
    return raw
      .normalize('NFC')
      .toLowerCase()
      .replace(/[''ʼʻ`]/g, "'") // unify apostrophe variants (U+2018, U+2019, U+02BC, U+02BB, backtick → plain apostrophe)
      .replace(/\s+/g, ' ')      // collapse multiple spaces
      .trim();
  }

  constructor(
    private readonly marsService: MarsService,
    private readonly internsService: InternsService,
  ) {}

  // ──────────── window helpers ────────────

  private fmt(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private today(): string {
    return this.fmt(new Date());
  }

  /** Rolling 14-day window ending today — used by the (heavy) overview scan. */
  private window(): { from: string; till: string } {
    const till = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - this.WINDOW_DAYS);
    return { from: this.fmt(from), till: this.fmt(till) };
  }

  /**
   * Whole current calendar month — used for the single-group grid so the view
   * mirrors core, including upcoming (still-empty) scheduled lesson days.
   */
  private monthWindow(): { from: string; till: string } {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const till = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    );
    return { from: this.fmt(from), till: this.fmt(till) };
  }

  /**
   * Whole calendar month for a specific year + month (1-based).
   * Used when the frontend selects a historical or future month via the tab bar.
   */
  private monthWindowFor(year: number, month: number): { from: string; till: string } {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const till = new Date(Date.UTC(year, month, 0)); // day 0 = last day of previous month
    return { from: this.fmt(from), till: this.fmt(till) };
  }

  // ──────────── single group ────────────

  /** Normalized attendance grid for one group (drill-down view). */
  async getGroupAttendance(groupId: number, year?: number, month?: number): Promise<GroupAttendance> {
    const { from, till } = (year != null && month != null)
      ? this.monthWindowFor(year, month)
      : this.monthWindow();

    // Fetch attendance data and group detail in parallel for efficiency.
    // getGroupDetail returns null on error — we degrade gracefully.
    const [raw, detail] = await Promise.all([
      this.marsService
        .getGroupAttendanceRaw(groupId, from, till)
        .then((r) => r as RawAttendance),
      this.marsService.getGroupDetail(groupId),
    ]);

    const grid = this.normalize(raw);

    // Derive curator full name (null when curator field is absent/null).
    const curatorName = detail?.curator
      ? `${detail.curator.first_name} ${detail.curator.last_name}`.trim() ||
        null
      : null;

    // course (single-group endpoint) takes priority over category (list endpoint).
    const courseName =
      detail?.course?.name ?? detail?.category?.name ?? null;

    // Trim to "HH:MM" — the API returns "HH:MM:SS".
    const lessonStartTime = detail?.lesson_start_time
      ? detail.lesson_start_time.slice(0, 5)
      : null;
    const lessonEndTime = detail?.lesson_end_time
      ? detail.lesson_end_time.slice(0, 5)
      : null;

    // Decorate each student row with isIntern flag.
    // Matching is done by normalized name since int-server uses MongoDB _id
    // while Mars uses integer student_id — no shared key exists between the two.
    const internNames = await this.resolveInternNames();
    const students = grid.students.map((s) => ({
      ...s,
      isIntern: internNames.has(this.normalizeName(s.name)),
    }));

    return {
      groupId,
      groupName: detail?.name ?? `#${groupId}`,
      mentorId: detail?.user?.id ?? 0,
      mentorName: detail
        ? `${detail.user.first_name} ${detail.user.last_name}`.trim()
        : '',
      branch: detail?.branch?.title ?? '',
      windowFrom: from,
      windowTill: till,
      roomName: detail?.room?.name ?? null,
      curatorName,
      courseName,
      lessonStartTime,
      lessonEndTime,
      lessonDays: detail?.days ?? null,
      ...grid,
      students,
    };
  }

  /**
   * Collect a lowercase name set of all known interns from the cached int-server
   * summary.  Returns an empty set when int-server is unavailable so the rest of
   * the attendance page degrades gracefully (all isIntern = false).
   */
  private async resolveInternNames(): Promise<Set<string>> {
    try {
      const summary = await this.internsService.getSummary();
      if (!summary.available) return new Set();
      const names = new Set<string>();
      for (const mentor of summary.mentors) {
        for (const intern of mentor.interns) {
          if (intern.name) {
            const normalized = this.normalizeName(intern.name);
            if (normalized) names.add(normalized);
          }
        }
      }
      return names;
    } catch {
      return new Set();
    }
  }

  /**
   * Mark one (student, lesson-day) cell present (status=1) or absent (status=0).
   * Mirrors the Mars attendance UI: a plain POST may not overwrite an existing
   * record, so an existing record on that date is DELETEd first, then re-posted
   * with the requested status. Frozen students (status_type=4) are never touched.
   */
  async markCell(
    groupId: number,
    studentId: number,
    date: string,
    status: 0 | 1,
  ): Promise<MarkResult> {
    const raw = (await this.marsService.getGroupAttendanceRaw(
      groupId,
      date,
      date,
    )) as RawAttendance;

    const student = (raw.students ?? []).find(
      (s) => Number(s.student_id) === studentId,
    );
    if (!student) {
      return {
        ok: false,
        changed: false,
        message: 'Oʻquvchi bu guruhda topilmadi',
      };
    }
    if (student.status_type === STATUS_TYPE_FROZEN) {
      return { ok: false, changed: false, message: 'Muzlatilgan oʻquvchi' };
    }

    const existing = (student?.attendances ?? []).find(
      (a) => (a.attend_date ?? '').slice(0, 10) === date,
    );
    if (existing && existing.status === status) {
      return { ok: true, changed: false };
    }

    if (existing?.id != null) {
      await this.marsService.authedDelete(
        `/api/v1/attendance/${existing.id}`,
      );
    }
    await this.marsService.authedPost('/api/v1/attendance', {
      student_id: studentId,
      group_id: groupId,
      date,
      status,
    });

    // The overview's cached counts are now stale for this group.
    this.invalidateOverview();
    return { ok: true, changed: true };
  }

  private invalidateOverview(): void {
    this.overviewCache = null;
    this.overviewLoadedAt = 0;
  }

  /**
   * Turn a raw Mars attendance payload into a normalized grid + suspect counts.
   * Pure (no I/O) so it can be unit-reasoned and reused by the overview scan.
   */
  private normalize(raw: RawAttendance): {
    days: AttendanceDay[];
    students: AttendanceStudentRow[];
    suspectVioletCount: number;
    unmarkedCount: number;
  } {
    const rawDays = Array.isArray(raw?.days) ? raw.days : [];
    const rawStudents = Array.isArray(raw?.students) ? raw.students : [];

    // Sorted ascending lesson dates within the window.
    const dates = rawDays
      .map((d) => d.date)
      .filter((d): d is string => !!d)
      .sort();

    // "Recent" / violet detection must only look at lesson days that have already
    // happened. The month window can include upcoming scheduled days (empty in
    // core too); those must never be flagged violet just because nobody is marked.
    // Today is excluded too: a lesson scheduled for today may not have started yet
    // (e.g. an evening group at 16:20), so an empty column for today must read as
    // "unmarked" (Belgilanmagan), never violet.
    const todayStr = this.today();
    const pastDates = dates.filter((d) => d < todayStr);
    const recentSet = new Set(pastDates.slice(-this.RECENT_DAYS));

    // Quick lookup: studentId → (date → status).
    const statusByStudentDate = new Map<number, Map<string, number>>();
    const activeStudentIds: number[] = [];
    for (const s of rawStudents) {
      const id = Number(s.student_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const byDate = new Map<string, number>();
      for (const a of s.attendances ?? []) {
        if (a.attend_date && typeof a.status === 'number') {
          byDate.set(String(a.attend_date).slice(0, 10), a.status);
        }
      }
      statusByStudentDate.set(id, byDate);
      if (s.status_type === STATUS_TYPE_ACTIVE) activeStudentIds.push(id);
    }
    const activeCount = activeStudentIds.length;

    // Decide which recent days are "violet days": near-whole-column absent/unmarked.
    const violetDays = new Set<string>();
    for (const date of recentSet) {
      if (activeCount === 0) continue;
      let absentOrUnmarked = 0;
      for (const id of activeStudentIds) {
        const status = statusByStudentDate.get(id)?.get(date);
        if (status === undefined || status === 0) absentOrUnmarked++;
      }
      if (absentOrUnmarked / activeCount >= this.VIOLET_RATIO) {
        violetDays.add(date);
      }
    }

    const days: AttendanceDay[] = rawDays
      .filter((d) => !!d.date)
      .map((d) => ({
        date: d.date!,
        teacher: d.user
          ? `${d.user.first_name ?? ''} ${d.user.last_name ?? ''}`.trim() || null
          : null,
        isReplaced: !!d.is_replaced,
        comment: d.comment ?? '',
        isVioletDay: violetDays.has(d.date!),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const cellState = (
      status: number | undefined,
      date: string,
    ): CellState => {
      if (status === 1) return 'present';
      if (status === 0) return violetDays.has(date) ? 'violet' : 'absent';
      // No record for a known lesson day.
      return violetDays.has(date) ? 'violet' : 'unmarked';
    };

    let suspectVioletCount = 0;
    let unmarkedCount = 0;

    const students: AttendanceStudentRow[] = rawStudents
      .map((s) => {
        const id = Number(s.student_id);
        const frozen = s.status_type === STATUS_TYPE_FROZEN;
        const active = s.status_type === STATUS_TYPE_ACTIVE;
        const byDate = statusByStudentDate.get(id) ?? new Map<string, number>();

        const cells: AttendanceCell[] = days.map((d) => {
          const state = cellState(byDate.get(d.date), d.date);
          // Only active students contribute to the actionable issue counts.
          if (active) {
            if (state === 'violet') suspectVioletCount++;
            else if (state === 'unmarked' && recentSet.has(d.date)) {
              unmarkedCount++;
            }
          }
          return { date: d.date, state };
        });

        return {
          studentId: id,
          name:
            `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `#${id}`,
          statusType: s.status_type ?? 0,
          frozen,
          cells,
        };
      })
      // Active first, then frozen; alphabetical within.
      .sort((a, b) => {
        if (a.frozen !== b.frozen) return a.frozen ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    return { days, students, suspectVioletCount, unmarkedCount };
  }

  // ──────────── overview (all groups) ────────────

  /** Cached overview of every active group's recent attendance issues. */
  async getOverview(force = false): Promise<AttendanceOverview> {
    const now = Date.now();
    if (
      !force &&
      this.overviewCache &&
      now - this.overviewLoadedAt < this.OVERVIEW_TTL_MS
    ) {
      return this.overviewCache;
    }
    // Collapse concurrent scans into one in-flight computation.
    if (this.overviewInFlight) return this.overviewInFlight;

    this.overviewInFlight = this.computeOverview()
      .then((result) => {
        this.overviewCache = result;
        this.overviewLoadedAt = Date.now();
        return result;
      })
      .finally(() => {
        this.overviewInFlight = null;
      });

    return this.overviewInFlight;
  }

  private async computeOverview(): Promise<AttendanceOverview> {
    const { from, till } = this.window();

    let groups: MarsGroup[];
    try {
      groups = await this.marsService.getAllActiveGroups();
    } catch (err) {
      this.logger.error(
        `Overview: could not list active groups: ${(err as Error).message}`,
      );
      return {
        available: false,
        generatedAt: new Date().toISOString(),
        windowFrom: from,
        windowTill: till,
        totalGroupsScanned: 0,
        mentors: [],
        totalMentorsWithIssues: 0,
        totalSuspectViolet: 0,
        totalUnmarked: 0,
      };
    }

    this.logger.log(`Overview: scanning ${groups.length} active groups...`);

    const issuesByGroup = await this.mapWithConcurrency(
      groups,
      this.SCAN_CONCURRENCY,
      (group) => this.scanGroup(group, from, till),
    );

    // Group flagged groups by mentor.
    const byMentor = new Map<number, MentorAttendanceIssues>();
    for (const item of issuesByGroup) {
      if (!item) continue;
      const { group, summary } = item;
      if (summary.suspectVioletCount === 0 && summary.unmarkedCount === 0) {
        continue;
      }
      const mentorId = group.user.id;
      if (!byMentor.has(mentorId)) {
        byMentor.set(mentorId, {
          mentorId,
          mentorName: `${group.user.first_name} ${group.user.last_name}`.trim(),
          branch: group.branch?.title ?? '',
          totalIssues: 0,
          totalSuspectViolet: 0,
          totalUnmarked: 0,
          groups: [],
        });
      }
      const m = byMentor.get(mentorId)!;
      m.groups.push(summary);
      m.totalSuspectViolet += summary.suspectVioletCount;
      m.totalUnmarked += summary.unmarkedCount;
      m.totalIssues += summary.suspectVioletCount + summary.unmarkedCount;
    }

    const mentors = Array.from(byMentor.values())
      .map((m) => {
        m.groups.sort(
          (a, b) =>
            b.suspectVioletCount + b.unmarkedCount -
            (a.suspectVioletCount + a.unmarkedCount),
        );
        return m;
      })
      .sort((a, b) => b.totalIssues - a.totalIssues);

    const totalSuspectViolet = mentors.reduce(
      (acc, m) => acc + m.totalSuspectViolet,
      0,
    );
    const totalUnmarked = mentors.reduce((acc, m) => acc + m.totalUnmarked, 0);

    this.logger.log(
      `Overview: ${mentors.length} mentors with issues ` +
        `(${totalSuspectViolet} violet, ${totalUnmarked} unmarked).`,
    );

    return {
      available: true,
      generatedAt: new Date().toISOString(),
      windowFrom: from,
      windowTill: till,
      totalGroupsScanned: groups.length,
      mentors,
      totalMentorsWithIssues: mentors.length,
      totalSuspectViolet,
      totalUnmarked,
    };
  }

  /** Fetch + classify one group; returns null if its attendance can't be read. */
  private async scanGroup(
    group: MarsGroup,
    from: string,
    till: string,
  ): Promise<{ group: MarsGroup; summary: GroupIssueSummary } | null> {
    try {
      const raw = (await this.marsService.getGroupAttendanceRaw(
        group.id,
        from,
        till,
      )) as RawAttendance;
      const grid = this.normalize(raw);

      const lessonDates = grid.days.map((d) => d.date);
      const lastLessonDate =
        lessonDates.length > 0 ? lessonDates[lessonDates.length - 1] : null;
      const activeStudents = grid.students.filter((s) => !s.frozen).length;

      const summary: GroupIssueSummary = {
        groupId: group.id,
        groupName: group.name,
        branch: group.branch?.title ?? '',
        lastLessonDate,
        suspectVioletCount: grid.suspectVioletCount,
        unmarkedCount: grid.unmarkedCount,
        activeStudents,
      };
      return { group, summary };
    } catch (err) {
      this.logger.warn(
        `Overview: skipping group ${group.id} (${group.name}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Flat list of all active groups with davomat issue counts from the cached overview.
   * Falls back to 0 counts when overview isn't loaded yet.
   */
  async getGroupsList(): Promise<GroupListItem[]> {
    const groups = await this.marsService.getAllActiveGroups();

    // Build issue lookup from cached overview (don't trigger a fresh scan)
    const issueMap = new Map<number, { violet: number; unmarked: number }>();
    if (this.overviewCache) {
      for (const mentor of this.overviewCache.mentors) {
        for (const g of mentor.groups) {
          issueMap.set(g.groupId, {
            violet: g.suspectVioletCount,
            unmarked: g.unmarkedCount,
          });
        }
      }
    }

    return groups.map((g) => {
      const issues = issueMap.get(g.id) ?? { violet: 0, unmarked: 0 };
      return {
        groupId: g.id,
        groupName: g.name,
        mentorId: g.user.id,
        mentorName: `${g.user.first_name} ${g.user.last_name}`.trim(),
        branch: g.branch?.title ?? '',
        category: g.category?.name ?? '',
        lessonStartTime: g.lesson_start_time ?? '',
        studentsCount: g.students_number,
        suspectVioletCount: issues.violet,
        unmarkedCount: issues.unmarked,
      };
    });
  }

  /** Run `fn` over `items` with at most `limit` promises in flight at once. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    };
    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }
}
