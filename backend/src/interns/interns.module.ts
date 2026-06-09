import { Module } from '@nestjs/common';
import { IntServerService } from './int-server.service';
import { InternsService } from './interns.service';
import { InternsController } from './interns.controller';

@Module({
  controllers: [InternsController],
  providers: [IntServerService, InternsService],
  exports: [InternsService, IntServerService],
})
export class InternsModule {}
