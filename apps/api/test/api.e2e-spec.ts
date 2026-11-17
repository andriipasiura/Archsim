import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { NotFoundException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import {
  DEFAULT_PARAMS,
  SIM_QUEUE,
  simControlKey,
  simEventsChannel,
  type Diagram,
  type DiagramDetail,
  type OAuthProviderId,
  type Scenario,
  type SimClientMessage,
  type SimControl,
  type SimJobData,
  type SimServerMessage,
} from '@sds/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { WebSocket } from 'ws';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
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
  let redisContainer: StartedRedisContainer;
  let app: NestExpressApplication;
  let http: App;
  let port: number;

  beforeAll(async () => {
    [container, redisContainer] = await Promise.all([
      new PostgreSqlContainer('postgres:18-alpine').start(),
      new RedisContainer('redis:8-alpine').start(),
    ]);
    const env = {
      ...process.env,
      DATABASE_URL: container.getConnectionUri(),
      REDIS_URL: redisContainer.getConnectionUrl(),
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
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer() as App;
    port = (app.getHttpServer().address() as AddressInfo).port;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await Promise.all([container?.stop(), redisContainer?.stop()]);
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

  describe('simulations', () => {
    const scenario: Scenario = { rps: 1000, readRatio: 0.8, durationSec: 10 };
    const FINISHING_RPS = 1;
    let redis: Redis;
    let worker: Worker<SimJobData>;

    beforeAll(() => {
      redis = new Redis(redisContainer.getConnectionUrl());
      worker = new Worker<SimJobData>(
        SIM_QUEUE,
        async (job) => {
          if (job.data.scenario.rps !== FINISHING_RPS) return;
          const channel = simEventsChannel(job.id!);
          for (const tick of [1, 2]) {
            await redis.publish(
              channel,
              JSON.stringify({ type: 'tick', metrics: { tick } }),
            );
          }
          await redis.publish(channel, JSON.stringify({ type: 'done' }));
        },
        { connection: { url: redisContainer.getConnectionUrl() } },
      );
    });

    afterAll(async () => {
      await worker?.close();
      await redis?.quit();
    });

    function connect(cookie?: string, origin = WEB_URL) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/simulations`, {
        headers: { origin, ...(cookie && { cookie }) },
      });
      const messages: SimServerMessage[] = [];
      ws.on('message', (raw: Buffer) => {
        messages.push(JSON.parse(raw.toString()) as SimServerMessage);
      });
      const closed = once(ws, 'close');
      const opened = once(ws, 'open');
      const send = async (message: SimClientMessage) => {
        await opened;
        ws.send(JSON.stringify(message));
      };
      const start = (rps = scenario.rps) =>
        send({
          type: 'start',
          diagram: diagram(),
          scenario: { ...scenario, rps },
          seed: 1,
        });
      return { ws, messages, closed, send, start };
    }

    async function session(accountId: string) {
      const auth = app.get(AuthService);
      const user = await auth.upsertOAuthUser('github', {
        id: accountId,
        login: accountId,
        name: null,
        avatarUrl: null,
      });
      return {
        cookie: `sid=${await auth.createSession(user.id)}`,
        id: user.id,
      };
    }

    async function activeJobs(id: string): Promise<string[]> {
      return redis.zrange(`sim:user:${id}:active`, '0', '-1');
    }

    it('rejects a socket without a session or from another origin', async () => {
      const anonymous = connect();
      await anonymous.closed;
      expect(anonymous.messages).toEqual([
        { type: 'error', message: 'Sign in to run simulations on the server.' },
      ]);

      const { cookie } = await session('ws-origin');
      const foreign = connect(cookie, 'https://evil.test');
      await foreign.closed;
      expect(foreign.messages).toEqual([
        { type: 'error', message: 'Origin not allowed.' },
      ]);
    });

    it('forwards ticks and done from the worker, then closes', async () => {
      const { cookie, id } = await session('ws-stream');
      const client = connect(cookie);
      await client.start(FINISHING_RPS);
      await client.closed;

      expect(client.messages).toEqual([
        { type: 'tick', metrics: { tick: 1 } },
        { type: 'tick', metrics: { tick: 2 } },
        { type: 'done' },
      ]);
      await expect.poll(() => activeJobs(id)).toEqual([]);
    });

    it('limits concurrent runs per user, not across users', async () => {
      const alice = await session('ws-alice');
      const first = connect(alice.cookie);
      const second = connect(alice.cookie);
      await Promise.all([first.start(), second.start()]);
      await expect.poll(() => activeJobs(alice.id)).toHaveLength(2);

      const third = connect(alice.cookie);
      await third.start();
      await third.closed;
      expect(third.messages).toEqual([
        {
          type: 'error',
          message: 'You can run up to 2 server simulations at once.',
        },
      ]);

      const bob = await session('ws-bob');
      const parallel = connect(bob.cookie);
      await parallel.start(FINISHING_RPS);
      await parallel.closed;
      expect(parallel.messages.at(-1)).toEqual({ type: 'done' });

      first.ws.close();
      second.ws.close();
      await expect.poll(() => activeJobs(alice.id)).toEqual([]);
    });

    it('passes updates to the worker and cancels when the client leaves', async () => {
      const { cookie, id } = await session('ws-control');
      const client = connect(cookie);
      await client.start();
      await expect.poll(() => activeJobs(id)).toHaveLength(1);
      const [jobId] = await activeJobs(id);
      const control = async () =>
        JSON.parse(
          (await redis.get(simControlKey(jobId!))) ?? 'null',
        ) as SimControl | null;

      await client.send({
        type: 'scenario',
        scenario: { ...scenario, rps: 5000 },
      });
      await expect
        .poll(control)
        .toMatchObject({ rev: 1, scenario: { rps: 5000 }, cancelled: false });

      client.ws.close();
      await expect.poll(control).toMatchObject({ rev: 2, cancelled: true });
      await expect.poll(() => activeJobs(id)).toEqual([]);
    });

    it('closes the socket on an invalid message', async () => {
      const client = connect((await session('ws-invalid')).cookie);
      await client.send({
        type: 'scenario',
        scenario: { ...scenario, rps: -1 },
      });
      await client.closed;
      expect(client.messages).toEqual([
        {
          type: 'error',
          message: expect.stringContaining('Invalid message') as string,
        },
      ]);
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
