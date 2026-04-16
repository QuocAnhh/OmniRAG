import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type CardVariant = 'flat' | 'contained' | 'ring' | 'whisper' | 'sketch';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  /** When true, hover shifts elevation for interactive cards. */
  interactive?: boolean;
  children: ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  flat: 'bg-card',
  contained: 'bg-card border border-border-subtle',
  ring: 'bg-card shadow-ring',
  whisper: 'bg-card shadow-whisper',
  sketch:
    'bg-sketch-fill border border-dashed border-sketch-stroke/40 text-sketch-stroke',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  variant = 'contained',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-generous',
        variantStyles[variant],
        paddingStyles[padding],
        interactive &&
          'transition-shadow duration-200 hover:shadow-whisper cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 space-y-1', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-serif text-2xl text-text-primary', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-text-secondary leading-relaxed', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}
