import { z } from 'zod';
import type { OAuthAppConfig } from '../../config.js';
import { buildUrl, fetchJson } from './http.js';
import type { OAuthProfile, OAuthProvider } from './oauth-provider.js';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';

const tokenSchema = z.union([
  z.object({ access_token: z.string().min(1) }),
  z.object({ error: z.string() }),
]);

const userSchema = z.object({
  id: z.number().int(),
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

export class GithubProvider implements OAuthProvider {
  readonly id = 'github';

  constructor(private readonly app: OAuthAppConfig) {}

  authorizeUrl(state: string): string {
    return buildUrl(AUTHORIZE_URL, {
      client_id: this.app.clientId,
      redirect_uri: this.app.callbackUrl,
      scope: 'read:user',
      state,
    });
  }

  async fetchProfile(code: string): Promise<OAuthProfile> {
    const token = await fetchJson(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.app.clientId,
          client_secret: this.app.clientSecret,
          code,
          redirect_uri: this.app.callbackUrl,
        }),
      },
      tokenSchema,
    );
    if ('error' in token) {
      throw new Error(`GitHub token exchange failed: ${token.error}`);
    }
    const user = await fetchJson(
      USER_URL,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.access_token}`,
          'User-Agent': 'system-design-sandbox',
        },
      },
      userSchema,
    );
    return {
      id: String(user.id),
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    };
  }
}
