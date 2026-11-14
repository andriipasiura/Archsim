import { cn } from '@/lib/utils';
import type { BlockType } from '@sds/shared';
import { BLOCK_META } from '../block-meta';

export function BlockIcon({
  type,
  className,
}: {
  type: BlockType;
  className?: string;
}) {
  const { icon } = BLOCK_META[type];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md bg-muted p-1.5',
        className,
      )}
    >
      {icon.kind === 'logo' ? (
        <img
          src={icon.src}
          alt=""
          draggable={false}
          className="size-full object-contain"
        />
      ) : (
        <icon.Icon className="size-full text-primary" strokeWidth={1.75} />
      )}
    </span>
  );
}
