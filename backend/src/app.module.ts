import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { MarsModule } from './mars/mars.module';
import { TelegramModule } from './telegram/telegram.module';
import { SnapshotsModule } from './snapshots/snapshots.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SyncModule } from './sync/sync.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MentorsModule } from './mentors/mentors.module';
import { InternsModule } from './interns/interns.module';
import { TutorsModule } from './tutors/tutors.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MarsModule,
    TelegramModule,
    SnapshotsModule,
    NotificationsModule,
    SyncModule,
    DashboardModule,
    MentorsModule,
    InternsModule,
    TutorsModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
