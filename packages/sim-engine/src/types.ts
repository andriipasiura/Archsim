export type {
  BlockMetrics,
  BlockState,
  OverallMetrics,
  Scenario,
  TickMetrics,
} from '@sds/shared';

export interface SimulationOptions {
  seed?: number;
  tickMs?: number;
}
