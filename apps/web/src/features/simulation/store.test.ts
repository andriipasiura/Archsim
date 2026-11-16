import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import type { BlockNode } from '@/features/diagram';
import { diagramStructureChanged } from './store';

const node = (id: string): BlockNode =>
  ({
    id,
    type: 'block',
    position: { x: 0, y: 0 },
    data: { type: 'service', name: id, params: {} },
  }) as BlockNode;

const edge: Edge = { id: 'e', source: 'a', target: 'b' };
const base = { nodes: [node('a'), node('b')], edges: [edge] };

describe('diagramStructureChanged', () => {
  it('ignores moving and selecting', () => {
    const moved = {
      nodes: base.nodes.map((n) => ({
        ...n,
        position: { x: 5, y: 5 },
        selected: true,
      })),
      edges: [{ ...edge, selected: true }],
    };
    expect(diagramStructureChanged(base, moved)).toBe(false);
  });

  it('detects param edits, new blocks and new edges', () => {
    const edited = {
      ...base,
      nodes: [
        { ...base.nodes[0]!, data: { ...base.nodes[0]!.data } },
        base.nodes[1]!,
      ],
    };
    expect(diagramStructureChanged(base, edited)).toBe(true);
    expect(
      diagramStructureChanged(base, {
        ...base,
        nodes: [...base.nodes, node('c')],
      }),
    ).toBe(true);
    expect(
      diagramStructureChanged(base, {
        ...base,
        edges: [edge, { id: 'f', source: 'b', target: 'a' }],
      }),
    ).toBe(true);
  });
});
