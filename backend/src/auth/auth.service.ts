import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface LoginDto {
  phone: string;
  password: string;
}

export interface AuthPayload {
  sub: string;
  name: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getSystemCookieStr(): string {
    const fromEnv = this.configService.get<string>('MARS_COOKIES_JSON', '');
    if (!fromEnv) return '';
    try {
      const parsed = JSON.parse(fromEnv) as Record<string, unknown>;
      const cookies = (parsed['cookies'] as Record<string, string>) ?? (parsed as Record<string, string>);
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    } catch {
      return '';
    }
  }

  private async getMarsUserName(phone: string): Promise<string | null> {
    const cookieStr = this.getSystemCookieStr();
    if (!cookieStr) return null;

    const baseUrl = this.configService.get<string>(
      'MARS_API_BASE_URL',
      'https://api.marsit.uz/api/v1',
    );

    try {
      const resp = await axios.get<
        { id: number; first_name: string; last_name: string }[]
      >(`${baseUrl}/staff/teachers`, {
        headers: {
          Cookie: cookieStr,
          Accept: 'application/json',
          Origin: 'https://core.marsit.uz',
          Referer: 'https://core.marsit.uz/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        timeout: 8000,
      });

      const phoneDigits = phone.replace(/\D/g, '');
      const match = resp.data.find(
        (t: { id: number; first_name: string; last_name: string } & { phone?: string }) =>
          t.phone && t.phone.replace(/\D/g, '') === phoneDigits,
      );
      if (match) return `${match.first_name} ${match.last_name}`.trim();
    } catch (err) {
      this.logger.warn(`Name lookup skipped: ${(err as Error).message}`);
    }

    return null;
  }

  async login(dto: LoginDto): Promise<{ access_token: string; name: string }> {
    const dashboardPassword = this.configService.get<string>('DASHBOARD_PASSWORD', '');

    if (!dashboardPassword) {
      throw new UnauthorizedException("DASHBOARD_PASSWORD sozlanmagan");
    }

    if (dto.password !== dashboardPassword) {
      throw new UnauthorizedException('Parol xato');
    }

    const marsName = await this.getMarsUserName(dto.phone);
    const name = marsName ?? dto.phone;

    const payload: AuthPayload = { sub: dto.phone, name };
    const token = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${name} (${dto.phone})`);
    return { access_token: token, name };
  }

  verifyToken(token: string): AuthPayload {
    return this.jwtService.verify<AuthPayload>(token);
  }
}
