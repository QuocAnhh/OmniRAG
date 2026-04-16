import type { HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
}

const variantConfig: Record<
  AlertVariant,
  { surface: string; icon: ReactNode; role: 'alert' | 'status' }
> = {
  info: {
    surface:
      'bg-blue-50 border-blue-200 text-blue-900 [&_.alert-icon]:text-blue-600',
    icon: <Info className="size-5 alert-icon shrink-0" aria-hidden="true" />,
    role: 'status',
  },
  success: {
    surface:
      'bg-green-50 border-green-200 text-green-900 [&_.alert-icon]:text-green-600',
    icon: (
      <CheckCircle2 className="size-5 alert-icon shrink-0" aria-hidden="true" />
    ),
    role: 'status',
  },
  warning: {
    surface:
      'bg-amber-50 border-amber-200 text-amber-900 [&_.alert-icon]:text-amber-600',
    icon: (
      <AlertTriangle
        className="size-5 alert-icon shrink-0"
        aria-hidden="true"
      />
    ),
    role: 'alert',
  },
  danger: {
    surface:
      'bg-destructive/5 border-destructive/30 text-destructive [&_.alert-icon]:text-destructive',
    icon: (
      <AlertCircle className="size-5 alert-icon shrink-0" aria-hidden="true" />
    ),
    role: 'alert',
  },
};

export function Alert({
  variant = 'info',
  title,
  icon,
  className,
  children,
  ...props
}: AlertProps) {
  const cfg = variantConfig[variant];
  return (
    <div
      role={cfg.role}
      className={cn(
        'flex items-start gap-3 rounded-generous border p-4 text-sm',
        cfg.surface,
        className,
      )}
      {...props}
    >
      {icon ?? cfg.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium mb-1">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
