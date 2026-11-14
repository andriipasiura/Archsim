import type { BlockType } from '@sds/shared';
import { useStoreApi } from '@xyflow/react';
import { useCallback, type DragEvent } from 'react';
import { BLOCK_GROUPS, BLOCK_META } from '@/features/blocks';
import { ADD_CASCADE } from '../constants';
import { BLOCK_DRAG_MIME, NODE_SIZE } from '@/features/blocks';
import { useEditor } from '@/features/diagram';

function useAddBlockAtCenter() {
  const flowStore = useStoreApi();
  return useCallback(
    (type: BlockType) => {
      const { width, height, transform } = flowStore.getState();
      const [panX, panY, zoom] = transform;
      const { nodes, addBlock } = useEditor.getState();
      const offset = (nodes.length % ADD_CASCADE.steps) * ADD_CASCADE.stepPx;
      addBlock(type, {
        x: (width / 2 - panX) / zoom - NODE_SIZE.width / 2 + offset,
        y: (height / 2 - panY) / zoom - NODE_SIZE.height / 2 + offset,
      });
    },
    [flowStore],
  );
}

function onBlockDragStart(type: BlockType, event: DragEvent) {
  event.dataTransfer.setData(BLOCK_DRAG_MIME, type);
  event.dataTransfer.effectAllowed = 'copy';
}

export function usePalette() {
  const addAtCenter = useAddBlockAtCenter();
  return BLOCK_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.types.map((type) => ({
      type,
      ...BLOCK_META[type],
      add: () => addAtCenter(type),
      onDragStart: (event: DragEvent) => onBlockDragStart(type, event),
    })),
  }));
}
