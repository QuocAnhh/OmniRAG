import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline'
  | 'sketch';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-warm-cream text-warm-charcoal',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-50 text-green-700 border border-green-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-destructive/10 text-destructive',
  outline: 'bg-transparent border border-border-warm text-warm-charcoal',
  sketch:
    'bg-sketch-fill text-sketch-stroke border border-dashed border-sketch-stroke/50',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
};

export function Badge({
  variant = 'default',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
