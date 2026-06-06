import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  MarsGroup,
  MarsGroupsResponse,
  MarsTeacher,
  MentorStat,
} from './mars.types';

const COOKIE_TTL_MS = 50 * 60 * 1000; // 50 min

@Injectable()
export class MarsService {
  private readonly logger = new Logger(MarsService.name);
  private readonly httpClient: AxiosInstance;
  private cachedCookieHeader = '';
  private cookiesLoadedAt = 0;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>(
      'MARS_API_BASE_URL',
      'https://api.marsit.uz/api/v1',
    );
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        Origin: 'https://core.marsit.uz',
        Referer: 'https://core.marsit.uz/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
  }

  private loadCookies(): string {
    // 1. MARS_COOKIES_JSON env var (for Render/production)
    const fromEnv = this.configService.get<string>('MARS_COOKIES_JSON', '');
    if (fromEnv) {
      try {
        const parsed = JSON.parse(fromEnv) as Record<string, unknown>;
        const cookieMap =
          (parsed['cookies'] as Record<string, string>) ??
          (parsed as Record<string, string>);
        return Object.entries(cookieMap)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      } catch {
        this.logger.warn('MARS_COOKIES_JSON parse error');
      }
    }

    // 2. mars-cookies.json file (local dev fallback)
    const filePath = join(process.cwd(), 'mars-cookies.json');
    if (existsSync(filePath)) {
      try {
        const cookies = JSON.parse(
          readFileSync(filePath, 'utf-8'),
        ) as Record<string, string>;
        return Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      } catch {
        this.logger.warn('mars-cookies.json parse error');
      }
    }

    this.logger.warn('No Mars cookies found — requests may fail');
    return '';
  }

  private getCookieHeader(): string {
    const now = Date.now();
    if (this.cachedCookieHeader && now - this.cookiesLoadedAt < COOKIE_TTL_MS) {
      return this.cachedCookieHeader;
    }
    this.cachedCookieHeader = this.loadCookies();
    this.cookiesLoadedAt = now;
    return this.cachedCookieHeader;
  }

  private getAuthHeaders(): Record<string, string> {
    return { Cookie: this.getCookieHeader() };
  }

  private async requestWithRetry<T>(
    fn: (headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    const headers = this.getAuthHeaders();
    try {
      return await fn(headers);
    } catch (err: unknown) {
      const httpStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (httpStatus === 401 || httpStatus === 403) {
        // Force reload cookies and retry once
        this.cachedCookieHeader = '';
        const freshHeaders = this.getAuthHeaders();
        return fn(freshHeaders);
      }
      throw err;
    }
  }

  async getTeachers(): Promise<MarsTeacher[]> {
    return this.requestWithRetry(async (headers) => {
      const response = await this.httpClient.get<MarsTeacher[]>(
        '/staff/teachers',
        { headers },
      );
      return response.data;
    });
  }

  async getAllActiveGroups(): Promise<MarsGroup[]> {
    return this.requestWithRetry(async (headers) => {
      const pageSize = 50;
      let page = 1;
      const allGroups: MarsGroup[] = [];

      this.logger.log('Fetching all active groups from Mars API...');

      while (true) {
        const response = await this.httpClient.get<MarsGroupsResponse>(
          '/groups',
          {
            headers,
            params: { status: 'active', page, page_size: pageSize },
          },
        );

        const { groups, page_count } = response.data;
        allGroups.push(...groups);
        this.logger.log(`Fetched page ${page}/${page_count} — ${groups.length} groups`);

        if (page >= page_count) break;
        page++;
      }

      this.logger.log(`Total active groups fetched: ${allGroups.length}`);
      return allGroups;
    });
  }

  async computeMentorStats(): Promise<MentorStat[]> {
    const groups = await this.getAllActiveGroups();
    const mentorMap = new Map<number, MentorStat>();

    for (const group of groups) {
      const mentorId = group.user.id;
      const mentorName = `${group.user.first_name} ${group.user.last_name}`.trim();
      const branch = group.branch?.title ?? 'Unknown';

      if (!mentorMap.has(mentorId)) {
        mentorMap.set(mentorId, {
          id: mentorId,
          name: mentorName,
          branch,
          grade: '',
          groupCount: 0,
          studentCount: 0,
          groups: [],
        });
      }

      const stat = mentorMap.get(mentorId)!;
      stat.groupCount += 1;
      stat.studentCount += group.students_number ?? 0;
      stat.groups.push(group);
    }

    try {
      const teachers = await this.getTeachers();
      const teacherMap = new Map(teachers.map((t) => [t.id, t]));
      for (const [id, stat] of mentorMap) {
        const teacher = teacherMap.get(id);
        if (teacher) stat.grade = teacher.grade ?? '';
      }
    } catch (err) {
      this.logger.warn(`Could not enrich mentor grades: ${(err as Error).message}`);
    }

    return Array.from(mentorMap.values());
  }
}
