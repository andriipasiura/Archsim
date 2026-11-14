import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './block-defaults.js';
import { BLOCK_TYPES } from './block-type.js';
import { canConnect, parseDiagram, type Diagram } from './diagram.js';

function validDiagram(): Diagram {
  return {
    version: 1,
    nodes: [
      {
        id: 'a',
        type: 'service',
        name: 'API',
        position: { x: 0, y: 0 },
        params: { ...DEFAULT_PARAMS.service },
      },
      {
        id: 'b',
        type: 'redis',
        name: 'Cache',
        position: { x: 200, y: 0 },
        params: { ...DEFAULT_PARAMS.redis },
      },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
  };
}

function expectError(input: unknown, fragment: string) {
  const result = parseDiagram(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain(fragment);
}

describe('parseDiagram', () => {
  it('accepts a valid diagram', () => {
    const input = validDiagram();
    expect(parseDiagram(input)).toEqual({ ok: true, diagram: input });
  });

  it('accepts every block type with its default params', () => {
    const nodes = BLOCK_TYPES.map((type, i) => ({
      id: String(i),
      type,
      name: type,
      position: { x: 0, y: 0 },
      params: DEFAULT_PARAMS[type],
    }));
    expect(parseDiagram({ version: 1, nodes, edges: [] }).ok).toBe(true);
  });

  it('rejects non-objects and unknown versions', () => {
    expect(parseDiagram(null).ok).toBe(false);
    expect(parseDiagram('{}').ok).toBe(false);
    expect(parseDiagram({ ...validDiagram(), version: 2 }).ok).toBe(false);
  });

  it('rejects out-of-range params', () => {
    const d = validDiagram();
    d.nodes[0]!.params.replicas = 0;
    expectError(d, 'replicas');

    const fractional = validDiagram();
    fractional.nodes[0]!.params.queueSize = 1.5;
    expectError(fractional, 'queueSize');

    const hit = validDiagram();
    (hit.nodes[1]!.params as { hitRate: number }).hitRate = 1.2;
    expectError(hit, 'hitRate');
  });

  it('rejects a hit rate on a non-cache block and missing hit rate on a cache', () => {
    const extra = validDiagram();
    Object.assign(extra.nodes[0]!.params, { hitRate: 0.5 });
    expect(parseDiagram(extra).ok).toBe(false);

    const missing = validDiagram();
    delete (missing.nodes[1]!.params as { hitRate?: number }).hitRate;
    expectError(missing, 'hitRate');
  });

  it('rejects unknown block types', () => {
    const d = validDiagram() as { nodes: { type: string }[] };
    d.nodes[0]!.type = 'mongodb';
    expect(parseDiagram(d).ok).toBe(false);
  });

  it('rejects duplicate node ids', () => {
    const d = validDiagram();
    d.nodes[1]!.id = 'a';
    expectError(d, 'Duplicate node id');
  });

  it('rejects edges to missing nodes', () => {
    const d = validDiagram();
    d.edges[0]!.target = 'ghost';
    expectError(d, 'not a node');
  });

  it('rejects self-loops and duplicate edges', () => {
    const loop = validDiagram();
    loop.edges[0]!.target = 'a';
    expectError(loop, 'Self-loop or duplicate edge');

    const dup = validDiagram();
    dup.edges.push({ id: 'e2', source: 'a', target: 'b' });
    expectError(dup, 'Self-loop or duplicate edge');
  });
});

describe('canConnect', () => {
  const edges = [{ source: 'a', target: 'b' }];

  it('allows a new edge, including the reverse direction', () => {
    expect(canConnect(edges, 'b', 'a')).toBe(true);
    expect(canConnect(edges, 'a', 'c')).toBe(true);
  });

  it('rejects self-loops and duplicates', () => {
    expect(canConnect(edges, 'a', 'a')).toBe(false);
    expect(canConnect(edges, 'a', 'b')).toBe(false);
  });
});
