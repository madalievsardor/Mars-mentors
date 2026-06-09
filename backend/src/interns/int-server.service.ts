import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IntIntern, IntLoginResponse, IntMentor } from './interns.types';

// Refresh (re-login) when the access token has < this many seconds of life left.
const TOKEN_SKEW_S = 60;

/**
 * Talks to the Mars int-server (internship admin) REST API.
 *
 * Unlike the main Mars API (cookie + Cloudflare), int-server uses a plain JWT
 * bearer login: POST /mentors/login {name, lastName, password}. The access token
 * is short-lived (~15 min), so we just re-login when it is near expiry or on 401.
 * Simpler and more reliable server-side than the cookie refresh-token dance.
 */
@Injectable()
export class IntServerService {
  private readonly logger = new Logger(IntServerService.name);
  private readonly httpClient: AxiosInstance;
  private readonly name: string;
  private readonly lastName: string;
  private readonly password: string;
  private readonly configured: boolean;

  private accessToken = '';
  private loggingIn: Promise<boolean> | null = null;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>(
      'INT_API_BASE',
      'https://interns-api-r3im.onrender.com/api',
    );
    this.name = this.configService.get<string>('INT_ADMIN_NAME', '');
    this.lastName = this.configService.get<string>('INT_ADMIN_LASTNAME', '');
    this.password = this.configService.get<string>('INT_ADMIN_PASSWORD', '');
    this.configured = Boolean(this.name && this.lastName && this.password);

    if (!this.configured) {
      this.logger.warn(
        'int-server credentials missing (INT_ADMIN_NAME/LASTNAME/PASSWORD) — intern endpoints will fail',
      );
    }

    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 60000, // Render free tier can cold-start slowly
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        Origin: 'https://www.interns-admin.uz',
        Referer: 'https://www.interns-admin.uz/',
      },
    });
  }

  isConfigured(): boolean {
    return this.configured;
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

  private tokenValid(): boolean {
    if (!this.accessToken) return false;
    const exp = this.decodeJwtExp(this.accessToken);
    if (exp == null) return false;
    return exp - Date.now() / 1000 > TOKEN_SKEW_S;
  }

  /** Log in and cache the access token. Concurrent calls collapse into one request. */
  private async login(): Promise<boolean> {
    if (!this.configured) return false;
    if (this.loggingIn) return this.loggingIn;

    this.loggingIn = (async (): Promise<boolean> => {
      try {
        const resp = await this.httpClient.post<IntLoginResponse>(
          '/mentors/login',
          { name: this.name, lastName: this.lastName, password: this.password },
        );
        const token = resp.data?.token;
        if (!token) {
          this.logger.error('int-server login returned no token');
          return false;
        }
        this.accessToken = token;
        this.logger.log(
          `int-server login ok (${resp.data?.user?.role ?? 'unknown'})`,
        );
        return true;
      } catch (err: unknown) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        this.logger.error(
          `int-server login failed (${status ?? 'no-response'}) — check INT_ADMIN_* creds / host`,
        );
        return false;
      } finally {
        this.loggingIn = null;
      }
    })();

    return this.loggingIn;
  }

  private async ensureToken(): Promise<void> {
    if (!this.tokenValid()) {
      await this.login();
    }
  }

  private async requestWithRetry<T>(
    fn: (headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    await this.ensureToken();
    const headers = (): Record<string, string> => ({
      Authorization: `Bearer ${this.accessToken}`,
    });
    try {
      return await fn(headers());
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 403) {
        // Token rejected — force a fresh login and retry once.
        this.accessToken = '';
        const ok = await this.login();
        if (ok) return fn(headers());
      }
      throw err;
    }
  }

  async getMentors(): Promise<IntMentor[]> {
    return this.requestWithRetry(async (headers) => {
      const resp = await this.httpClient.get<IntMentor[]>('/mentors', { headers });
      return Array.isArray(resp.data) ? resp.data : [];
    });
  }

  async getInterns(): Promise<IntIntern[]> {
    return this.requestWithRetry(async (headers) => {
      const resp = await this.httpClient.get<IntIntern[]>('/interns', { headers });
      return Array.isArray(resp.data) ? resp.data : [];
    });
  }

  /** Single intern straight from int-server. Returns null on 404. */
  async getInternById(id: string): Promise<IntIntern | null> {
    return this.requestWithRetry(async (headers) => {
      try {
        const resp = await this.httpClient.get<IntIntern>(`/interns/${id}`, {
          headers,
        });
        return resp.data ?? null;
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    });
  }
}
