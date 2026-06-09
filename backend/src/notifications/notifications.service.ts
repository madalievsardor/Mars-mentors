import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { MentorStat } from '../mars/mars.types';
import type { NotificationSetting, MentorSnapshot } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';

export { UpdateNotificationSettingDto };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  async getAllSettings(): Promise<NotificationSetting[]> {
    try {
      return await this.prisma.notificationSetting.findMany({
        orderBy: { mentorName: 'asc' },
      });
    } catch (err) {
      // DB best-effort (see PrismaService.onModuleInit): if the DB is unreachable
      // return no settings so /api/notifications/settings still answers 200
      // instead of 500 — the page just shows an empty list.
      this.logger.warn(
        `Could not read notification settings (${(err as Error).message}) — returning empty`,
      );
      return [];
    }
  }

  async updateSetting(
    mentorId: number,
    dto: UpdateNotificationSettingDto,
  ): Promise<NotificationSetting> {
    try {
      const existing = await this.prisma.notificationSetting.findUnique({
        where: { mentorId },
      });

      if (!existing) {
        throw new NotFoundException(
          `NotificationSetting for mentor ${mentorId} not found`,
        );
      }

      return await this.prisma.notificationSetting.update({
        where: { mentorId },
        data: dto,
      });
    } catch (err) {
      // A genuine "not found" is a real 4xx — let it through.
      if (err instanceof NotFoundException) throw err;
      // DB best-effort: if the DB is unreachable, don't 500. Echo the requested
      // change back so the UI stays consistent (it just won't be persisted).
      this.logger.warn(
        `Could not update notification setting for mentor ${mentorId} (${(err as Error).message}) — not persisted`,
      );
      return {
        id: 0,
        mentorId,
        mentorName: '',
        branch: '',
        enabled: dto.enabled ?? true,
        threshold: dto.threshold ?? 30,
        chatId: this.configService.get<string>(
          'TELEGRAM_DEFAULT_CHAT_ID',
          '1738593169',
        ),
      } as NotificationSetting;
    }
  }

  async upsertSettingForMentor(
    mentorId: number,
    mentorName: string,
    branch: string,
  ): Promise<void> {
    try {
      await this.prisma.notificationSetting.upsert({
        where: { mentorId },
        create: {
          mentorId,
          mentorName,
          branch,
          enabled: true,
          threshold: 30,
          chatId: this.configService.get<string>(
            'TELEGRAM_DEFAULT_CHAT_ID',
            '1738593169',
          ),
        },
        update: {
          mentorName,
          branch,
        },
      });
    } catch (err) {
      // DB best-effort: skip persistence if the DB is down — don't crash sync.
      this.logger.warn(
        `Could not upsert notification setting for mentor ${mentorId} (${(err as Error).message}) — continuing without DB`,
      );
    }
  }

  async checkAndNotify(
    currentStats: MentorStat[],
    yesterdaySnapshots: MentorSnapshot[],
  ): Promise<void> {
    const settings = await this.getAllSettings();
    const settingsMap = new Map(settings.map((s) => [s.mentorId, s]));
    const yesterdayMap = new Map(
      yesterdaySnapshots.map((s) => [s.mentorId, s]),
    );

    for (const stat of currentStats) {
      const setting = settingsMap.get(stat.id);
      if (!setting || !setting.enabled) continue;

      const yesterday = yesterdayMap.get(stat.id);
      const oldCount = yesterday?.studentCount ?? null;
      const newCount = stat.studentCount;
      const threshold = setting.threshold;
      const chatId = setting.chatId;

      let alertMessage: string | null = null;
      let alertType: string | null = null;

      // Student count decreased
      if (oldCount !== null && newCount < oldCount) {
        const diff = oldCount - newCount;
        alertType = 'count_decreased';
        alertMessage =
          `⬇️ <b>O'quvchi kamaydi!</b>\n\n` +
          `👤 <b>Mentor:</b> ${stat.name}\n` +
          `🏢 <b>Filial:</b> ${stat.branch}\n` +
          `📊 <b>O'zgarish:</b> ${oldCount} → ${newCount} (<b>-${diff} ta</b>)\n` +
          `📚 <b>Guruhlar soni:</b> ${stat.groupCount}\n\n` +
          `💡 Bu mentorga yangi guruh berish mumkin.`;
      }
      // Threshold crossed: students reached overload limit
      else if (newCount >= threshold && (oldCount === null || oldCount < threshold)) {
        alertType = 'threshold_reached';
        alertMessage =
          `🔴 <b>Yuklama chegarasi!</b>\n\n` +
          `👤 <b>Mentor:</b> ${stat.name}\n` +
          `🏢 <b>Filial:</b> ${stat.branch}\n` +
          `👥 <b>O'quvchilar:</b> ${newCount} ta (chegara: ${threshold})\n` +
          `📚 <b>Guruhlar soni:</b> ${stat.groupCount}\n\n` +
          `⚠️ Bu mentorga yangi guruh bermang.`;
      }

      if (alertMessage && alertType) {
        const sent = await this.telegram.sendMessage(chatId, alertMessage);

        if (sent) {
          try {
            await this.prisma.alert.create({
              data: {
                type: alertType,
                mentorId: stat.id,
                mentorName: stat.name,
                branch: stat.branch,
                message: alertMessage,
                oldCount,
                newCount,
              },
            });
          } catch (err) {
            // DB best-effort: the alert was already sent to Telegram; if the DB
            // is down we just can't log it — don't crash the notify run.
            this.logger.warn(
              `Could not persist alert for mentor ${stat.name} (${(err as Error).message}) — continuing`,
            );
          }

          this.logger.log(
            `Alert sent for mentor ${stat.name}: ${alertType}`,
          );
        }
      }
    }
  }
}
