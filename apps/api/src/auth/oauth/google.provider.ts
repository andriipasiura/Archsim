import { z } from 'zod';
import type { OAuthAppConfig } from '../../config.js';
import { buildUrl, fetchJson } from './http.js';
import type { OAuthProfile, OAuthProvider } from './oauth-provider.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const tokenSchema = z.object({ access_token: z.string().min(1) });

const userinfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

export class GoogleProvider implements OAuthProvider {
  readonly id = 'google';

  constructor(private readonly app: OAuthAppConfig) {}

  authorizeUrl(state: string): string {
    return buildUrl(AUTHORIZE_URL, {
      client_id: this.app.clientId,
      redirect_uri: this.app.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
  }

  async fetchProfile(code: string): Promise<OAuthProfile> {
    const token = await fetchJson(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.app.clientId,
          client_secret: this.app.clientSecret,
          code,
          redirect_uri: this.app.callbackUrl,
          grant_type: 'authorization_code',
        }).toString(),
      },
      tokenSchema,
    );
    const info = await fetchJson(
      USERINFO_URL,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
      userinfoSchema,
    );
    return {
      id: info.sub,
      login: info.email ?? info.name ?? 'Google user',
      name: info.name ?? null,
      avatarUrl: info.picture ?? null,
    };
  }
}
