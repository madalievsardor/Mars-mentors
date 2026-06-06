import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import type { NotificationSetting } from '@prisma/client';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('settings')
  async getAllSettings(): Promise<NotificationSetting[]> {
    return this.notificationsService.getAllSettings();
  }

  @Patch('settings/:mentorId')
  async updateSetting(
    @Param('mentorId', ParseIntPipe) mentorId: number,
    @Body() dto: UpdateNotificationSettingDto,
  ): Promise<NotificationSetting> {
    return this.notificationsService.updateSetting(mentorId, dto);
  }
}
