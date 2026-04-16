import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant. `block` default, `text` is half-height, `circle` is circular. */
  variant?: 'block' | 'text' | 'circle';
}

function Skeleton({ className, variant = 'block', ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'animate-pulse bg-warm-cream',
        variant === 'text' && 'h-4 rounded-sharp',
        variant === 'block' && 'rounded-comfort',
        variant === 'circle' && 'rounded-full aspect-square',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
