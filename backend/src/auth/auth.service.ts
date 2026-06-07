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

      const { access_token, refresh_token, user } = resp.data;
      const name = user
        ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || dto.phone
        : dto.phone;

      // Mars tokenlarini MarsService ga berish — keyingi API so'rovlarda ishlatiladi
      this.marsService.setCredentials(dto.phone, dto.password, access_token, refresh_token);

      const payload: AuthPayload = { sub: dto.phone, name };
      const token = this.jwtService.sign(payload);

      this.logger.log(`Login successful: ${name}`);
      return { access_token: token, name };

    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401 || status === 400) {
          throw new UnauthorizedException('Telefon raqam yoki parol xato');
        }
        // Mars API blok qilsa — DASHBOARD_PASSWORD fallback
        if (!err.response || status === 503 || status === 403) {
          this.logger.warn(`Mars API unreachable (${status}), trying DASHBOARD_PASSWORD fallback`);
          return this.dashboardPasswordFallback(dto);
        }
      }
      this.logger.error(`Login error: ${(err as Error).message}`);
      throw new UnauthorizedException('Kirish amalga oshmadi');
    }
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
