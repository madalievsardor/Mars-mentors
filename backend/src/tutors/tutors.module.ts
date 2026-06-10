import { Module } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { TutorsController } from './tutors.controller';
import { MarsModule } from '../mars/mars.module';

@Module({
  imports: [MarsModule],
  providers: [TutorsService],
  controllers: [TutorsController],
})
export class TutorsModule {}
