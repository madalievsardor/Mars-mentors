import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MentorsService, MentorResponse, MentorHistoryResponse } from './mentors.service';
import { MentorLeftStudents } from '../snapshots/snapshots.service';

@Controller('api/mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  async getAllMentors(): Promise<MentorResponse[]> {
    return this.mentorsService.getAllMentors();
  }

  // NOTE: static routes must be declared BEFORE the ':id' param routes,
  // otherwise Nest would match 'left-students' as an :id.
  @Get('left-students')
  async getAllLeftStudents(): Promise<MentorLeftStudents[]> {
    return this.mentorsService.getLeftStudents();
  }

  @Get(':id/left-students')
  async getMentorLeftStudents(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MentorLeftStudents | null> {
    return this.mentorsService.getMentorLeftStudents(id);
  }

  @Get(':id/history')
  async getMentorHistory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MentorHistoryResponse> {
    return this.mentorsService.getMentorHistory(id);
  }
}
