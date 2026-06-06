import { Injectable } from '@nestjs/common';
import { MarsService } from '../mars/mars.service';
import { MentorStat } from '../mars/mars.types';

export interface BranchOverview {
  branch: string;
  mentorCount: number;
  groupCount: number;
  totalStudents: number;
  ratio: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly marsService: MarsService) {}

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
