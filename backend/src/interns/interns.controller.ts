import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InternsService } from './interns.service';
import { InternDetail, InternsSummary, MentorInterns } from './interns.types';

@Controller('api/interns')
export class InternsController {
  constructor(private readonly internsService: InternsService) {}

  /** Full summary: totals, grade distribution, and per-mentor intern lists. */
  @Get('summary')
  async getSummary(): Promise<InternsSummary> {
    return this.internsService.getSummary();
  }

  /** Just the per-mentor intern counts (sorted desc). */
  @Get('by-mentor')
  async getByMentor(): Promise<MentorInterns[]> {
    const summary = await this.internsService.getSummary();
    return summary.mentors;
  }

  /** Force a refresh of the int-server data cache. */
  @Post('refresh')
  async refresh(): Promise<InternsSummary> {
    this.internsService.invalidateCache();
    return this.internsService.getSummary();
  }

  /** Full profile for one intern (status, attendance figures, plan, mentors). */
  @Get(':id')
  async getInternDetail(@Param('id') id: string): Promise<InternDetail> {
    const detail = await this.internsService.getInternDetail(id);
    if (!detail) {
      throw new NotFoundException(`Intern ${id} not found`);
    }
    return detail;
  }
}
