import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  MarsGroup,
  MarsGroupsResponse,
  MarsTeacher,
  MentorStat,
  SimpleMentorGroup,
} from './mars.types';

const COOKIE_TTL_MS = 50 * 60 * 1000; // 50 min

@Injectable()
export class MarsService {
  private readonly logger = new Logger(MarsService.name);
  private readonly httpClient: AxiosInstance;
  private cachedCookieHeader = '';
  private cookiesLoadedAt = 0;
  private cachedStats: MentorStat[] | null = null;
  private statsLoadedAt = 0;
  private readonly STATS_TTL_MS = 5 * 60 * 1000; // 5 daqiqa

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

  private async autoLogin(): Promise<boolean> {
    const phone = this.marsPhone || this.configService.get<string>('MARS_PHONE', '');
    const password = this.marsPassword || this.configService.get<string>('MARS_PASSWORD', '');
    if (!phone || !password) {
      this.logger.warn('MARS_PHONE/MARS_PASSWORD not set — cannot auto-login');
      return false;
    }

    try {
      this.logger.log(`Auto-login attempt as ${phone}...`);
      const resp = await this.httpClient.post<{
        access_token: string;
        refresh_token: string;
      }>('/auth/signin', { phone, password });

      const { access_token, refresh_token } = resp.data;
      const cookies = { admin_access_token: access_token, admin_refresh_token: refresh_token };

      // Save to file (local dev)
      const filePath = join(process.cwd(), 'mars-cookies.json');
      try {
        writeFileSync(filePath, JSON.stringify(cookies, null, 2));
      } catch {
        // Read-only filesystem (production) — skip file write
      }

      // Update in-memory cache
      this.cachedCookieHeader = `admin_access_token=${access_token}; admin_refresh_token=${refresh_token}`;
      this.cookiesLoadedAt = Date.now();
      this.logger.log('Auto-login successful — cookies updated');
      return true;
    } catch (err: unknown) {
      this.logger.error(`Auto-login failed: ${(err as Error).message}`);
      return false;
    }
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
        // Try auto-login first, then retry
        const loggedIn = await this.autoLogin();
        if (loggedIn) {
          return fn(this.getAuthHeaders());
        }
        // Fallback: force reload from file/env
        this.cachedCookieHeader = '';
        return fn(this.getAuthHeaders());
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

  private marsPhone = '';
  private marsPassword = '';

  setCredentials(phone: string, password: string, accessToken: string, refreshToken: string): void {
    this.marsPhone = phone;
    this.marsPassword = password;
    this.cachedCookieHeader = `admin_access_token=${accessToken}; admin_refresh_token=${refreshToken}`;
    this.cookiesLoadedAt = Date.now();
    this.logger.log(`Mars credentials set for ${phone}`);
  }

  invalidateCache(): void {
    this.cachedStats = null;
    this.statsLoadedAt = 0;
  }

  async computeMentorStats(): Promise<MentorStat[]> {
    const now = Date.now();
    if (this.cachedStats && now - this.statsLoadedAt < this.STATS_TTL_MS) {
      this.logger.log(`Returning cached mentor stats (${Math.round((now - this.statsLoadedAt) / 1000)}s old)`);
      return this.cachedStats;
    }

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
      const simpleGroup: SimpleMentorGroup = {
        name: group.name,
        category: group.category?.name ?? '',
        time: group.lesson_start_time ?? '',
        studentCount: group.students_number ?? 0,
      };
      stat.groups.push(simpleGroup);
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

    this.cachedStats = Array.from(mentorMap.values());
    this.statsLoadedAt = Date.now();
    this.logger.log(`Mentor stats cached: ${this.cachedStats.length} mentors`);
    return this.cachedStats;
  }
}
