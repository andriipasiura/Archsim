import { z } from 'zod';
import { diagramSchema, type Diagram } from './diagram.js';

export const SIM_TICK_MS = 100;

export const SCENARIO_LIMITS = {
  rps: { min: 0, max: 20_000, step: 100 },
  readRatio: { min: 0, max: 1, step: 0.05 },
  durationSec: { min: 10, max: 600, step: 10 },
} as const;

const limited = ({ min, max }: { min: number; max: number }) =>
  z.number().min(min).max(max);

export const scenarioSchema = z.strictObject({
  rps: limited(SCENARIO_LIMITS.rps),
  readRatio: limited(SCENARIO_LIMITS.readRatio),
  durationSec: limited(SCENARIO_LIMITS.durationSec),
});

export type Scenario = z.infer<typeof scenarioSchema>;

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

export const simClientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('start'),
    diagram: diagramSchema,
    scenario: scenarioSchema,
    seed: z.number().int().min(0).max(0xffff_ffff),
  }),
  z.strictObject({ type: z.literal('diagram'), diagram: diagramSchema }),
  z.strictObject({ type: z.literal('scenario'), scenario: scenarioSchema }),
]);

export type SimClientMessage = z.infer<typeof simClientMessageSchema>;

export type SimServerMessage =
  | { type: 'tick'; metrics: TickMetrics }
  | { type: 'done' }
  | { type: 'error'; message: string };

export const SIM_QUEUE = 'simulations';

export const SIM_JOB_TIMEOUT_MS = (SCENARIO_LIMITS.durationSec.max + 60) * 1000;

export interface SimJobData {
  diagram: Diagram;
  scenario: Scenario;
  seed: number;
}

export interface SimControl {
  rev: number;
  diagram: Diagram;
  scenario: Scenario;
  cancelled: boolean;
}

export const simEventsChannel = (jobId: string) => `sim:${jobId}:events`;
export const simControlChannel = (jobId: string) => `sim:${jobId}:control`;
export const simControlKey = (jobId: string) => `sim:${jobId}:control:latest`;
