import type { Scenario } from '@sds/sim-engine';

export const TICK_MS = 100;
export const SEED = 1;
export const HISTORY_POINTS = 600;

export const SCENARIO_LIMITS = {
  rps: { min: 0, max: 20_000, step: 100 },
  readRatio: { min: 0, max: 1, step: 0.05 },
  durationSec: { min: 10, max: 600, step: 10 },
} as const satisfies Record<keyof Scenario, object>;

export const DEFAULT_SCENARIO: Scenario = {
  rps: 2000,
  readRatio: 0.8,
  durationSec: 120,
};
