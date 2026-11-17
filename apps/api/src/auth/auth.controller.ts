import { randomBytes } from 'node:crypto';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MeResponse } from '@sds/shared';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { AuthService } from './auth.service.js';
import {
  cookieOptions,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
  readCookie,
  safeEqual,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from './cookies.js';
import { OAuthProviders } from './oauth/oauth-providers.js';

const SIGN_IN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly providers: OAuthProviders,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('me')
  async me(@Req() req: Request): Promise<MeResponse> {
    const token = readCookie(req, SESSION_COOKIE);
    return {
      user: token ? await this.auth.findSessionUser(token) : null,
      providers: this.providers.available(),
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await this.auth.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, cookieOptions(this.config.cookieSecure));
  }

  @Get(':provider')
  @Throttle(SIGN_IN_THROTTLE)
  start(@Param('provider') providerId: string, @Res() res: Response): void {
    const provider = this.providers.get(providerId);
    const state = randomBytes(32).toString('base64url');
    res.cookie(
      OAUTH_STATE_COOKIE,
      state,
      cookieOptions(this.config.cookieSecure, OAUTH_STATE_TTL_MS),
    );
    res.redirect(provider.authorizeUrl(state));
  }

  @Get(':provider/callback')
  @Throttle(SIGN_IN_THROTTLE)
  async callback(
    @Param('provider') providerId: string,
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const provider = this.providers.get(providerId);
    const expected = readCookie(req, OAUTH_STATE_COOKIE);
    res.clearCookie(
      OAUTH_STATE_COOKIE,
      cookieOptions(this.config.cookieSecure),
    );
    const fail = () => res.redirect(`${this.config.webUrl}/?auth_error=1`);

    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      !expected ||
      !safeEqual(state, expected)
    ) {
      fail();
      return;
    }

    try {
      const profile = await provider.fetchProfile(code);
      const user = await this.auth.upsertOAuthUser(provider.id, profile);
      const token = await this.auth.createSession(user.id);
      res.cookie(
        SESSION_COOKIE,
        token,
        cookieOptions(this.config.cookieSecure, SESSION_TTL_MS),
      );
      res.redirect(`${this.config.webUrl}/`);
    } catch (error) {
      this.logger.error(`${provider.id} sign-in failed`, error);
      fail();
    }
  }
}
