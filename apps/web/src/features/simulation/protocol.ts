import type { Diagram } from '@sds/shared';
import type { Scenario, TickMetrics } from '@sds/sim-engine';

export type WorkerRequest =
  | { type: 'start'; diagram: Diagram; scenario: Scenario; seed: number }
  | { type: 'diagram'; diagram: Diagram }
  | { type: 'scenario'; scenario: Scenario };

export type WorkerResponse =
  { type: 'tick'; metrics: TickMetrics } | { type: 'done' };
