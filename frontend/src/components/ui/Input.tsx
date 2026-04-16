import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      helperText,
      leftIcon,
      rightIcon,
      className,
      type = 'text',
      id,
      required,
      ...props
    },
    ref,
  ) => {
    const hintId = error
      ? `${id ?? 'field'}-error`
      : helperText
        ? `${id ?? 'field'}-helper`
        : undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block mb-2 text-sm font-medium text-text-primary"
          >
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute inset-y-0 left-3 flex items-center text-text-tertiary pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            id={id}
            ref={ref}
            type={type}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            className={cn(
              'w-full rounded-lg bg-white border text-sm text-text-primary',
              'placeholder:text-warm-silver transition-all duration-200',
              'focus:ring-2 focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-10' : 'pl-4',
              rightIcon ? 'pr-10' : 'pr-4',
              'py-2.5',
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : success
                  ? 'border-green-600 focus:border-green-600 focus:ring-green-600/20'
                  : 'border-border-warm focus:border-primary focus:ring-primary/20',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute inset-y-0 right-3 flex items-center text-text-tertiary pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p
            id={hintId}
            className="mt-1.5 text-xs text-destructive font-medium flex items-center gap-1"
          >
            <AlertCircle className="size-3.5" aria-hidden="true" />
            {error}
          </p>
        )}
        {success && !error && (
          <p className="mt-1.5 text-xs text-green-700 font-medium">{success}</p>
        )}
        {helperText && !error && !success && (
          <p id={hintId} className="mt-1.5 text-xs text-text-tertiary">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
