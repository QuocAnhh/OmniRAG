import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium tracking-[-0.01em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none select-none';

  const variantStyles = {
    primary: 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/85 hover:-translate-y-px active:scale-[0.97] active:shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground border border-white/8 hover:bg-secondary/70 hover:border-white/12 hover:-translate-y-px active:scale-[0.97]',
    outline: 'bg-transparent border border-white/10 text-foreground hover:bg-white/5 hover:border-primary/40 hover:-translate-y-px active:scale-[0.97]',
    danger: 'bg-destructive text-destructive-foreground shadow-md shadow-destructive/20 hover:bg-destructive/85 hover:-translate-y-px active:scale-[0.97] active:shadow-sm',
    ghost: 'bg-transparent text-muted-foreground hover:bg-white/6 hover:text-foreground active:scale-[0.97]',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}
