import { Module } from '@nestjs/common';
import { MentorsService } from './mentors.service';
import { MentorsController } from './mentors.controller';
import { MarsModule } from '../mars/mars.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';

@Module({
  imports: [MarsModule, SnapshotsModule],
  providers: [MentorsService],
  controllers: [MentorsController],
})
export class MentorsModule {}
