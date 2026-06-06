import { Controller, Post } from '@nestjs/common';
import { SyncService, SyncResult } from './sync.service';

@Controller('api')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('sync')
  async triggerSync(): Promise<SyncResult> {
    return this.syncService.runSync();
  }
}
