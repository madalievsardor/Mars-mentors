import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MarsService } from '../mars/mars.service';

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
    private readonly marsService: MarsService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string; name: string }> {
    // ── STRICT GATE ──────────────────────────────────────────────────────────
    // Faqat bitta vakolatli kredensial kira oladi. Defaultlar kodga baked —
    // Render env o'zgartirmasa ham ishlaydi. Eski DASHBOARD_PASSWORD'ga TAYANMAYDI.
    const allowedPhone = this.configService.get<string>('ALLOWED_LOGIN_PHONE', '+998903151515');
    const allowedPassword = this.configService.get<string>('ALLOWED_LOGIN_PASSWORD', '889900oo');

    // Telefonni normallashtir: faqat raqamlarni qoldir ("+998 90 315-15-15" → "998903151515")
    const normalize = (p: string): string => (p ?? '').replace(/\D/g, '');
    const phoneOk = normalize(dto.phone) === normalize(allowedPhone);
    const passwordOk = dto.password === allowedPassword;

    if (!phoneOk || !passwordOk) {
      this.logger.warn(`Login rad etildi: ${dto.phone}`);
      throw new UnauthorizedException('Telefon raqam yoki parol xato');
    }

    // Gate'dan o'tdi — to'g'ridan-to'g'ri JWT chiqaramiz. Mentor data baribir admin
    // cookies (MARS_COOKIES_JSON → MarsService) orqali keladi, per-user Mars token kerak emas.
    const payload: AuthPayload = { sub: dto.phone, name: dto.phone };
    const token = this.jwtService.sign(payload);
    this.logger.log(`Login muvaffaqiyatli: ${dto.phone}`);
    return { access_token: token, name: dto.phone };
  }

  verifyToken(token: string): AuthPayload {
    return this.jwtService.verify<AuthPayload>(token);
  }
}
