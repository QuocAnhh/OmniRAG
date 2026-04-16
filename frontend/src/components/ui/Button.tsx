import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'outline'
  | 'sketch';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: ReactNode;
}

const baseStyles =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ' +
  'focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed ' +
  'disabled:transform-none select-none';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-ring-primary hover:bg-terracotta-light ' +
    'active:shadow-[inset_0px_0px_0px_1px_rgba(0,0,0,0.15)]',
  secondary:
    'bg-secondary text-warm-charcoal shadow-ring-hover hover:bg-warm-sand ' +
    'active:shadow-[inset_0px_0px_0px_1px_rgba(0,0,0,0.1)]',
  outline:
    'bg-transparent border border-border-warm text-warm-charcoal ' +
    'hover:border-primary hover:text-primary active:bg-warm-cream',
  danger:
    'bg-destructive text-white shadow-ring-primary hover:bg-brand-crimson/85 ' +
    'active:shadow-[inset_0px_0px_0px_1px_rgba(0,0,0,0.15)]',
  ghost:
    'bg-transparent text-warm-stone hover:bg-warm-cream hover:text-warm-charcoal ' +
    'active:bg-warm-sand',
  sketch:
    'bg-sketch-fill text-sketch-stroke shadow-ring-hover hover:bg-sketch-highlight/40 ' +
    'active:bg-sketch-highlight/60 border border-dashed border-sketch-stroke/40',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  icon: 'p-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
