import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { User } from '@sds/shared';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { readCookie, SESSION_COOKIE } from './cookies.js';

interface AuthedRequest extends Request {
  user: User;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readCookie(req, SESSION_COOKIE);
    const user = token ? await this.auth.findSessionUser(token) : null;
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);
