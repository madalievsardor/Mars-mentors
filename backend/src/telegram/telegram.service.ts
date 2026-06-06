import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>(
      'TELEGRAM_BOT_TOKEN',
      '',
    );
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set, skipping notification');
      return false;
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await axios.post<TelegramSendMessageResponse>(url, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });

      if (response.data.ok) {
        this.logger.log(`Telegram message sent to chat ${chatId}`);
        return true;
      } else {
        this.logger.error(
          `Telegram API error: ${response.data.description}`,
        );
        return false;
      }
    } catch (err) {
      this.logger.error(
        `Failed to send Telegram message: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
