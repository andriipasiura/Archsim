import {
  DEFAULT_PARAMS,
  SIM_QUEUE,
  simControlKey,
  simEventsChannel,
  type SimControl,
  type SimJobData,
  type SimServerMessage,
} from '@sds/shared';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startSimulator, type Simulator } from './simulator.ts';

const job: SimJobData = {
  diagram: {
    version: 1,
    nodes: [
      {
        id: 'api',
        type: 'service',
        name: 'API',
        position: { x: 0, y: 0 },
        params: { ...DEFAULT_PARAMS.service },
      },
    ],
    edges: [],
  },
  scenario: { rps: 500, readRatio: 0.8, durationSec: 10 },
  seed: 1,
};

describe('simulator (integration)', () => {
  let container: StartedRedisContainer;
  let redis: Redis;
  let subscriber: Redis;
  let queue: Queue<SimJobData>;
  let simulator: Simulator;

  beforeAll(async () => {
    container = await new RedisContainer('redis:8-alpine').start();
    const redisUrl = container.getConnectionUrl();
    redis = new Redis(redisUrl);
    subscriber = new Redis(redisUrl);
    queue = new Queue(SIM_QUEUE, { connection: { url: redisUrl } });
    simulator = startSimulator({ redisUrl, intervalMs: 1 });
  }, 120_000);

  afterAll(async () => {
    await simulator?.close();
    await queue?.close();
    await Promise.all([redis?.quit(), subscriber?.quit()]);
    await container?.stop();
  });

  async function runJob(jobId: string, beforeEnqueue?: () => Promise<void>) {
    const channel = simEventsChannel(jobId);
    const messages: SimServerMessage[] = [];
    const finished = new Promise<SimServerMessage[]>((resolve) => {
      subscriber.on('message', (ch: string, raw: string) => {
        if (ch !== channel) return;
        const message = JSON.parse(raw) as SimServerMessage;
        messages.push(message);
        if (message.type !== 'tick') resolve(messages);
      });
    });
    await subscriber.subscribe(channel);
    await beforeEnqueue?.();
    await queue.add('run', job, { jobId });
    return finished;
  }

  it('streams every tick in order and then done', async () => {
    const messages = await runJob('streams');
    expect(messages).toHaveLength(101);
    expect(messages.at(-1)).toEqual({ type: 'done' });
    const ticks = messages.flatMap((m) => (m.type === 'tick' ? [m] : []));
    expect(ticks.map((m) => m.metrics.tick)).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 1),
    );
  });

  it('skips a job that was cancelled while it waited in the queue', async () => {
    const id = 'cancelled';
    const control: SimControl = { ...job, rev: 1, cancelled: true };
    const events: string[] = [];
    subscriber.on('message', (ch: string, raw: string) => {
      if (ch === simEventsChannel(id)) events.push(raw);
    });
    await subscriber.subscribe(simEventsChannel(id));
    await redis.set(simControlKey(id), JSON.stringify(control));
    const added = await queue.add('run', job, { jobId: id });

    await expect.poll(() => added.getState()).toBe('completed');
    expect(await queue.getJob(id).then((j) => j?.returnvalue)).toBe(
      'cancelled',
    );
    expect(events).toEqual([]);
  });
});

describe('simulator timeout (integration)', () => {
  it('publishes an error and fails the job', async () => {
    const container = await new RedisContainer('redis:8-alpine').start();
    const redisUrl = container.getConnectionUrl();
    const subscriber = new Redis(redisUrl);
    const queue = new Queue<SimJobData>(SIM_QUEUE, {
      connection: { url: redisUrl },
    });
    const simulator = startSimulator({ redisUrl, timeoutMs: 50 });
    try {
      const error = new Promise<unknown>((resolve) =>
        subscriber.on('message', (_: string, raw: string) => {
          const message = JSON.parse(raw) as SimServerMessage;
          if (message.type === 'error') resolve(message);
        }),
      );
      await subscriber.subscribe(simEventsChannel('slow'));
      const added = await queue.add('run', job, { jobId: 'slow' });

      expect(await error).toEqual({
        type: 'error',
        message: 'Simulation timed out',
      });
      await expect.poll(() => added.getState()).toBe('failed');
    } finally {
      await simulator.close();
      await queue.close();
      await subscriber.quit();
      await container.stop();
    }
  }, 120_000);
});
