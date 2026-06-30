import { Module } from '@nestjs/common';
import { NaborController } from './nabor.controller';
import { NaborService } from './nabor.service';
import { MarsModule } from '../mars/mars.module';

@Module({
  imports: [MarsModule],
  controllers: [NaborController],
  providers: [NaborService],
})
export class NaborModule {}
