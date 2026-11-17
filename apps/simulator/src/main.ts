import { startSimulator } from './simulator.ts';

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
new URL(redisUrl);

const simulator = startSimulator({ redisUrl });
console.log('Simulator is waiting for jobs');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    simulator.close().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      },
    );
  });
}
