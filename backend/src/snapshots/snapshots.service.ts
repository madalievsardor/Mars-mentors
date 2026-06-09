import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarsService } from '../mars/mars.service';
import { MarsGroup, MentorStat, RosterStudent } from '../mars/mars.types';
import { GroupRosterSnapshot, MentorSnapshot } from '@prisma/client';
import { Prisma } from '@prisma/client';

/** A student that was present in an earlier roster but is gone from the latest one. */
export interface LeftStudent {
  studentId: number;
  name: string;
  groupName: string;
  lastSeenDate: string; // YYYY-MM-DD
}

/** Mentor-grouped list of students that left between the two latest rosters. */
export interface MentorLeftStudents {
  mentorId: number;
  mentorName: string;
  leftStudents: LeftStudent[];
}

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marsService: MarsService,
  ) {}

  async saveSnapshots(stats: MentorStat[], date: Date): Promise<void> {
    const dateOnly = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );

    this.logger.log(
      `Saving ${stats.length} mentor snapshots for ${dateOnly.toISOString().slice(0, 10)}`,
    );

    try {
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
    } catch (err) {
      // DB best-effort (see PrismaService.onModuleInit): don't crash the caller if
      // the DB is unreachable — snapshots just won't be persisted this run.
      this.logger.warn(
        `Could not save snapshots (${(err as Error).message}) — continuing without DB`,
      );
    }
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

    try {
      return await this.prisma.mentorSnapshot.findMany({
        where: { date: yesterdayDate },
      });
    } catch (err) {
      // DB best-effort: if the DB is unreachable, return no history so callers
      // (e.g. /mentors) still work — just without trend data.
      this.logger.warn(
        `Could not read yesterday snapshots (${(err as Error).message}) — returning empty`,
      );
      return [];
    }
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

    try {
      return await this.prisma.mentorSnapshot.findMany({
        where: {
          mentorId,
          date: { gte: fromDate },
        },
        orderBy: { date: 'asc' },
      });
    } catch (err) {
      // DB best-effort: if the DB is unreachable, return empty history instead of 500.
      this.logger.warn(
        `Could not read mentor history (${(err as Error).message}) — returning empty`,
      );
      return [];
    }
  }

  // ──────────── group rosters (who-left tracking) ────────────

  /**
   * For every active group, fetch its current student roster from Mars and upsert
   * one GroupRosterSnapshot row per group for `date`. This is the heavy step
   * (one Mars API call per group, ~252 groups) so it must only run inside the
   * scheduled/manual sync — never on a per-request path.
   *
   * DB best-effort: a missing/unreachable DB only warns, the sync keeps going.
   */
  async saveRosters(groups: MarsGroup[], date: Date): Promise<void> {
    const dateOnly = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );

    this.logger.log(
      `Saving rosters for ${groups.length} groups (${dateOnly
        .toISOString()
        .slice(0, 10)})`,
    );

    let saved = 0;
    for (const group of groups) {
      const students = await this.marsService.getGroupRoster(group.id);
      // Skip groups we couldn't read — don't overwrite a prior good roster with [].
      if (students.length === 0) continue;

      const mentorName =
        `${group.user.first_name} ${group.user.last_name}`.trim();
      try {
        await this.prisma.groupRosterSnapshot.upsert({
          where: { date_groupId: { date: dateOnly, groupId: group.id } },
          create: {
            date: dateOnly,
            groupId: group.id,
            groupName: group.name,
            mentorId: group.user.id,
            mentorName,
            branch: group.branch?.title ?? 'Unknown',
            students: students as unknown as Prisma.InputJsonValue,
          },
          update: {
            groupName: group.name,
            mentorId: group.user.id,
            mentorName,
            branch: group.branch?.title ?? 'Unknown',
            students: students as unknown as Prisma.InputJsonValue,
          },
        });
        saved++;
      } catch (err) {
        // DB best-effort — warn once and stop hammering a dead DB.
        this.logger.warn(
          `Could not save roster for group ${group.id} (${(err as Error).message}) — continuing`,
        );
        return;
      }
    }
    this.logger.log(`Rosters saved: ${saved}/${groups.length} groups`);
  }

  private parseStudents(value: unknown): RosterStudent[] {
    if (!Array.isArray(value)) return [];
    const out: RosterStudent[] = [];
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = Number(obj['id']);
      if (!Number.isFinite(id)) continue;
      out.push({ id, name: String(obj['name'] ?? `#${id}`) });
    }
    return out;
  }

  /**
   * Diff the two most recent roster dates and return, grouped by mentor, the
   * students who were in a group earlier but are gone now (= they left).
   *
   * @param mentorId optional — restrict the result to a single mentor.
   */
  async getLeftStudents(mentorId?: number): Promise<MentorLeftStudents[]> {
    let rows: GroupRosterSnapshot[];
    try {
      // Pull the two most recent distinct dates' worth of rosters.
      const dates = await this.prisma.groupRosterSnapshot.findMany({
        select: { date: true },
        distinct: ['date'],
        orderBy: { date: 'desc' },
        take: 2,
      });
      if (dates.length < 2) {
        // Not enough history yet to diff — feature still "collecting data".
        return [];
      }
      const [newDate, oldDate] = [dates[0].date, dates[1].date];
      rows = await this.prisma.groupRosterSnapshot.findMany({
        where: {
          date: { in: [newDate, oldDate] },
          ...(mentorId != null ? { mentorId } : {}),
        },
      });
      return this.diffRosters(rows, newDate, oldDate);
    } catch (err) {
      this.logger.warn(
        `Could not read rosters for left-students (${(err as Error).message}) — returning empty`,
      );
      return [];
    }
  }

  /**
   * Pure diff helper (no DB) — exported logic so it can be unit-tested with
   * synthetic data. For each group, a student present in the OLD roster but
   * absent in the NEW roster counts as "left".
   */
  diffRosters(
    rows: GroupRosterSnapshot[],
    newDate: Date,
    oldDate: Date,
  ): MentorLeftStudents[] {
    const newTime = newDate.getTime();
    const oldTime = oldDate.getTime();
    const oldByGroup = new Map<number, GroupRosterSnapshot>();
    const newByGroup = new Map<number, GroupRosterSnapshot>();

    for (const row of rows) {
      const t = row.date.getTime();
      if (t === oldTime) oldByGroup.set(row.groupId, row);
      else if (t === newTime) newByGroup.set(row.groupId, row);
    }

    const oldDateStr = oldDate.toISOString().slice(0, 10);
    const byMentor = new Map<number, MentorLeftStudents>();

    for (const [groupId, oldRow] of oldByGroup) {
      const newRow = newByGroup.get(groupId);
      // If the group disappeared entirely from the new snapshot we can't be sure
      // students left (group might just be inactive) — skip to avoid false positives.
      if (!newRow) continue;

      const newIds = new Set(this.parseStudents(newRow.students).map((s) => s.id));
      const oldStudents = this.parseStudents(oldRow.students);

      for (const stu of oldStudents) {
        if (newIds.has(stu.id)) continue; // still enrolled
        let bucket = byMentor.get(oldRow.mentorId);
        if (!bucket) {
          bucket = {
            mentorId: oldRow.mentorId,
            mentorName: oldRow.mentorName,
            leftStudents: [],
          };
          byMentor.set(oldRow.mentorId, bucket);
        }
        bucket.leftStudents.push({
          studentId: stu.id,
          name: stu.name,
          groupName: oldRow.groupName,
          lastSeenDate: oldDateStr,
        });
      }
    }

    return Array.from(byMentor.values()).filter(
      (m) => m.leftStudents.length > 0,
    );
  }
}
