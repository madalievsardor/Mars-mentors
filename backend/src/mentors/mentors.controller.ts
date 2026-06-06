import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MentorsService, MentorResponse, MentorHistoryResponse } from './mentors.service';

@Controller('api/mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  async getAllMentors(): Promise<MentorResponse[]> {
    return this.mentorsService.getAllMentors();
  }

  @Get(':id/history')
  async getMentorHistory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MentorHistoryResponse> {
    return this.mentorsService.getMentorHistory(id);
  }
}
