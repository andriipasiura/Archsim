import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ComponentProps, ReactNode } from 'react';

interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'size' | 'children'
> {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function IconButton({
  label,
  hint,
  variant = 'ghost',
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size="icon-sm" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint && <span className="ml-1.5 opacity-70">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
