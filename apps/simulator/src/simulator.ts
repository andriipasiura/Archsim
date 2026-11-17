import {
  SIM_JOB_TIMEOUT_MS,
  SIM_QUEUE,
  SIM_TICK_MS,
  simControlChannel,
  simControlKey,
  simEventsChannel,
  type SimControl,
  type SimJobData,
  type SimServerMessage,
} from '@sds/shared';
import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { SimulationRun, type RunOutcome } from './run.ts';

const CONCURRENCY = 16;

export interface SimulatorOptions {
  redisUrl: string;
  intervalMs?: number;
  timeoutMs?: number;
}

export interface Simulator {
  close(): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Simulation failed';
}

export function startSimulator({
  redisUrl,
  intervalMs = SIM_TICK_MS,
  timeoutMs = SIM_JOB_TIMEOUT_MS,
}: SimulatorOptions): Simulator {
  const redis = new Redis(redisUrl);
  const subscriber = new Redis(redisUrl);
  const listeners = new Map<string, (raw: string) => void>();
  const shutdown = new AbortController();

  for (const client of [redis, subscriber]) {
    client.on('error', (error) => console.error('Redis error:', error.message));
  }
  subscriber.on('message', (channel: string, raw: string) => {
    try {
      listeners.get(channel)?.(raw);
    } catch (error) {
      console.error(`Bad message on ${channel}:`, errorMessage(error));
    }
  });

  async function processJob(job: Job<SimJobData>): Promise<RunOutcome> {
    const id = job.id!;
    const events = simEventsChannel(id);
    const publish = (message: SimServerMessage) =>
      redis
        .publish(events, JSON.stringify(message))
        .catch((error: Error) =>
          console.error(`Publish failed for ${id}:`, error.message),
        );

    const run = new SimulationRun(job.data, (m) => void publish(m));
    const control = simControlChannel(id);
    const timeout = AbortSignal.timeout(timeoutMs);
    listeners.set(control, (raw) => run.apply(JSON.parse(raw) as SimControl));
    try {
      await subscriber.subscribe(control);
      const latest = await redis.get(simControlKey(id));
      if (latest) run.apply(JSON.parse(latest) as SimControl);
      return await run.run(
        AbortSignal.any([shutdown.signal, timeout]),
        intervalMs,
      );
    } catch (error) {
      const message = timeout.aborted
        ? 'Simulation timed out'
        : shutdown.signal.aborted
          ? 'The simulation server is restarting'
          : errorMessage(error);
      await publish({ type: 'error', message });
      throw new Error(message, { cause: error });
    } finally {
      listeners.delete(control);
      await subscriber.unsubscribe(control).catch(() => undefined);
    }
  }

  const worker = new Worker<SimJobData, RunOutcome>(SIM_QUEUE, processJob, {
    connection: { url: redisUrl },
    concurrency: CONCURRENCY,
    maxStalledCount: 0,
  });
  worker.on('failed', (job, error) =>
    console.error(`Simulation ${job?.id} failed:`, error.message),
  );
  worker.on('error', (error) => console.error('Worker error:', error.message));

  return {
    async close() {
      shutdown.abort(new Error('shutdown'));
      await worker.close();
      await Promise.all([redis.quit(), subscriber.quit()]);
    },
  };
}
