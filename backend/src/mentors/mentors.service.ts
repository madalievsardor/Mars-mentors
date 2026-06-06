import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarsService } from '../mars/mars.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { MentorStat, SimpleMentorGroup } from '../mars/mars.types';
import { MentorSnapshot } from '@prisma/client';

export interface MentorResponse {
  id: number;
  name: string;
  branch: string;
  grade: string;
  groupCount: number;
  studentCount: number;
  groups: SimpleMentorGroup[];
  trend: 'up' | 'down' | 'stable' | null;
  prevStudentCount: number | null;
}

export interface MentorHistoryResponse {
  mentorId: number;
  history: MentorSnapshot[];
}

@Injectable()
export class MentorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marsService: MarsService,
    private readonly snapshotsService: SnapshotsService,
  ) {}

  async getAllMentors(): Promise<MentorResponse[]> {
    const [stats, yesterdaySnapshots] = await Promise.all([
      this.marsService.computeMentorStats(),
      this.snapshotsService.getYesterdaySnapshots(),
    ]);

    const yesterdayMap = new Map<number, MentorSnapshot>(
      yesterdaySnapshots.map((s) => [s.mentorId, s]),
    );

    return stats.map((stat: MentorStat) => {
      const yesterday = yesterdayMap.get(stat.id);
      let trend: 'up' | 'down' | 'stable' | null = null;
      let prevStudentCount: number | null = null;

      if (yesterday) {
        prevStudentCount = yesterday.studentCount;
        if (stat.studentCount > yesterday.studentCount) trend = 'up';
        else if (stat.studentCount < yesterday.studentCount) trend = 'down';
        else trend = 'stable';
      }

      return {
        id: stat.id,
        name: stat.name,
        branch: stat.branch,
        grade: stat.grade,
        groupCount: stat.groupCount,
        studentCount: stat.studentCount,
        groups: stat.groups,
        trend,
        prevStudentCount,
      };
    });
  }

  async getMentorHistory(mentorId: number): Promise<MentorHistoryResponse> {
    const history = await this.snapshotsService.getMentorHistory(mentorId);
    return { mentorId, history };
  }
}
