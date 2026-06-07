import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarsService } from '../mars/mars.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface SyncResult {
  success: boolean;
  mentorCount: number;
  totalGroups: number;
  totalStudents: number;
  syncedAt: string;
  message?: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly marsService: MarsService,
    private readonly snapshotsService: SnapshotsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Asia/Tashkent' })
  async scheduledSync(): Promise<void> {
    this.logger.log('Starting scheduled daily sync at 09:00 Tashkent time');
    await this.runSync();
  }

  async runSync(): Promise<SyncResult> {
    const startedAt = new Date();
    this.logger.log('Starting sync...');

    try {
      // 1. Invalidate cache so fresh data is fetched from Mars API
      this.marsService.invalidateCache();

      // 2. Fetch current mentor stats from Mars API
      const stats = await this.marsService.computeMentorStats();

      // 3. Get yesterday's snapshots for comparison
      const yesterdaySnapshots =
        await this.snapshotsService.getYesterdaySnapshots();

      // 4. Save today's snapshots
      await this.snapshotsService.saveSnapshots(stats, new Date());

      // 5. Upsert notification settings for new mentors
      for (const stat of stats) {
        await this.notificationsService.upsertSettingForMentor(
          stat.id,
          stat.name,
          stat.branch,
        );
      }

      // 6. Check thresholds and send alerts
      await this.notificationsService.checkAndNotify(stats, yesterdaySnapshots);

      const totalGroups = stats.reduce((sum, s) => sum + s.groupCount, 0);
      const totalStudents = stats.reduce((sum, s) => sum + s.studentCount, 0);

      const result: SyncResult = {
        success: true,
        mentorCount: stats.length,
        totalGroups,
        totalStudents,
        syncedAt: startedAt.toISOString(),
      };

      this.logger.log(
        `Sync completed: ${stats.length} mentors, ${totalGroups} groups, ${totalStudents} students`,
      );

      return result;
    } catch (err) {
      this.logger.error(`Sync failed: ${(err as Error).message}`, (err as Error).stack);
      return {
        success: false,
        mentorCount: 0,
        totalGroups: 0,
        totalStudents: 0,
        syncedAt: startedAt.toISOString(),
        message: (err as Error).message,
      };
    }
  }
}
