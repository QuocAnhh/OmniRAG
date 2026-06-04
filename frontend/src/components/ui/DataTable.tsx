import type { HTMLAttributes, TableHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-left text-sm', className)} {...props} />;
}

export function DataTableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-background/40 shadow-[0_8px_32px_rgba(4,4,20,0.45)] backdrop-blur-xl',
        className
      )}
      {...props}
    />
  );
}
