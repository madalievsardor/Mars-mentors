import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  MarsGroup,
  MarsGroupsResponse,
  MarsTeacher,
  MentorStat,
  SimpleMentorGroup,
} from './mars.types';

// Refresh the Mars access token when it has < this many seconds of life left.
const ACCESS_SKEW_S = 60;

@Injectable()
export class MarsService {
  private readonly logger = new Logger(MarsService.name);
  private readonly httpClient: AxiosInstance;

  // Rotating Mars admin auth state.
  private accessToken = '';
  private refreshToken = '';
  private seeded = false;
  private refreshing: Promise<boolean> | null = null;

  private cachedStats: MentorStat[] | null = null;
  private statsLoadedAt = 0;
  private readonly STATS_TTL_MS = 5 * 60 * 1000; // 5 daqiqa

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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

  // ──────────── token seeding ────────────

  /** Read the initial admin tokens from MARS_COOKIES_JSON (inline JSON). */
  private seedFromEnv(): void {
    const raw = this.configService.get<string>('MARS_COOKIES_JSON', '');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const map =
        (parsed['cookies'] as Record<string, string>) ??
        (parsed as Record<string, string>);
      if (map['admin_refresh_token']) {
        this.refreshToken = String(map['admin_refresh_token']);
      }
      if (map['admin_access_token']) {
        this.accessToken = String(map['admin_access_token']);
      }
    } catch {
      this.logger.warn('MARS_COOKIES_JSON parse error');
    }
  }

  /**
   * Load the latest refresh token. The DB copy (rotated on every refresh) wins so
   * the token keeps working across restarts; otherwise fall back to the env seed.
   */
  private async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    this.seeded = true;

    try {
      const row = await this.prisma.marsAuth.findUnique({ where: { id: 1 } });
      if (row?.refreshToken) {
        this.refreshToken = row.refreshToken;
        if (row.accessToken) this.accessToken = row.accessToken;
        this.logger.log('Loaded Mars refresh token from DB');
        return;
      }
    } catch (e) {
      this.logger.warn(`DB load of mars_auth failed: ${(e as Error).message}`);
    }

    this.seedFromEnv();
    if (this.refreshToken) {
      this.logger.log('Seeded Mars refresh token from MARS_COOKIES_JSON');
    } else {
      this.logger.warn('No Mars refresh token (set MARS_COOKIES_JSON) — data calls will fail');
    }
  }

  private decodeJwtExp(token: string): number | null {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const json = Buffer.from(
        part.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf-8');
      const exp = (JSON.parse(json) as { exp?: number }).exp;
      return typeof exp === 'number' ? exp : null;
    } catch {
      return null;
    }
  }

  private accessTokenValid(): boolean {
    if (!this.accessToken) return false;
    const exp = this.decodeJwtExp(this.accessToken);
    if (exp == null) return false;
    return exp - Date.now() / 1000 > ACCESS_SKEW_S;
  }

  // ──────────── refresh ────────────

  /**
   * Exchange the long-lived refresh token for a fresh access token via
   * `GET /auth/token`. This works server-side (no browser / Cloudflare bypass),
   * unlike `/auth/signin`. The refresh token rotates, so we persist the newest one.
   */
  private async refreshTokens(): Promise<boolean> {
    await this.ensureSeeded();
    if (!this.refreshToken) {
      this.logger.error('Cannot refresh: no Mars refresh token. Set MARS_COOKIES_JSON.');
      return false;
    }
    // Collapse concurrent refreshes into one in-flight request.
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async (): Promise<boolean> => {
      try {
        const resp = await this.httpClient.get<{
          access_token?: string;
          refresh_token?: string;
        }>('/auth/token', {
          headers: { Cookie: `admin_refresh_token=${this.refreshToken}` },
        });

        const { access_token, refresh_token } = resp.data ?? {};
        if (!access_token) {
          this.logger.error('Token refresh returned no access_token');
          return false;
        }
        this.accessToken = access_token;
        if (refresh_token) this.refreshToken = refresh_token;
        await this.persistTokens();
        this.logger.log('Mars access token refreshed via /auth/token');
        return true;
      } catch (err: unknown) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        this.logger.error(
          `Token refresh failed (${status ?? 'no-response'}) — refresh token is likely ` +
            'expired (~7d life). Re-seed MARS_COOKIES_JSON with fresh admin cookies.',
        );
        return false;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  private async persistTokens(): Promise<void> {
    try {
      await this.prisma.marsAuth.upsert({
        where: { id: 1 },
        update: { refreshToken: this.refreshToken, accessToken: this.accessToken },
        create: { id: 1, refreshToken: this.refreshToken, accessToken: this.accessToken },
      });
    } catch (e) {
      this.logger.warn(`Persist mars_auth failed: ${(e as Error).message}`);
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    await this.ensureSeeded();
    if (!this.accessTokenValid()) {
      await this.refreshTokens();
    }
    const cookie = [
      this.accessToken ? `admin_access_token=${this.accessToken}` : '',
      this.refreshToken ? `admin_refresh_token=${this.refreshToken}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    return cookie ? { Cookie: cookie } : {};
  }

  private async requestWithRetry<T>(
    fn: (headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    try {
      return await fn(headers);
    } catch (err: unknown) {
      const httpStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (httpStatus === 401 || httpStatus === 403) {
        // Access token rejected — force a refresh and retry once.
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          return fn(await this.getAuthHeaders());
        }
      }
      throw err;
    }
  }

  /**
   * Backward-compat hook: AuthService calls this when (rarely) /auth/signin returns
   * real tokens. We just feed them into the rotating store.
   */
  setCredentials(
    _phone: string,
    _password: string,
    accessToken: string,
    refreshToken: string,
  ): void {
    if (accessToken) this.accessToken = accessToken;
    if (refreshToken) this.refreshToken = refreshToken;
    this.seeded = true;
    void this.persistTokens();
    this.logger.log('Mars credentials set from signin');
  }

  invalidateCache(): void {
    this.cachedStats = null;
    this.statsLoadedAt = 0;
  }

  // ──────────── data ────────────

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
        const response = await this.httpClient.get<MarsGroupsResponse>('/groups', {
          headers,
          params: { status: 'active', page, page_size: pageSize },
        });

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
    const now = Date.now();
    if (this.cachedStats && now - this.statsLoadedAt < this.STATS_TTL_MS) {
      this.logger.log(
        `Returning cached mentor stats (${Math.round((now - this.statsLoadedAt) / 1000)}s old)`,
      );
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
