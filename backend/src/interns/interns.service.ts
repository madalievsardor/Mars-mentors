import { Injectable, Logger } from '@nestjs/common';
import { IntServerService } from './int-server.service';
import {
  InternsSummary,
  MentorInterns,
  IntIntern,
  InternDetail,
  InternMentorLink,
  IntLessonVisited,
  IntMentor,
} from './interns.types';

@Injectable()
export class InternsService {
  private readonly logger = new Logger(InternsService.name);

  // Short cache — int-server runs on Render free tier and can be slow to wake.
  private cached: InternsSummary | null = null;
  private loadedAt = 0;
  private readonly TTL_MS = 5 * 60 * 1000;

  constructor(private readonly intServer: IntServerService) {}

  invalidateCache(): void {
    this.cached = null;
    this.loadedAt = 0;
  }

  /** Returned when int-server is unreachable (cold start / outage). Empty but
   *  valid so the page degrades gracefully instead of throwing a 500. */
  private emptySummary(): InternsSummary {
    return {
      available: false,
      totalInterns: 0,
      totalMentors: 0,
      mentorsWithInterns: 0,
      mentorsWithoutInterns: 0,
      unassignedInterns: 0,
      gradeDistribution: {},
      statusDistribution: {},
      mentors: [],
    };
  }

  /** Distinct mentors linked to an intern via its branches[].mentor entries. */
  private mentorsOf(intern: IntIntern): { id: string; name: string; branch: string }[] {
    const seen = new Map<string, { id: string; name: string; branch: string }>();
    for (const b of intern.branches ?? []) {
      const m = b.mentor;
      if (!m?._id) continue;
      if (!seen.has(m._id)) {
        seen.set(m._id, {
          id: m._id,
          name: `${m.name ?? ''} ${m.lastName ?? ''}`.trim(),
          branch: b.branch?.name ?? '',
        });
      }
    }
    return Array.from(seen.values());
  }

  /**
   * The creation time of a Mongo ObjectId is encoded in its first 4 bytes
   * (8 hex chars) as a Unix timestamp in seconds. `lessonsVisited` entries
   * carry no explicit date, so we recover each lesson's date from its `_id`.
   */
  private oidToDate(oid: string | undefined): Date | null {
    if (!oid || oid.length < 8) return null;
    const seconds = parseInt(oid.substring(0, 8), 16);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000);
  }

  /** Newest lesson date across an intern's visited lessons. */
  private lastLessonDate(lessons: IntLessonVisited[] | undefined): Date | null {
    let max: Date | null = null;
    for (const l of lessons ?? []) {
      const d = this.oidToDate(l._id);
      if (d && (!max || d > max)) max = d;
    }
    return max;
  }

  private mentorLinksOf(intern: IntIntern): InternMentorLink[] {
    const seen = new Map<string, InternMentorLink>();
    for (const b of intern.branches ?? []) {
      const m = b.mentor;
      if (!m?._id || seen.has(m._id)) continue;
      seen.set(m._id, {
        id: m._id,
        name: `${m.name ?? ''} ${m.lastName ?? ''}`.trim(),
        branch: b.branch?.name ?? '',
        branchTelegram: b.branch?.telegramLink,
        isHeadIntern: Boolean(b.isHeadIntern),
        joinedAt: b.joinedAt,
      });
    }
    return Array.from(seen.values());
  }

  private toDetail(intern: IntIntern): InternDetail {
    const lessons = intern.lessonsVisited ?? [];
    const last = this.lastLessonDate(lessons);
    const status = intern.status ?? 'active';

    let daysSince: number | null = null;
    if (last) {
      const ms = Date.now() - last.getTime();
      daysSince = Math.max(0, Math.floor(ms / 86_400_000));
    }

    return {
      id: intern._id,
      name: `${intern.name ?? ''} ${intern.lastName ?? ''}`.trim(),
      username: intern.username,
      phoneNumber: intern.phoneNumber,
      telegram: intern.telegram,
      grade: intern.grade ?? 'unknown',
      sphere: intern.sphere ?? '',
      status,
      isActive: status === 'active',
      level: intern.level,
      xp: intern.xp,
      score: intern.score,
      currentStreak: intern.currentStreak,
      longestStreak: intern.longestStreak,
      dateJoined: intern.dateJoined,
      probationStartDate: intern.probationStartDate,
      probationPeriod: intern.probationPeriod,
      lessonsPerMonth: intern.lessonsPerMonth,

      lastLessonDate: last ? last.toISOString() : null,
      daysSinceLastLesson: daysSince,
      totalLessonsAttended: lessons.length,
      confirmedLessonsThisMonth: intern.confirmedLessonsThisMonth,
      confirmedLessonsCount: intern.confirmedLessonsCount,
      pendingLessonsCount: intern.pendingLessonsCount,

      requiredLessonsByNow: intern.requiredLessonsByNow,
      deficit: intern.deficit,
      isPlanBlocked: intern.isPlanBlocked,
      reason: intern.reason,
      weeklyTarget: intern.weeklyTarget,
      completedWeeksInMonth: intern.completedWeeksInMonth,
      elapsedWorkingDays: intern.elapsedWorkingDays,
      totalWorkingDaysInWindow: intern.totalWorkingDaysInWindow,

      badgeCount: Array.isArray(intern.badges) ? intern.badges.length : 0,
      bonusLessonCount: Array.isArray(intern.bonusLessons)
        ? intern.bonusLessons.length
        : 0,
      mentors: this.mentorLinksOf(intern),
    };
  }

  /**
   * Full profile for one intern. Prefers the cached `/interns` list (richer flat
   * fields like plan + lessonsVisited); falls back to `/interns/:id` if absent.
   */
  async getInternDetail(id: string): Promise<InternDetail | null> {
    const interns = await this.intServer.getInterns();
    let intern = interns.find((i) => i._id === id);
    if (!intern) {
      intern = (await this.intServer.getInternById(id)) ?? undefined;
    }
    if (!intern) return null;
    return this.toDetail(intern);
  }

  async getSummary(): Promise<InternsSummary> {
    const now = Date.now();
    if (this.cached && now - this.loadedAt < this.TTL_MS) {
      this.logger.log(
        `Returning cached intern summary (${Math.round((now - this.loadedAt) / 1000)}s old)`,
      );
      return this.cached;
    }

    let interns: IntIntern[];
    let mentors: IntMentor[];
    try {
      [interns, mentors] = await Promise.all([
        this.intServer.getInterns(),
        this.intServer.getMentors(),
      ]);
    } catch (err: unknown) {
      // int-server unreachable (cold start / outage). Return an empty summary
      // (HTTP 200) so the page never 500s, and do NOT cache it — the next
      // request retries once Render has woken the service back up.
      this.logger.error(
        `int-server unavailable — returning empty summary: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return this.emptySummary();
    }

    const mentorMap = new Map<string, MentorInterns>();
    const gradeDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};
    let unassignedInterns = 0;

    for (const intern of interns) {
      const grade = intern.grade ?? 'unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;

      const status = intern.status ?? 'unknown';
      statusDistribution[status] = (statusDistribution[status] ?? 0) + 1;

      const linked = this.mentorsOf(intern);
      if (linked.length === 0) {
        unassignedInterns += 1;
        continue;
      }

      for (const m of linked) {
        let entry = mentorMap.get(m.id);
        if (!entry) {
          entry = {
            mentorId: m.id,
            mentorName: m.name,
            branches: [],
            internCount: 0,
            gradeBreakdown: {},
            statusBreakdown: {},
            interns: [],
          };
          mentorMap.set(m.id, entry);
        }
        entry.internCount += 1;
        entry.gradeBreakdown[grade] = (entry.gradeBreakdown[grade] ?? 0) + 1;
        entry.statusBreakdown[status] = (entry.statusBreakdown[status] ?? 0) + 1;
        if (m.branch && !entry.branches.includes(m.branch)) {
          entry.branches.push(m.branch);
        }
        entry.interns.push({
          id: intern._id,
          name: `${intern.name ?? ''} ${intern.lastName ?? ''}`.trim(),
          grade,
          sphere: intern.sphere ?? '',
          branch: m.branch,
          status,
        });
      }
    }

    const withInternsCount = mentorMap.size;

    // Add every known mentor (from the full /mentors roster) that has no intern
    // linked, so the page can optionally surface zero-intern mentors too.
    for (const m of mentors) {
      if (!m._id || mentorMap.has(m._id)) continue;
      mentorMap.set(m._id, {
        mentorId: m._id,
        mentorName: `${m.name ?? ''} ${m.lastName ?? ''}`.trim(),
        branches: (m.branches ?? [])
          .map((b) => b?.name ?? '')
          .filter((n) => n.length > 0),
        internCount: 0,
        gradeBreakdown: {},
        statusBreakdown: {},
        interns: [],
      });
    }

    // Mentors with interns first (by intern count desc), zero-intern mentors last.
    const allMentors = Array.from(mentorMap.values()).sort(
      (a, b) => b.internCount - a.internCount,
    );

    const summary: InternsSummary = {
      available: true,
      totalInterns: interns.length,
      totalMentors: mentors.length,
      mentorsWithInterns: withInternsCount,
      mentorsWithoutInterns: allMentors.filter((m) => m.internCount === 0)
        .length,
      unassignedInterns,
      gradeDistribution,
      statusDistribution,
      mentors: allMentors,
    };

    this.cached = summary;
    this.loadedAt = Date.now();
    this.logger.log(
      `Intern summary: ${summary.totalInterns} interns across ${summary.mentorsWithInterns} mentors`,
    );
    return summary;
  }
}
