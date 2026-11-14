import {
  canConnect,
  type BlockType,
  type Diagram,
  type ParamKey,
} from '@sds/shared';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { create } from 'zustand';
import { BLOCK_META } from '@/features/blocks';
import { HISTORY_LIMIT } from './constants';
import {
  createBlock,
  fromDiagram,
  makeEdge,
  toDiagram,
  toFlowNode,
  type BlockData,
  type BlockNode,
} from './diagram-mapping';

interface EditorState {
  nodes: BlockNode[];
  edges: Edge[];
  past: Diagram[];
  future: Diagram[];
  notice: string | null;
}

interface EditorActions {
  onNodesChange(changes: NodeChange<BlockNode>[]): void;
  onEdgesChange(changes: EdgeChange[]): void;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  connect(connection: Connection): void;
  addBlock(type: BlockType, position: XYPosition): void;
  renameBlock(id: string, name: string): void;
  updateParam(id: string, key: ParamKey, value: number): void;
  replaceDiagram(diagram: Diagram): void;
  setNotice(notice: string | null): void;
}

export type EditorStore = EditorState & EditorActions;

const newId = () => crypto.randomUUID();

function uniqueName(nodes: readonly BlockNode[], base: string): string {
  const taken = new Set(nodes.map((n) => n.data.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function updateNode(
  nodes: BlockNode[],
  id: string,
  update: (data: BlockData) => BlockData,
): BlockNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, data: update(n.data) } : n));
}

export const useEditor = create<EditorStore>()((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  notice: null,

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  checkpoint: () => {
    const { nodes, edges, past } = get();
    const snapshot = toDiagram(nodes, edges);
    const last = past.at(-1);
    const isDuplicate =
      last !== undefined && JSON.stringify(last) === JSON.stringify(snapshot);
    set({
      past: isDuplicate ? past : [...past, snapshot].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  undo: () => {
    const { nodes, edges, past, future } = get();
    const previous = past.at(-1);
    if (!previous) return;
    set({
      ...fromDiagram(previous),
      past: past.slice(0, -1),
      future: [...future, toDiagram(nodes, edges)],
    });
  },

  redo: () => {
    const { nodes, edges, past, future } = get();
    const next = future.at(-1);
    if (!next) return;
    set({
      ...fromDiagram(next),
      past: [...past, toDiagram(nodes, edges)],
      future: future.slice(0, -1),
    });
  },

  connect: ({ source, target }) => {
    if (!canConnect(get().edges, source, target)) return;
    get().checkpoint();
    set({ edges: [...get().edges, makeEdge(newId(), source, target)] });
  },

  addBlock: (type, position) => {
    get().checkpoint();
    const nodes = get().nodes;
    const block = toFlowNode(
      createBlock(
        type,
        newId(),
        uniqueName(nodes, BLOCK_META[type].label),
        position,
      ),
    );
    set({
      nodes: [
        ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        { ...block, selected: true },
      ],
    });
  },

  renameBlock: (id, name) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || node.data.name === name) return;
    get().checkpoint();
    set({ nodes: updateNode(get().nodes, id, (data) => ({ ...data, name })) });
  },

  updateParam: (id, key, value) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || !(key in node.data.params)) return;
    if ((node.data.params as Record<string, number>)[key] === value) return;
    get().checkpoint();
    set({
      nodes: updateNode(
        get().nodes,
        id,
        (data) =>
          ({
            ...data,
            params: { ...data.params, [key]: value },
          }) as BlockData,
      ),
    });
  },

  replaceDiagram: (diagram) => {
    get().checkpoint();
    set(fromDiagram(diagram));
  },

  setNotice: (notice) => set({ notice }),
}));

export function selectSingleSelected(state: EditorStore): BlockNode | null {
  let found: BlockNode | null = null;
  for (const node of state.nodes) {
    if (!node.selected) continue;
    if (found) return null;
    found = node;
  }
  return found;
}
