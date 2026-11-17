import { execFileSync } from 'node:child_process';
import { NotFoundException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  DEFAULT_PARAMS,
  type Diagram,
  type DiagramDetail,
  type OAuthProviderId,
} from '@sds/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type {
  OAuthProfile,
  OAuthProvider,
} from '../src/auth/oauth/oauth-provider.js';
import { OAuthProviders } from '../src/auth/oauth/oauth-providers.js';
import { configureApp } from '../src/setup.js';

const WEB_URL = 'http://web.test';

function fakeProvider(id: OAuthProviderId): OAuthProvider {
  return {
    id,
    authorizeUrl: (state) => `https://${id}.test/authorize?state=${state}`,
    fetchProfile: (code): Promise<OAuthProfile> => {
      if (code === 'bad') return Promise.reject(new Error('bad code'));
      return Promise.resolve({
        id: code,
        login: `${id}-${code}`,
        name: null,
        avatarUrl: null,
      });
    },
  };
}

const fakeProviders = new Map(
  (['github', 'google'] as const).map((id) => [id, fakeProvider(id)]),
);
const fakeRegistry: Pick<OAuthProviders, 'get' | 'available'> = {
  get: (id) => {
    const provider = fakeProviders.get(id as OAuthProviderId);
    if (!provider) throw new NotFoundException();
    return provider;
  },
  available: () => [...fakeProviders.keys()],
};

function diagram(name = 'API'): Diagram {
  return {
    version: 1,
    nodes: [
      {
        id: 'a',
        type: 'service',
        name,
        position: { x: 0, y: 0 },
        params: { ...DEFAULT_PARAMS.service },
      },
    ],
    edges: [],
  };
}

function cookiesOf(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  return header === undefined ? [] : [header].flat();
}

function cookieValue(res: request.Response, name: string): string | undefined {
  for (const c of cookiesOf(res)) {
    const [pair] = c.split(';');
    const [key, value] = pair!.split('=');
    if (key === name && value) return value;
  }
  return undefined;
}

describe('API (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestExpressApplication;
  let http: App;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
    const env = {
      ...process.env,
      DATABASE_URL: container.getConnectionUri(),
      WEB_URL,
    };
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env,
      stdio: 'pipe',
    });
    Object.assign(process.env, env);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OAuthProviders)
      .useValue(fakeRegistry)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    http = app.getHttpServer() as App;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  async function signIn(
    accountId: string,
    provider: OAuthProviderId = 'github',
  ): Promise<string> {
    const start = await request(http).get(`/auth/${provider}`).expect(302);
    const state = cookieValue(start, 'oauth_state');
    expect(start.headers.location).toContain(`state=${state}`);

    const callback = await request(http)
      .get(`/auth/${provider}/callback?code=${accountId}&state=${state}`)
      .set('Cookie', `oauth_state=${state}`)
      .expect(302)
      .expect('Location', `${WEB_URL}/`);
    const sid = cookieValue(callback, 'sid');
    expect(sid).toBeDefined();
    expect(cookiesOf(callback).join()).toMatch(/HttpOnly/i);
    return `sid=${sid}`;
  }

  async function createDiagram(cookie: string, name = 'Shop') {
    const res = await request(http)
      .post('/diagrams')
      .set('Cookie', cookie)
      .send({ name, content: diagram() })
      .expect(201);
    return res.body as DiagramDetail;
  }

  it('GET /health', async () => {
    await request(http).get('/health').expect(200).expect({ status: 'ok' });
  });

  describe('auth', () => {
    it('signs in, reports the user, and signs out', async () => {
      const cookie = await signIn('1');
      const me = await request(http)
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.body).toMatchObject({
        user: { login: 'github-1' },
        providers: ['github', 'google'],
      });

      await request(http)
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      await request(http)
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200)
        .expect({ user: null, providers: ['github', 'google'] });
    });

    it('signs in with Google as a separate user from GitHub', async () => {
      const google = await signIn('1', 'google');
      const github = await signIn('1', 'github');
      const a = await request(http).get('/auth/me').set('Cookie', google);
      const b = await request(http).get('/auth/me').set('Cookie', github);
      expect(a.body.user.login).toBe('google-1');
      expect(a.body.user.id).not.toBe(b.body.user.id);
    });

    it('404s for an unknown provider', async () => {
      await request(http).get('/auth/myspace').expect(404);
      await request(http)
        .get('/auth/myspace/callback?code=1&state=s')
        .set('Cookie', 'oauth_state=s')
        .expect(404);
    });

    it('reuses the same user on a second sign-in', async () => {
      const first = await signIn('2');
      const second = await signIn('2');
      const a = await request(http).get('/auth/me').set('Cookie', first);
      const b = await request(http).get('/auth/me').set('Cookie', second);
      expect(a.body.user.id).toBe(b.body.user.id);
    });

    it('rejects a callback whose state does not match the cookie', async () => {
      const res = await request(http)
        .get('/auth/github/callback?code=3&state=forged')
        .set('Cookie', 'oauth_state=other')
        .expect(302)
        .expect('Location', `${WEB_URL}/?auth_error=1`);
      expect(cookieValue(res, 'sid')).toBeUndefined();
    });

    it('redirects with an error when GitHub rejects the code', async () => {
      await request(http)
        .get('/auth/github/callback?code=bad&state=s')
        .set('Cookie', 'oauth_state=s')
        .expect(302)
        .expect('Location', `${WEB_URL}/?auth_error=1`);
    });

    it('treats an unknown session cookie as signed out', async () => {
      const res = await request(http)
        .get('/auth/me')
        .set('Cookie', 'sid=nope')
        .expect(200);
      expect(res.body.user).toBeNull();
    });
  });

  describe('diagrams', () => {
    let alice: string;
    let bob: string;

    beforeAll(async () => {
      alice = await signIn('alice');
      bob = await signIn('bob');
    });

    it('requires a session', async () => {
      await request(http).get('/diagrams').expect(401);
      await request(http).get('/diagrams').set('Cookie', 'sid=x').expect(401);
    });

    it('creates, lists, gets and deletes a diagram', async () => {
      const created = await createDiagram(alice, '  Shop  ');
      expect(created).toMatchObject({ name: 'Shop', version: 1 });
      expect(created.content).toEqual(diagram());

      const list = await request(http)
        .get('/diagrams')
        .set('Cookie', alice)
        .expect(200);
      expect(list.body).toContainEqual(
        expect.objectContaining({ id: created.id, name: 'Shop', version: 1 }),
      );

      const got = await request(http)
        .get(`/diagrams/${created.id}`)
        .set('Cookie', alice)
        .expect(200);
      expect(got.body).toEqual(created);

      await request(http)
        .delete(`/diagrams/${created.id}`)
        .set('Cookie', alice)
        .expect(204);
      await request(http)
        .get(`/diagrams/${created.id}`)
        .set('Cookie', alice)
        .expect(404);
    });

    it("hides other users' diagrams behind 404", async () => {
      const { id } = await createDiagram(alice);
      await request(http).get(`/diagrams/${id}`).set('Cookie', bob).expect(404);
      await request(http)
        .put(`/diagrams/${id}`)
        .set('Cookie', bob)
        .send({ name: 'x', content: diagram(), baseVersion: 1 })
        .expect(404);
      await request(http)
        .delete(`/diagrams/${id}`)
        .set('Cookie', bob)
        .expect(404);
      await request(http)
        .post(`/diagrams/${id}/versions/1/restore`)
        .set('Cookie', bob)
        .expect(404);
      const list = await request(http).get('/diagrams').set('Cookie', bob);
      expect(list.body).toEqual([]);
    });

    it('validates input', async () => {
      const bad = diagram();
      bad.nodes[0]!.params.replicas = 0;
      const res = await request(http)
        .post('/diagrams')
        .set('Cookie', alice)
        .send({ name: 'x', content: bad })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('replicas');

      await request(http)
        .post('/diagrams')
        .set('Cookie', alice)
        .send({ name: '', content: diagram() })
        .expect(400);
      await request(http)
        .get('/diagrams/not-a-uuid')
        .set('Cookie', alice)
        .expect(400);
    });

    it('saves new versions and rejects a stale base version', async () => {
      const { id } = await createDiagram(alice);
      const saved = await request(http)
        .put(`/diagrams/${id}`)
        .set('Cookie', alice)
        .send({ name: 'Renamed', content: diagram('v2'), baseVersion: 1 })
        .expect(200);
      expect(saved.body).toMatchObject({ name: 'Renamed', version: 2 });

      const stale = await request(http)
        .put(`/diagrams/${id}`)
        .set('Cookie', alice)
        .send({ name: 'Other', content: diagram('lost'), baseVersion: 1 })
        .expect(409);
      expect(stale.body.message).toContain('version 2');

      const got = await request(http)
        .get(`/diagrams/${id}`)
        .set('Cookie', alice);
      expect(got.body.content).toEqual(diagram('v2'));
    });

    it('lets only one of two concurrent saves win', async () => {
      const { id } = await createDiagram(alice);
      const save = (label: string) =>
        request(http)
          .put(`/diagrams/${id}`)
          .set('Cookie', alice)
          .send({ name: label, content: diagram(label), baseVersion: 1 });
      const statuses = (await Promise.all([save('a'), save('b')])).map(
        (r) => r.status,
      );
      expect(statuses.sort()).toEqual([200, 409]);
    });

    it('lists versions and restores an old one as a new version', async () => {
      const { id } = await createDiagram(alice);
      await request(http)
        .put(`/diagrams/${id}`)
        .set('Cookie', alice)
        .send({ name: 'Shop', content: diagram('v2'), baseVersion: 1 })
        .expect(200);

      const restored = await request(http)
        .post(`/diagrams/${id}/versions/1/restore`)
        .set('Cookie', alice)
        .expect(201);
      expect(restored.body).toMatchObject({ version: 3 });
      expect(restored.body.content).toEqual(diagram());

      const versions = await request(http)
        .get(`/diagrams/${id}/versions`)
        .set('Cookie', alice)
        .expect(200);
      expect(
        (versions.body as { version: number }[]).map((v) => v.version),
      ).toEqual([3, 2, 1]);

      await request(http)
        .post(`/diagrams/${id}/versions/9/restore`)
        .set('Cookie', alice)
        .expect(404);
    });
  });

  it('rate-limits the sign-in endpoints', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await request(http).get('/auth/github')).status;
    }
    expect(last).toBe(429);
  });
});
