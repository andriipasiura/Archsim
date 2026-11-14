import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export function FloatingBar({
  className,
  orientation = 'horizontal',
  ...props
}: ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      className={cn(
        'flex items-center gap-0.5 rounded-lg border bg-card p-1 text-card-foreground shadow-sm',
        orientation === 'vertical' && 'flex-col',
        className,
      )}
      {...props}
    />
  );
}

export function FloatingBarDivider({
  orientation = 'vertical',
}: {
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 bg-border',
        orientation === 'vertical' ? 'mx-1 h-5 w-px' : 'my-1 h-px w-5',
      )}
    />
  );
}
