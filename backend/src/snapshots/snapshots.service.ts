import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MentorStat } from '../mars/mars.types';
import { MentorSnapshot } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveSnapshots(stats: MentorStat[], date: Date): Promise<void> {
    const dateOnly = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );

    this.logger.log(
      `Saving ${stats.length} mentor snapshots for ${dateOnly.toISOString().slice(0, 10)}`,
    );

    for (const stat of stats) {
      await this.prisma.mentorSnapshot.upsert({
        where: {
          date_mentorId: {
            date: dateOnly,
            mentorId: stat.id,
          },
        },
        create: {
          date: dateOnly,
          mentorId: stat.id,
          mentorName: stat.name,
          branch: stat.branch,
          grade: stat.grade,
          groupCount: stat.groupCount,
          studentCount: stat.studentCount,
          groups: stat.groups as unknown as Prisma.InputJsonValue,
        },
        update: {
          mentorName: stat.name,
          branch: stat.branch,
          grade: stat.grade,
          groupCount: stat.groupCount,
          studentCount: stat.studentCount,
          groups: stat.groups as unknown as Prisma.InputJsonValue,
        },
      });
    }

    this.logger.log('Snapshots saved successfully');
  }

  async getYesterdaySnapshots(): Promise<MentorSnapshot[]> {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayDate = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
      ),
    );

    return this.prisma.mentorSnapshot.findMany({
      where: { date: yesterdayDate },
    });
  }

  async getMentorHistory(mentorId: number): Promise<MentorSnapshot[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const fromDate = new Date(
      Date.UTC(
        thirtyDaysAgo.getUTCFullYear(),
        thirtyDaysAgo.getUTCMonth(),
        thirtyDaysAgo.getUTCDate(),
      ),
    );

    return this.prisma.mentorSnapshot.findMany({
      where: {
        mentorId,
        date: { gte: fromDate },
      },
      orderBy: { date: 'asc' },
    });
  }
}
