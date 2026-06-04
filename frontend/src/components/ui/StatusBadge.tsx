import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const toneStyles: Record<StatusTone, string> = {
  neutral: 'border-white/10 bg-white/5 text-muted-foreground',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  primary: 'border-primary/25 bg-primary/10 text-primary',
};

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
