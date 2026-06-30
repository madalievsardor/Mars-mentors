import { Module } from '@nestjs/common';
import { MarsService } from './mars.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  providers: [MarsService],
  exports: [MarsService],
})
export class MarsModule {}
