import { Controller, Get } from '@nestjs/common';
import {
  DashboardService,
  BranchOverview,
  TimelineResponse,
  MonthlyResponse,
} from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getBranchOverview(): Promise<BranchOverview[]> {
    return this.dashboardService.getBranchOverview();
  }

  @Get('timeline')
  async getTimeline(): Promise<TimelineResponse> {
    return this.dashboardService.getTimeline();
  }

  @Get('monthly')
  async getMonthly(): Promise<MonthlyResponse> {
    return this.dashboardService.getMonthly();
  }
}
