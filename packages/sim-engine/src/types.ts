export interface Scenario {
  rps: number;
  readRatio: number;
  durationSec: number;
}

export interface SimulationOptions {
  seed?: number;
  tickMs?: number;
}

export type BlockState = 'ok' | 'warn' | 'critical';

export interface BlockMetrics {
  inRps: number;
  throughputRps: number;
  errorRps: number;
  errorRate: number;
  utilization: number;
  queueLength: number;
  latencyMs: number;
  p95Ms: number;
  p99Ms: number;
  state: BlockState;
}

export interface OverallMetrics {
  offeredRps: number;
  throughputRps: number;
  errorRate: number;
  p95Ms: number;
  p99Ms: number;
}

export interface TickMetrics {
  tick: number;
  timeSec: number;
  overall: OverallMetrics;
  blocks: Record<string, BlockMetrics>;
  edges: Record<string, number>;
}
