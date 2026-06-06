import { Controller, Get } from '@nestjs/common';
import { DashboardService, BranchOverview } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getBranchOverview(): Promise<BranchOverview[]> {
    return this.dashboardService.getBranchOverview();
  }
}
