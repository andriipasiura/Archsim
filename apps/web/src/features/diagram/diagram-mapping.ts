import {
  DEFAULT_PARAMS,
  DIAGRAM_VERSION,
  type BlockType,
  type Diagram,
  type DiagramNode,
} from '@sds/shared';
import {
  MarkerType,
  type Edge,
  type Node,
  type XYPosition,
} from '@xyflow/react';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type BlockData = DistributiveOmit<DiagramNode, 'id' | 'position'>;
export const BLOCK_NODE_TYPE = 'block';
export type BlockNode = Node<BlockData, typeof BLOCK_NODE_TYPE>;

export function createBlock(
  type: BlockType,
  id: string,
  name: string,
  position: XYPosition,
): DiagramNode {
  return {
    id,
    type,
    name,
    position,
    params: { ...DEFAULT_PARAMS[type] },
  } as DiagramNode;
}

export function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, markerEnd: { type: MarkerType.ArrowClosed } };
}

export function toFlowNode(node: DiagramNode): BlockNode {
  const { id, position, ...data } = node;
  return { id, type: BLOCK_NODE_TYPE, position: { ...position }, data };
}

export function fromDiagram(diagram: Diagram): {
  nodes: BlockNode[];
  edges: Edge[];
} {
  return {
    nodes: diagram.nodes.map(toFlowNode),
    edges: diagram.edges.map((e) => makeEdge(e.id, e.source, e.target)),
  };
}

export function toDiagram(
  nodes: readonly BlockNode[],
  edges: readonly Edge[],
): Diagram {
  return {
    version: DIAGRAM_VERSION,
    nodes: nodes.map((n) => ({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
      ...n.data,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}
