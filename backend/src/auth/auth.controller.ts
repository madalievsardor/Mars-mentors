import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { LoginDto, AuthPayload } from './auth.service';
import { Public } from './public.decorator';
import type { Request as Req } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: LoginDto,
  ): Promise<{ access_token: string; name: string }> {
    return this.authService.login(body);
  }

  @Get('me')
  getMe(
    @Request() req: Req & { user: AuthPayload },
  ): AuthPayload {
    return req.user;
  }
}
