import type { BlockType } from './block-type.js';
import type { BlockParams } from './diagram.js';

export const DEFAULT_PARAMS: { readonly [T in BlockType]: BlockParams<T> } = {
  'load-balancer': {
    capacityRps: 10_000,
    replicas: 2,
    baseLatencyMs: 1,
    queueSize: 1000,
    timeoutMs: 30_000,
  },
  service: {
    capacityRps: 500,
    replicas: 3,
    baseLatencyMs: 20,
    queueSize: 100,
    timeoutMs: 5000,
  },
  postgres: {
    capacityRps: 1000,
    replicas: 1,
    baseLatencyMs: 5,
    queueSize: 100,
    timeoutMs: 5000,
  },
  redis: {
    capacityRps: 50_000,
    replicas: 1,
    baseLatencyMs: 1,
    queueSize: 1000,
    timeoutMs: 1000,
    hitRate: 0.8,
  },
  queue: {
    capacityRps: 5000,
    replicas: 1,
    baseLatencyMs: 2,
    queueSize: 100_000,
    timeoutMs: 60_000,
  },
  cdn: {
    capacityRps: 100_000,
    replicas: 1,
    baseLatencyMs: 10,
    queueSize: 1000,
    timeoutMs: 10_000,
    hitRate: 0.9,
  },
};
