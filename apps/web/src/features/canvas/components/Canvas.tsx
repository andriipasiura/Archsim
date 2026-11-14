import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import { CANVAS_GRID, DELETE_KEYS, FIT_VIEW_OPTIONS } from '../constants';
import { BLOCK_NODE_TYPE, type BlockNode } from '@/features/diagram';
import { useCanvas } from '../hooks/use-canvas';
import BlockNodeView from './BlockNodeView';
import { CanvasOverlays, type CanvasOverlaysProps } from './CanvasOverlays';

const nodeTypes: NodeTypes = { [BLOCK_NODE_TYPE]: BlockNodeView };

export function Canvas(overlays: CanvasOverlaysProps) {
  const canvas = useCanvas();
  return (
    <ReactFlow<BlockNode, Edge>
      {...canvas}
      nodeTypes={nodeTypes}
      deleteKeyCode={DELETE_KEYS}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={CANVAS_GRID.gap}
        size={CANVAS_GRID.dotSize}
      />
      <MiniMap
        pannable
        zoomable
        className="overflow-hidden rounded-lg border shadow-sm"
      />
      <CanvasOverlays {...overlays} />
    </ReactFlow>
  );
}
