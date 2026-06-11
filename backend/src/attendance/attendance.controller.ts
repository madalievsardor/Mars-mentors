import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  AttendanceOverview,
  GroupAttendance,
  MarkResult,
} from './attendance.types';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Controller('api/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Overview of recent attendance issues across every active group, grouped by
   * mentor. Cached ~30 min; pass `?refresh=1` to force a fresh scan.
   */
  @Get('overview')
  async getOverview(
    @Query('refresh') refresh?: string,
  ): Promise<AttendanceOverview> {
    return this.attendanceService.getOverview(refresh === '1');
  }

  /** Full normalized attendance grid for one group (drill-down). */
  @Get('group/:groupId')
  async getGroupAttendance(
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<GroupAttendance> {
    return this.attendanceService.getGroupAttendance(groupId);
  }

  /**
   * Mark one (student, lesson-day) cell present (1) or absent (0).
   * ⚠️ Writes to live Mars attendance.
   */
  @Post('mark')
  async mark(@Body() dto: MarkAttendanceDto): Promise<MarkResult> {
    return this.attendanceService.markCell(
      dto.groupId,
      dto.studentId,
      dto.date,
      dto.status,
    );
  }
}
