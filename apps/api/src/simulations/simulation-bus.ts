import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { simControlChannel, simControlKey, type SimControl } from '@sds/shared';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config.js';

const ACQUIRE_SLOT = `
local key, now, limit, member, ttl =
  KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), ARGV[3], tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
if redis.call('ZCARD', key) >= limit then return 0 end
redis.call('ZADD', key, now + ttl, member)
redis.call('PEXPIRE', key, ttl)
return 1
`;

const slotsKey = (userId: string) => `sim:user:${userId}:active`;

@Injectable()
export class SimulationBus implements OnModuleDestroy {
  private readonly logger = new Logger(SimulationBus.name);
  private readonly redis: Redis;
  private readonly subscriber: Redis;
  private readonly listeners = new Map<string, (raw: string) => void>();

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.redis = new Redis(config.redisUrl);
    this.subscriber = new Redis(config.redisUrl);
    for (const client of [this.redis, this.subscriber]) {
      client.on('error', (error: Error) =>
        this.logger.error(`Redis: ${error.message}`),
      );
    }
    this.subscriber.on('message', (channel: string, raw: string) => {
      try {
        this.listeners.get(channel)?.(raw);
      } catch (error) {
        this.logger.error(`Bad message on ${channel}`, error);
      }
    });
  }

  async subscribe(
    channel: string,
    listener: (raw: string) => void,
  ): Promise<void> {
    this.listeners.set(channel, listener);
    await this.subscriber.subscribe(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.listeners.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  async publishControl(
    jobId: string,
    control: SimControl,
    ttlMs: number,
  ): Promise<void> {
    const raw = JSON.stringify(control);
    await this.redis
      .multi()
      .set(simControlKey(jobId), raw, 'PX', ttlMs)
      .publish(simControlChannel(jobId), raw)
      .exec();
  }

  async acquireSlot(
    userId: string,
    jobId: string,
    limit: number,
    ttlMs: number,
  ): Promise<boolean> {
    const acquired = await this.redis.eval(
      ACQUIRE_SLOT,
      1,
      slotsKey(userId),
      Date.now(),
      limit,
      jobId,
      ttlMs,
    );
    return acquired === 1;
  }

  async releaseSlot(userId: string, jobId: string): Promise<void> {
    await this.redis.zrem(slotsKey(userId), jobId);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.redis.quit(), this.subscriber.quit()]);
  }
}
