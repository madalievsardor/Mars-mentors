import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { MarsModule } from '../mars/mars.module';
import { InternsModule } from '../interns/interns.module';

@Module({
  imports: [MarsModule, InternsModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
