import { Controller, Get, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import type { ApiLogEntry, LogCategory } from './logs.service';

@Controller('api/logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  getLogs(
    @Query('category') category?: LogCategory,
    @Query('limit') limit?: string,
  ): ApiLogEntry[] {
    return this.logs.get(category, limit ? Math.min(Number(limit), 500) : 200);
  }
}
