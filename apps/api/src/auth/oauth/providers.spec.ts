import type { OAuthAppConfig } from '../../config.js';
import { GithubProvider } from './github.provider.js';
import { GoogleProvider } from './google.provider.js';

const app: OAuthAppConfig = {
  clientId: 'client',
  clientSecret: 'secret',
  callbackUrl: 'http://web.test/api/auth/x/callback',
};

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('GoogleProvider', () => {
  const google = new GoogleProvider(app);

  it('builds an OpenID Connect authorization URL', () => {
    const url = new URL(google.authorizeUrl('st'));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client',
      redirect_uri: app.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'st',
    });
  });

  it('exchanges the code and maps userinfo to a profile', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'tok', id_token: 'x' }))
      .mockResolvedValueOnce(
        json({
          sub: '123',
          email: 'ada@example.com',
          name: 'Ada',
          picture: 'https://img.test/a.png',
        }),
      );

    await expect(google.fetchProfile('code')).resolves.toEqual({
      id: '123',
      login: 'ada@example.com',
      name: 'Ada',
      avatarUrl: 'https://img.test/a.png',
    });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(tokenInit!.body as string);
    expect(Object.fromEntries(form)).toMatchObject({
      code: 'code',
      grant_type: 'authorization_code',
      redirect_uri: app.callbackUrl,
    });
    const userinfoInit = fetchMock.mock.calls[1]![1]!;
    expect(userinfoInit.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('fails when Google rejects the code', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));
    await expect(google.fetchProfile('bad')).rejects.toThrow(/HTTP 400/);
  });
});

describe('GithubProvider', () => {
  const github = new GithubProvider(app);

  it('maps the GitHub user to a profile', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'tok' }))
      .mockResolvedValueOnce(
        json({ id: 42, login: 'ada', name: null, avatar_url: null }),
      );
    await expect(github.fetchProfile('code')).resolves.toEqual({
      id: '42',
      login: 'ada',
      name: null,
      avatarUrl: null,
    });
  });

  it('fails on a token error reported with HTTP 200', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'bad_verification_code' }));
    await expect(github.fetchProfile('bad')).rejects.toThrow(
      /bad_verification_code/,
    );
  });
});
