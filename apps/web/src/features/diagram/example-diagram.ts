import { DEFAULT_PARAMS, type Diagram } from '@sds/shared';

export const EXAMPLE_DIAGRAM: Diagram = {
  version: 1,
  nodes: [
    {
      id: 'cdn',
      type: 'cdn',
      name: 'CDN',
      position: { x: 0, y: 180 },
      params: { ...DEFAULT_PARAMS.cdn },
    },
    {
      id: 'lb',
      type: 'load-balancer',
      name: 'Load balancer',
      position: { x: 260, y: 180 },
      params: { ...DEFAULT_PARAMS['load-balancer'] },
    },
    {
      id: 'api',
      type: 'service',
      name: 'API service',
      position: { x: 520, y: 180 },
      params: { ...DEFAULT_PARAMS.service },
    },
    {
      id: 'cache',
      type: 'redis',
      name: 'Cache',
      position: { x: 800, y: 40 },
      params: { ...DEFAULT_PARAMS.redis },
    },
    {
      id: 'db',
      type: 'postgres',
      name: 'Primary DB',
      position: { x: 800, y: 180 },
      params: { ...DEFAULT_PARAMS.postgres },
    },
    {
      id: 'jobs',
      type: 'queue',
      name: 'Jobs queue',
      position: { x: 800, y: 320 },
      params: { ...DEFAULT_PARAMS.queue },
    },
  ],
  edges: [
    { id: 'cdn-lb', source: 'cdn', target: 'lb' },
    { id: 'lb-api', source: 'lb', target: 'api' },
    { id: 'api-cache', source: 'api', target: 'cache' },
    { id: 'api-db', source: 'api', target: 'db' },
    { id: 'api-jobs', source: 'api', target: 'jobs' },
  ],
};
