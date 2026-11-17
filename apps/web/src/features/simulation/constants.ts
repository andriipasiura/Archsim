import type { Scenario } from '@sds/shared';

export const SEED = 1;
export const HISTORY_POINTS = 600;

export const DEFAULT_SCENARIO: Scenario = {
  rps: 2000,
  readRatio: 0.8,
  durationSec: 120,
};

export const SIMULATION_SOCKET_PATH = '/api/simulations';
