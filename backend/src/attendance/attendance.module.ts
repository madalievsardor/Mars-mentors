import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { MarsModule } from '../mars/mars.module';

@Module({
  imports: [MarsModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
