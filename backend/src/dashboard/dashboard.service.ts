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
