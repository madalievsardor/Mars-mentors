import { Injectable, Logger } from '@nestjs/common';
import { MarsService } from '../mars/mars.service';
import { MentorStat } from '../mars/mars.types';
import { PrismaService } from '../prisma/prisma.service';

export interface BranchOverview {
  branch: string;
  mentorCount: number;
  groupCount: number;
  totalStudents: number;
  ratio: number;
}

/** One point on the timeline: a date plus one numeric value per branch. */
export interface TimelinePoint {
  date: string; // "MM-DD"
  [branch: string]: string | number;
}

export interface TimelineResponse {
  available: boolean;
  branches: string[];
  points: TimelinePoint[];
}

/**
 * One month of per-branch dynamics. Carries the total plus one numeric value
 * per branch (keyed by branch title) so recharts can draw a line per branch.
 */
export interface MonthlyPoint {
  month: string; // "2026-01"
  label: string; // "Yan"
  total: number; // sum across all branches
  [branch: string]: string | number; // per-branch active-student count
}

export interface MonthlyResponse {
  available: boolean;
  /** Branch titles present in the series (one line each). */
  branches: string[];
  /** Total-base growth %, last month vs the previous month (null if N/A). */
  growthPct: number | null;
  months: MonthlyPoint[];
}

interface TimelineRow {
  date: Date;
  branch: string;
  total: number | bigint;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly marsService: MarsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Per-branch student-count timeline over the last 60 days, built from
   * mentor_snapshots. Returns { available:false } when the DB has no data
   * (or is unreachable) so the frontend can hide the chart gracefully.
   */
  async getTimeline(): Promise<TimelineResponse> {
    try {
      const rows = await this.prisma.$queryRaw<TimelineRow[]>`
        SELECT date, branch, SUM("studentCount")::int AS total
        FROM mentor_snapshots
        WHERE date >= CURRENT_DATE - INTERVAL '60 days'
        GROUP BY date, branch
        ORDER BY date ASC
      `;

      if (!rows || rows.length === 0) {
        return { available: false, branches: [], points: [] };
      }

      const branchSet = new Set<string>();
      const byDate = new Map<string, TimelinePoint>();

      for (const row of rows) {
        const d = new Date(row.date);
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const key = `${mm}-${dd}`;
        branchSet.add(row.branch);

        if (!byDate.has(key)) {
          byDate.set(key, { date: key });
        }
        byDate.get(key)![row.branch] = Number(row.total);
      }

      const branches = Array.from(branchSet).sort((a, b) =>
        a.localeCompare(b),
      );
      const points = Array.from(byDate.values());

      return { available: true, branches, points };
    } catch (err) {
      this.logger.warn(
        `Timeline query failed (${(err as Error).message}) — returning unavailable`,
      );
      return { available: false, branches: [], points: [] };
    }
  }

  // Short month labels (Jan..Dec) — language-neutral 3-letter forms that read
  // fine in uz/ru/en; the frontend i18n can localize further if needed.
  private static readonly MONTH_LABELS = [
    'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
    'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
  ];

  /**
   * PER-BRANCH MONTHLY dynamics for the current year: how many students were
   * active each month, broken down by branch (one line per branch), plus the
   * total-base month-over-month growth.
   *
   * Data source: GET /groups (the only academy-wide aggregation the dashboard's
   * Mars service account can read — `/statistics`, `/reports/*` and `/payments/*`
   * are all 403/404/500 for this role). Each active group carries a `branch`,
   * a `date_started`/`date_finished` window and a current `students_number`. A
   * group counts toward a (month, branch) cell when that month overlaps its
   * window, so each branch's line reflects how its active-student base has
   * grown across the year.
   *
   * NOTE / honesty: this uses each group's *current* enrollment projected over
   * the months it was running — it approximates historical headcount and does
   * not subtract students who left mid-course.
   *
   * Returns { available:false } when Mars is unreachable.
   */
  async getMonthly(): Promise<MonthlyResponse> {
    try {
      const groups = await this.marsService.getAllActiveGroups();
      if (!groups || groups.length === 0) {
        return { available: false, branches: [], growthPct: null, months: [] };
      }

      const branchSet = new Set<string>();
      for (const g of groups) {
        branchSet.add(g.branch?.title ?? 'Unknown');
      }
      const branches = Array.from(branchSet).sort((a, b) =>
        a.localeCompare(b),
      );

      const now = new Date();
      const year = now.getUTCFullYear();
      const lastMonth = now.getUTCMonth(); // 0-based; include months up to current

      const months: MonthlyPoint[] = [];
      let prevTotal: number | null = null;
      let growthPct: number | null = null;

      for (let mo = 0; mo <= lastMonth; mo++) {
        const start = new Date(Date.UTC(year, mo, 1, 0, 0, 0));
        const end = new Date(Date.UTC(year, mo + 1, 0, 23, 59, 59));

        const perBranch: Record<string, number> = {};
        for (const b of branches) perBranch[b] = 0;

        let total = 0;
        for (const g of groups) {
          const ds = g.date_started ? new Date(g.date_started) : null;
          const df = g.date_finished ? new Date(g.date_finished) : null;
          // Group active in this month iff its window overlaps [start, end].
          if (ds && ds > end) continue;
          if (df && df < start) continue;
          const n = g.students_number ?? 0;
          const branch = g.branch?.title ?? 'Unknown';
          perBranch[branch] += n;
          total += n;
        }

        const point: MonthlyPoint = {
          month: `${year}-${String(mo + 1).padStart(2, '0')}`,
          label: DashboardService.MONTH_LABELS[mo],
          total,
          ...perBranch,
        };
        months.push(point);

        if (prevTotal != null && prevTotal > 0) {
          growthPct = parseFloat(
            (((total - prevTotal) / prevTotal) * 100).toFixed(1),
          );
        }
        prevTotal = total;
      }

      return { available: true, branches, growthPct, months };
    } catch (err) {
      this.logger.warn(
        `Monthly dynamics failed (${(err as Error).message}) — returning unavailable`,
      );
      return { available: false, branches: [], growthPct: null, months: [] };
    }
  }

  async getBranchOverview(): Promise<BranchOverview[]> {
    const stats: MentorStat[] = await this.marsService.computeMentorStats();

    const branchMap = new Map<string, BranchOverview>();

    for (const stat of stats) {
      const branch = stat.branch;

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch,
          mentorCount: 0,
          groupCount: 0,
          totalStudents: 0,
          ratio: 0,
        });
      }

      const overview = branchMap.get(branch)!;
      overview.mentorCount += 1;
      overview.groupCount += stat.groupCount;
      overview.totalStudents += stat.studentCount;
    }

    // Calculate ratio: students / groups (avoid divide by zero)
    for (const overview of branchMap.values()) {
      overview.ratio =
        overview.groupCount > 0
          ? parseFloat(
              (overview.totalStudents / overview.groupCount).toFixed(2),
            )
          : 0;
    }

    return Array.from(branchMap.values()).sort((a, b) =>
      a.branch.localeCompare(b.branch),
    );
  }
}
