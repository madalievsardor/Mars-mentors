import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { MarsModule } from '../mars/mars.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MarsModule, SnapshotsModule, NotificationsModule],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
