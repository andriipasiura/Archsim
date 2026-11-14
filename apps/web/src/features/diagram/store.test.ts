import { DEFAULT_PARAMS } from '@sds/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMIT } from './constants';
import { fromDiagram } from './diagram-mapping';
import { EXAMPLE_DIAGRAM } from './example-diagram';
import { selectSingleSelected, useEditor } from './store';

const state = () => useEditor.getState();
const node = (id: string) => state().nodes.find((n) => n.id === id)!;

beforeEach(() => {
  useEditor.setState(
    { ...useEditor.getInitialState(), ...fromDiagram(EXAMPLE_DIAGRAM) },
    true,
  );
});

describe('editor store', () => {
  it('adds a block with defaults, a unique name, and selects it', () => {
    state().addBlock('service', { x: 10, y: 20 });
    state().addBlock('service', { x: 30, y: 40 });

    const added = state().nodes.slice(-2);
    expect(added.map((n) => n.data.name)).toEqual(['Service', 'Service 2']);
    expect(added[1]!.data.params).toEqual(DEFAULT_PARAMS.service);
    expect(selectSingleSelected(state())?.id).toBe(added[1]!.id);
  });

  it('undoes and redoes an add', () => {
    const before = state().nodes.length;
    state().addBlock('cdn', { x: 0, y: 0 });
    state().undo();
    expect(state().nodes).toHaveLength(before);
    state().redo();
    expect(state().nodes).toHaveLength(before + 1);
  });

  it('rejects self-loops and duplicate edges without touching history', () => {
    const edgeCount = state().edges.length;
    state().connect({
      source: 'api',
      target: 'api',
      sourceHandle: null,
      targetHandle: null,
    });
    state().connect({
      source: 'cdn',
      target: 'lb',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(state().edges).toHaveLength(edgeCount);
    expect(state().past).toHaveLength(0);

    state().connect({
      source: 'cache',
      target: 'db',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(state().edges).toHaveLength(edgeCount + 1);
  });

  it('makes a whole drag one undo step', () => {
    const start = node('api').position;
    state().checkpoint();
    for (const x of [600, 650, 700]) {
      state().onNodesChange([
        { type: 'position', id: 'api', position: { x, y: 0 }, dragging: true },
      ]);
    }
    expect(node('api').position.x).toBe(700);
    state().undo();
    expect(node('api').position).toEqual(start);
  });

  it('restores a deleted node together with its edges on undo', () => {
    state().checkpoint();
    state().onNodesChange([{ type: 'remove', id: 'api' }]);
    state().onEdgesChange(
      ['lb-api', 'api-cache', 'api-db', 'api-jobs'].map((id) => ({
        type: 'remove' as const,
        id,
      })),
    );
    state().undo();
    expect(state().nodes).toHaveLength(EXAMPLE_DIAGRAM.nodes.length);
    expect(state().edges).toHaveLength(EXAMPLE_DIAGRAM.edges.length);
  });

  it('updates params, ignoring no-ops and params the block type lacks', () => {
    state().updateParam('api', 'replicas', DEFAULT_PARAMS.service.replicas);
    expect(state().past).toHaveLength(0);

    state().updateParam('api', 'hitRate', 0.5);
    expect(node('api').data.params).not.toHaveProperty('hitRate');
    expect(state().past).toHaveLength(0);

    state().updateParam('cache', 'hitRate', 0.5);
    expect(node('cache').data.params).toMatchObject({ hitRate: 0.5 });
    state().undo();
    expect(node('cache').data.params).toMatchObject({
      hitRate: DEFAULT_PARAMS.redis.hitRate,
    });
  });

  it('renames only when the name changes', () => {
    state().renameBlock('api', 'API service');
    expect(state().past).toHaveLength(0);
    state().renameBlock('api', 'Gateway');
    expect(node('api').data.name).toBe('Gateway');
  });

  it('clears redo after a new action', () => {
    state().renameBlock('api', 'A');
    state().undo();
    expect(state().future).toHaveLength(1);
    state().renameBlock('api', 'B');
    expect(state().future).toHaveLength(0);
  });

  it('skips duplicate consecutive snapshots', () => {
    state().checkpoint();
    state().checkpoint();
    expect(state().past).toHaveLength(1);
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    for (let i = 0; i <= HISTORY_LIMIT + 5; i++)
      state().renameBlock('api', `name ${i}`);
    expect(state().past).toHaveLength(HISTORY_LIMIT);
  });

  it('replaces the diagram as one undoable step', () => {
    state().replaceDiagram({ version: 1, nodes: [], edges: [] });
    expect(state().nodes).toHaveLength(0);
    state().undo();
    expect(state().nodes).toHaveLength(EXAMPLE_DIAGRAM.nodes.length);
  });
});
