import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MarsModule } from '../mars/mars.module';

@Module({
  imports: [MarsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
