import { cn } from '@/lib/utils';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { BLOCK_META } from '@/features/blocks';
import { NODE_SIZE } from '@/features/blocks';
import type { BlockNode } from '@/features/diagram';
import { BlockIcon } from '@/features/blocks';

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

const handleClass =
  '!size-2.5 opacity-40 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100';

function BlockNodeView({ data, selected }: NodeProps<BlockNode>) {
  const { replicas, capacityRps } = data.params;

  return (
    <div
      data-selected={selected}
      style={{ width: NODE_SIZE.width, minHeight: NODE_SIZE.height }}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border bg-card p-2 text-card-foreground shadow-sm transition-shadow hover:shadow-md',
        selected && 'border-primary ring-3 ring-primary/25',
      )}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <BlockIcon type={data.type} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">
          {data.name || BLOCK_META[data.type].label}
        </span>
        <span className="text-xs text-muted-foreground">
          {replicas} × {compact.format(capacityRps)} rps
        </span>
      </div>
      <span
        className="size-2.5 shrink-0 self-start rounded-full bg-status-ok"
        role="img"
        aria-label="Status: healthy"
        title="Healthy"
      />
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

export default memo(BlockNodeView);
