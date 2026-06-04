import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedTabs<T extends string>({ items, value, onChange, className }: SegmentedTabsProps<T>) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto', className)} role="tablist">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? 'border-primary/25 bg-primary/10 text-primary shadow-[inset_0_0_18px_rgba(79,142,240,0.12)]'
                : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            {item.icon}
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
