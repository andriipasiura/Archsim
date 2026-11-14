import type { ParamKey } from '@sds/shared';

export interface ParamFieldSpec {
  key: ParamKey;
  label: string;
  unit: string;
  displayScale: number;
}

export const PARAM_FIELDS: readonly ParamFieldSpec[] = [
  {
    key: 'capacityRps',
    label: 'Capacity per replica',
    unit: 'RPS',
    displayScale: 1,
  },
  { key: 'replicas', label: 'Replicas', unit: '', displayScale: 1 },
  { key: 'baseLatencyMs', label: 'Base latency', unit: 'ms', displayScale: 1 },
  { key: 'queueSize', label: 'Queue size', unit: 'requests', displayScale: 1 },
  { key: 'timeoutMs', label: 'Timeout', unit: 'ms', displayScale: 1 },
  { key: 'hitRate', label: 'Hit rate', unit: '%', displayScale: 100 },
];
