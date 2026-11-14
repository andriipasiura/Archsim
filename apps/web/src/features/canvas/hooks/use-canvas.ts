import { canConnect, isBlockType } from '@sds/shared';
import {
  useReactFlow,
  type Edge,
  type IsValidConnection,
  type ReactFlowProps,
} from '@xyflow/react';
import { useCallback, type DragEvent } from 'react';
import { BLOCK_DRAG_MIME, NODE_SIZE } from '@/features/blocks';
import type { BlockNode } from '@/features/diagram';
import { useEditor } from '@/features/diagram';

const isValidConnection: IsValidConnection<Edge> = ({ source, target }) =>
  canConnect(useEditor.getState().edges, source, target);

const checkpoint = () => useEditor.getState().checkpoint();
const checkpointBeforeDelete = async () => {
  checkpoint();
  return true;
};

const onDragOver = (event: DragEvent) => {
  if (!event.dataTransfer.types.includes(BLOCK_DRAG_MIME)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
};

export function useCanvas() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const connect = useEditor((s) => s.connect);
  const addBlock = useEditor((s) => s.addBlock);
  const { screenToFlowPosition } = useReactFlow();

  const onDrop = useCallback(
    (event: DragEvent) => {
      const type = event.dataTransfer.getData(BLOCK_DRAG_MIME);
      if (!isBlockType(type)) return;
      event.preventDefault();
      const point = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addBlock(type, {
        x: point.x - NODE_SIZE.width / 2,
        y: point.y - NODE_SIZE.height / 2,
      });
    },
    [screenToFlowPosition, addBlock],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect: connect,
    isValidConnection,
    onBeforeDelete: checkpointBeforeDelete,
    onNodeDragStart: checkpoint,
    onSelectionDragStart: checkpoint,
    onDragOver,
    onDrop,
  } satisfies ReactFlowProps<BlockNode, Edge>;
}
