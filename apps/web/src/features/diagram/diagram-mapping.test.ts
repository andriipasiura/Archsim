import { parseDiagram } from '@sds/shared';
import { describe, expect, it } from 'vitest';
import { fromDiagram, toDiagram } from './diagram-mapping';
import { EXAMPLE_DIAGRAM } from './example-diagram';

describe('diagram mapping', () => {
  it('ships a valid example diagram', () => {
    expect(parseDiagram(EXAMPLE_DIAGRAM).ok).toBe(true);
  });

  it('round-trips a diagram through React Flow nodes and edges', () => {
    const { nodes, edges } = fromDiagram(EXAMPLE_DIAGRAM);
    expect(toDiagram(nodes, edges)).toEqual(EXAMPLE_DIAGRAM);
  });

  it('drops React Flow UI state when converting back', () => {
    const { nodes, edges } = fromDiagram(EXAMPLE_DIAGRAM);
    const withUiState = nodes.map((n) => ({
      ...n,
      selected: true,
      dragging: true,
      measured: { width: 1, height: 1 },
    }));
    const diagram = toDiagram(withUiState, edges);
    expect(diagram).toEqual(EXAMPLE_DIAGRAM);
    expect(Object.keys(diagram.nodes[0]!).sort()).toEqual([
      'id',
      'name',
      'params',
      'position',
      'type',
    ]);
  });
});
