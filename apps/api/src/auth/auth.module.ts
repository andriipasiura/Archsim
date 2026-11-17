import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OAuthProviders } from './oauth/oauth-providers.js';
import { SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OAuthProviders, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
