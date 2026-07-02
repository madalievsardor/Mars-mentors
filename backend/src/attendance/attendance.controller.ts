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
  GroupListItem,
  MarkResult,
} from './attendance.types';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Controller('api/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** Flat list of all active groups with davomat issue counts. */
  @Get('groups')
  async getGroupsList(): Promise<GroupListItem[]> {
    return this.attendanceService.getGroupsList();
  }

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

  /**
   * Full normalized attendance grid for one group (drill-down).
   * Optional ?year=2026&month=7 query params select a specific calendar month;
   * when omitted the current month is used (backwards-compatible behaviour).
   */
  @Get('group/:groupId')
  async getGroupAttendance(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ): Promise<GroupAttendance> {
    const y = year ? parseInt(year, 10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.attendanceService.getGroupAttendance(groupId, y, m);
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
