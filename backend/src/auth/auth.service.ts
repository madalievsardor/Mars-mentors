import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MarsService } from '../mars/mars.service';

export interface LoginDto {
  phone: string;
  password: string;
}

export interface AuthPayload {
  sub: string;
  name: string;
}

interface MarsLoginResponse {
  access_token: string;
  refresh_token: string;
  user?: { first_name?: string; last_name?: string };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly marsService: MarsService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string; name: string }> {
    const baseUrl = this.configService.get<string>(
      'MARS_API_BASE_URL',
      'https://api.marsit.uz/api/v1',
    );

    // 1) Best-effort: try the real Mars signin (gives per-user tokens).
    //    api.marsit.uz/auth/signin is unreliable — it is fronted by Cloudflare and
    //    frequently answers "Could not validate credentials" (HTTP 400) even for valid
    //    web credentials, which is exactly why the Mars MCP authenticates via browser
    //    cookies instead. So we NEVER hard-fail here: any failure (incl. 400/401) just
    //    falls through to the DASHBOARD_PASSWORD path below.
    try {
      this.logger.log(`Login attempt: ${dto.phone}`);

      const resp = await axios.post<MarsLoginResponse>(
        `${baseUrl}/auth/signin`,
        { phone: dto.phone, password: dto.password },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: 'https://core.marsit.uz',
            Referer: 'https://core.marsit.uz/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15000,
        },
      );

      const { access_token, refresh_token, user } = resp.data ?? {};

      // Only treat it as a real login if we actually got tokens back.
      if (access_token && refresh_token) {
        const name = user
          ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || dto.phone
          : dto.phone;

        // Mars tokenlarini MarsService ga berish — keyingi API so'rovlarda ishlatiladi
        this.marsService.setCredentials(dto.phone, dto.password, access_token, refresh_token);

        const payload: AuthPayload = { sub: dto.phone, name };
        const token = this.jwtService.sign(payload);

        this.logger.log(`Login successful (Mars signin): ${name}`);
        return { access_token: token, name };
      }

      this.logger.warn('Mars signin returned no token — falling back to DASHBOARD_PASSWORD');
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      this.logger.warn(
        `Mars signin failed (${status ?? 'no-response'}) — falling back to DASHBOARD_PASSWORD`,
      );
    }

    // 2) Reliable path: shared DASHBOARD_PASSWORD. Mentor data itself is fetched with the
    //    admin cookies supplied via MARS_COOKIES_JSON (see MarsService), not these creds.
    return this.dashboardPasswordFallback(dto);
  }

  private async dashboardPasswordFallback(dto: LoginDto): Promise<{ access_token: string; name: string }> {
    const dashboardPassword = this.configService.get<string>('DASHBOARD_PASSWORD', '');
    if (!dashboardPassword || dto.password !== dashboardPassword) {
      throw new UnauthorizedException('Telefon raqam yoki parol xato');
    }
    const payload: AuthPayload = { sub: dto.phone, name: dto.phone };
    const token = this.jwtService.sign(payload);
    this.logger.log(`Fallback login: ${dto.phone}`);
    return { access_token: token, name: dto.phone };
  }

  verifyToken(token: string): AuthPayload {
    return this.jwtService.verify<AuthPayload>(token);
  }
}
