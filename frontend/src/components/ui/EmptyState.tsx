import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  /** A hand-drawn illustration from `components/illustrations/*`. Required. */
  illustration: ReactNode;
  title: string;
  description?: string;
  /** Primary CTA, typically a <Button />. */
  action?: ReactNode;
  /** Secondary CTA or help text. */
  secondaryAction?: ReactNode;
  className?: string;
  /** Text color for the illustration (consumed via currentColor). Default primary. */
  illustrationTone?: 'primary' | 'muted' | 'stone';
}

const toneMap = {
  primary: 'text-primary',
  muted: 'text-warm-olive',
  stone: 'text-warm-stone',
} as const;

/**
 * Emotional empty state using a hand-drawn illustration + editorial heading.
 * Used for "no bots yet", "no messages", onboarding success, 404, etc.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  secondaryAction,
  illustrationTone = 'primary',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-6 py-12 gap-4',
        className,
      )}
    >
      <div className={cn('mb-2', toneMap[illustrationTone])}>{illustration}</div>
      <h3 className="font-serif text-2xl text-text-primary leading-tight max-w-md">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-text-secondary leading-relaxed max-w-md">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
