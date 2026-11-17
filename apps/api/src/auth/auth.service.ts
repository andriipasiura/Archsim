import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { OAuthProviderId, User } from '@sds/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SESSION_TTL_MS } from './cookies.js';
import type { OAuthProfile } from './oauth/oauth-provider.js';

const USER_FIELDS = {
  id: true,
  login: true,
  name: true,
  avatarUrl: true,
} as const;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertOAuthUser(
    provider: OAuthProviderId,
    profile: OAuthProfile,
  ): Promise<User> {
    const fields = {
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    };
    const account = await this.prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.id,
        },
      },
      update: { user: { update: fields } },
      create: {
        provider,
        providerAccountId: profile.id,
        user: { create: fields },
      },
      select: { user: { select: USER_FIELDS } },
    });
    return account.user;
  }

  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        id: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  async findSessionUser(token: string): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: hashToken(token) },
      select: { expiresAt: true, user: { select: USER_FIELDS } },
    });
    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await this.deleteSession(token);
      return null;
    }
    return session.user;
  }

  async deleteSession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
}
