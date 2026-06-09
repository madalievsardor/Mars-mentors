import { Module } from '@nestjs/common';
import { SnapshotsService } from './snapshots.service';
import { MarsModule } from '../mars/mars.module';

@Module({
  imports: [MarsModule],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
