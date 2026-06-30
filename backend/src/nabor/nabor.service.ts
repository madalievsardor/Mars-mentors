import { Injectable, Logger } from '@nestjs/common';
import { MarsService } from '../mars/mars.service';

export interface NaborGroup {
  id: number;
  name: string;
  mentor: string | null;
  mentorId: number | null;
  branch: string | null;
  category: string | null;
  lessonStart: string;
  lessonEnd: string;
  days: number;
  dateStarted: string;
  studentsCount: number;
}

@Injectable()
export class NaborService {
  private readonly logger = new Logger(NaborService.name);

  constructor(private readonly mars: MarsService) {}

  async getNaborGroups(): Promise<NaborGroup[]> {
    const result: NaborGroup[] = [];
    try {
      const rows = await this.mars.authedGet<unknown[]>(
        '/api/v2/groups',
        { status_type: 1 } as Record<string, string | number>,
      );
      if (!Array.isArray(rows)) return result;

      for (const g of rows) {
        const row = g as Record<string, unknown>;
        const user = (row['user'] as Record<string, unknown> | null) ?? {};
        const branch = (row['branch'] as Record<string, unknown> | null) ?? {};
        const category = (row['category'] as Record<string, unknown> | null) ?? {};

        const firstName = String(user['first_name'] ?? '');
        const lastName = String(user['last_name'] ?? '');
        const mentor = (firstName + ' ' + lastName).trim() || null;

        result.push({
          id: Number(row['id']),
          name: String(row['name'] ?? ''),
          mentor,
          mentorId: user['id'] != null ? Number(user['id']) : null,
          branch: branch['title'] ? String(branch['title']) : null,
          category: category['name'] ? String(category['name']) : null,
          lessonStart: String(row['lesson_start_time'] ?? ''),
          lessonEnd: String(row['lesson_end_time'] ?? ''),
          days: Number(row['days'] ?? 0),
          dateStarted: String(row['date_started'] ?? ''),
          studentsCount: Number(row['students_number'] ?? 0),
        });
      }
    } catch (err) {
      this.logger.error(`getNaborGroups: ${(err as Error).message}`);
    }
    return result;
  }
}
