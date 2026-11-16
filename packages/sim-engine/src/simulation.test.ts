import {
  DEFAULT_PARAMS,
  type BlockType,
  type Diagram,
  type DiagramNode,
} from '@sds/shared';
import { describe, expect, it } from 'vitest';
import { Simulation, percentile, simulate } from './simulation.js';
import type { Scenario, TickMetrics } from './types.js';

function node(
  id: string,
  type: BlockType,
  params: Partial<DiagramNode['params']> = {},
): DiagramNode {
  return {
    id,
    type,
    name: id,
    position: { x: 0, y: 0 },
    params: { ...DEFAULT_PARAMS[type], ...params },
  } as DiagramNode;
}

function diagram(
  nodes: DiagramNode[],
  edges: [string, string][] = [],
): Diagram {
  return {
    version: 1,
    nodes,
    edges: edges.map(([source, target]) => ({
      id: `${source}-${target}`,
      source,
      target,
    })),
  };
}

const AVERAGE_TICKS = 30;

function last(d: Diagram, scenario: Partial<Scenario>): TickMetrics {
  const ticks = [
    ...simulate(d, { rps: 1000, readRatio: 0.9, durationSec: 10, ...scenario }),
  ];
  const tail = ticks.slice(-AVERAGE_TICKS);
  const mean = (get: (t: TickMetrics) => number | undefined) =>
    tail.reduce((sum, t) => sum + (get(t) ?? 0), 0) / tail.length;
  const result = structuredClone(ticks.at(-1)!);
  for (const [id, block] of Object.entries(result.blocks)) {
    block.inRps = mean((t) => t.blocks[id]?.inRps);
    block.throughputRps = mean((t) => t.blocks[id]?.throughputRps);
    block.errorRps = mean((t) => t.blocks[id]?.errorRps);
    block.latencyMs = mean((t) => t.blocks[id]?.latencyMs);
  }
  for (const id of Object.keys(result.edges)) {
    result.edges[id] = mean((t) => t.edges[id]);
  }
  return result;
}

describe('single server', () => {
  const d = diagram([node('api', 'service')]);

  it('stays healthy below capacity', () => {
    const m = last(d, { rps: 600 });
    const api = m.blocks.api!;
    expect(api.state).toBe('ok');
    expect(api.errorRate).toBe(0);
    expect(api.utilization).toBeCloseTo(0.4, 1);
    expect(api.throughputRps).toBeCloseTo(600, -2);
    expect(m.overall.errorRate).toBe(0);
    expect(m.overall.p95Ms).toBeGreaterThan(20);
    expect(m.overall.p95Ms).toBeLessThan(80);
  });

  it('latency grows non-linearly near capacity', () => {
    const p95At = (rps: number) => last(d, { rps }).blocks.api!.latencyMs;
    const low = p95At(300);
    const mid = p95At(750);
    const high = p95At(1400);
    expect(mid - low).toBeLessThan(high - mid);
    expect(last(d, { rps: 1200 }).blocks.api!.state).toBe('warn');
  });
});

describe('overload', () => {
  it('caps throughput at capacity and drops the rest', () => {
    const m = last(diagram([node('api', 'service')]), { rps: 3000 });
    const api = m.blocks.api!;
    expect(api.state).toBe('critical');
    expect(api.utilization).toBeGreaterThan(1.5);
    expect(api.throughputRps).toBeCloseTo(1500, -2);
    expect(api.queueLength).toBe(100);
    expect(m.overall.errorRate).toBeGreaterThan(0.35);
    expect(m.overall.errorRate).toBeLessThan(0.65);
  });
});

describe('cache', () => {
  const api = node('api', 'service', { replicas: 10 });
  const db = node('db', 'postgres');
  const scenario = { rps: 1200, readRatio: 0.9 };

  it('takes reads off the database', () => {
    const without = last(diagram([api, db], [['api', 'db']]), scenario);
    const withCache = last(
      diagram(
        [api, db, node('cache', 'redis')],
        [
          ['api', 'cache'],
          ['api', 'db'],
        ],
      ),
      scenario,
    );

    expect(without.blocks.db!.state).toBe('critical');
    expect(without.overall.errorRate).toBeGreaterThan(0.05);

    expect(withCache.blocks.db!.inRps).toBeCloseTo(336, -1);
    expect(withCache.blocks.db!.state).toBe('ok');
    expect(withCache.blocks.cache!.inRps).toBeCloseTo(1080, -2);
    expect(withCache.overall.errorRate).toBe(0);
    expect(withCache.overall.p95Ms).toBeLessThan(without.overall.p95Ms);
  });

  it('a CDN answers hits and forwards misses and writes', () => {
    const m = last(
      diagram(
        [node('cdn', 'cdn'), node('api', 'service', { replicas: 10 })],
        [['cdn', 'api']],
      ),
      { rps: 1000, readRatio: 0.5 },
    );
    expect(Math.abs(m.edges['cdn-api']! - 550)).toBeLessThan(20);
  });
});

describe('cascade', () => {
  const run = (dbCapacity: number) =>
    last(
      diagram(
        [
          node('api', 'service'),
          node('db', 'postgres', { capacityRps: dbCapacity }),
        ],
        [['api', 'db']],
      ),
      { rps: 800, readRatio: 0.5 },
    );

  it('a slow database ties up service workers', () => {
    const healthy = run(5000);
    expect(healthy.blocks.api!.state).toBe('ok');

    const slow = run(500);
    expect(slow.blocks.db!.state).toBe('critical');
    expect(slow.blocks.api!.state).toBe('critical');
    expect(slow.blocks.api!.errorRps).toBeGreaterThan(0);
    expect(slow.blocks.api!.throughputRps).toBeLessThan(600);
  });

  it('a queue decouples producers from slow consumers', () => {
    const m = last(
      diagram(
        [
          node('api', 'service'),
          node('jobs', 'queue'),
          node('worker', 'service', { capacityRps: 10, replicas: 1 }),
        ],
        [
          ['api', 'jobs'],
          ['jobs', 'worker'],
        ],
      ),
      { rps: 1000, readRatio: 0 },
    );
    expect(m.blocks.worker!.state).toBe('critical');
    expect(m.blocks.api!.state).not.toBe('critical');
    expect(m.overall.errorRate).toBe(0);
  });
});

describe('routing', () => {
  it('splits load-balanced traffic evenly', () => {
    const m = last(
      diagram(
        [
          node('lb', 'load-balancer'),
          node('a', 'service'),
          node('b', 'service'),
        ],
        [
          ['lb', 'a'],
          ['lb', 'b'],
        ],
      ),
      { rps: 1000 },
    );
    expect(m.blocks.a!.inRps).toBeCloseTo(500, -2);
    expect(m.blocks.b!.inRps).toBeCloseTo(500, -2);
  });

  it('ignores edges that close a cycle and unwired blocks', () => {
    const m = last(
      diagram(
        [node('a', 'service'), node('b', 'service'), node('idle', 'postgres')],
        [
          ['a', 'b'],
          ['b', 'a'],
        ],
      ),
      { rps: 500 },
    );
    expect(m.blocks.a!.inRps).toBeCloseTo(500, -2);
    expect(m.edges['b-a']).toBeUndefined();
    expect(m.blocks.idle!.inRps).toBe(0);
  });
});

describe('determinism', () => {
  const d = diagram(
    [
      node('lb', 'load-balancer'),
      node('api', 'service'),
      node('db', 'postgres'),
    ],
    [
      ['lb', 'api'],
      ['api', 'db'],
    ],
  );
  const scenario: Scenario = { rps: 1400, readRatio: 0.7, durationSec: 3 };

  it('produces identical output for the same seed', () => {
    const a = [...simulate(d, scenario, { seed: 42 })];
    const b = [...simulate(d, scenario, { seed: 42 })];
    expect(a).toEqual(b);
    expect(a).toHaveLength(30);
  });

  it('differs for another seed', () => {
    const a = [...simulate(d, scenario, { seed: 1 })];
    const b = [...simulate(d, scenario, { seed: 2 })];
    expect(a).not.toEqual(b);
  });
});

describe('live updates', () => {
  it('picks up a new diagram and keeps queues', () => {
    const api = node('api', 'service', { replicas: 10 });
    const db = node('db', 'postgres');
    const sim = new Simulation(diagram([api, db], [['api', 'db']]), {
      rps: 1200,
      readRatio: 0.9,
      durationSec: 60,
    });
    for (let i = 0; i < 50; i++) sim.step();
    const before = sim.step();
    expect(before.blocks.db!.state).toBe('critical');

    sim.setDiagram(
      diagram(
        [api, db, node('cache', 'redis')],
        [
          ['api', 'cache'],
          ['api', 'db'],
        ],
      ),
    );
    let after = sim.step();
    for (let i = 0; i < 50; i++) after = sim.step();
    expect(after.blocks.db!.state).toBe('ok');
    expect(after.overall.p95Ms).toBeLessThan(before.overall.p95Ms);
  });
});

describe('percentile', () => {
  it('uses nearest rank', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBe(95);
    expect(percentile(values, 0.99)).toBe(99);
    expect(percentile([], 0.95)).toBe(0);
  });
});
