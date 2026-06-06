import { Module } from '@nestjs/common';
import { MarsService } from './mars.service';

@Module({
  providers: [MarsService],
  exports: [MarsService],
})
export class MarsModule {}
