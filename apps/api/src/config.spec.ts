import { loadConfig } from './config.js';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadConfig', () => {
  it('applies defaults and disables GitHub when it is not configured', () => {
    expect(
      loadConfig({ ...base, GITHUB_CLIENT_ID: '', GITHUB_CALLBACK_URL: '' }),
    ).toEqual({
      port: 3000,
      databaseUrl: base.DATABASE_URL,
      webUrl: 'http://localhost:5173',
      cookieSecure: false,
      oauth: { github: null, google: null },
    });
  });

  it('enables a provider only when all three values are set', () => {
    const github = {
      GITHUB_CLIENT_ID: 'id',
      GITHUB_CLIENT_SECRET: 'secret',
      GITHUB_CALLBACK_URL: 'http://localhost:5173/api/auth/github/callback',
    };
    expect(loadConfig({ ...base, ...github }).oauth.github).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      callbackUrl: github.GITHUB_CALLBACK_URL,
    });
    expect(
      loadConfig({ ...base, ...github, GITHUB_CLIENT_SECRET: '' }).oauth.github,
    ).toBeNull();
  });

  it('rejects a missing database URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
