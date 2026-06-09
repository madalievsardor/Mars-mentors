import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarsService } from '../mars/mars.service';
import {
  SnapshotsService,
  MentorLeftStudents,
} from '../snapshots/snapshots.service';
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
  private readonly logger = new Logger(MentorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marsService: MarsService,
    private readonly snapshotsService: SnapshotsService,
  ) {}

  async getAllMentors(): Promise<MentorResponse[]> {
    // Mars data is the source of truth and must succeed. The snapshot (trend) data
    // comes from the local DB and is best-effort — if the DB is down we still return
    // the mentor list, just without trend info, instead of failing the whole request.
    const stats = await this.marsService.computeMentorStats();

    let yesterdaySnapshots: MentorSnapshot[] = [];
    try {
      yesterdaySnapshots = await this.snapshotsService.getYesterdaySnapshots();
    } catch (err) {
      this.logger.warn(
        `Could not load yesterday snapshots (${(err as Error).message}) — continuing without trend data`,
      );
    }

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

  /** All mentors that have students who left between the two latest rosters. */
  async getLeftStudents(): Promise<MentorLeftStudents[]> {
    return this.snapshotsService.getLeftStudents();
  }

  /** Left-students for a single mentor (null if none / not enough data yet). */
  async getMentorLeftStudents(
    mentorId: number,
  ): Promise<MentorLeftStudents | null> {
    const result = await this.snapshotsService.getLeftStudents(mentorId);
    return result[0] ?? null;
  }
}
