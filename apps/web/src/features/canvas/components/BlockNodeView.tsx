import { cn } from '@/lib/utils';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { BLOCK_META } from '@/features/blocks';
import { NODE_SIZE } from '@/features/blocks';
import type { BlockNode } from '@/features/diagram';
import { BlockIcon } from '@/features/blocks';
import { useBlockStatus } from '@/features/simulation';

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

const STATUS = {
  ok: { label: 'Healthy', dot: 'bg-status-ok', border: '' },
  warn: {
    label: 'Under pressure',
    dot: 'bg-status-warn',
    border: 'border-status-warn',
  },
  critical: {
    label: 'Overloaded',
    dot: 'bg-status-critical',
    border: 'border-status-critical ring-3 ring-status-critical/25',
  },
} as const;

const handleClass =
  '!size-2.5 opacity-40 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100';

function BlockNodeView({ id, data, selected }: NodeProps<BlockNode>) {
  const { replicas, capacityRps } = data.params;
  const { state, load } = useBlockStatus(id);
  const status = STATUS[state ?? 'ok'];
  const statusLabel =
    load === null ? status.label : `${status.label}, ${load}% load`;

  return (
    <div
      data-selected={selected}
      style={{ width: NODE_SIZE.width, minHeight: NODE_SIZE.height }}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border bg-card p-2 text-card-foreground shadow-sm transition-[box-shadow,border-color] hover:shadow-md',
        status.border,
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
          {load !== null && ` · ${load}%`}
        </span>
      </div>
      <span
        className={cn('size-2.5 shrink-0 self-start rounded-full', status.dot)}
        role="img"
        aria-label={`Status: ${statusLabel}`}
        title={statusLabel}
      />
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

export default memo(BlockNodeView);
