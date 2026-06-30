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
      let page = 1;
      for (let guard = 0; guard < 30; guard++) {
        const data = await this.mars.authedGet<{ page_count: number; groups: unknown[] }>(
          '/api/v1/groups',
          { status: 'nabor', page } as Record<string, string | number>,
        );
        const groups = data?.groups;
        if (!Array.isArray(groups) || groups.length === 0) break;

        for (const g of groups) {
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

        const pageCount = Number((data as Record<string, unknown>)['page_count'] ?? 1);
        if (page >= pageCount) break;
        page++;
      }
    } catch (err) {
      this.logger.error(`getNaborGroups: ${(err as Error).message}`);
    }
    return result;
  }
}
