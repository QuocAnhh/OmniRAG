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
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none select-none';

  const variantStyles = {
    primary: 'bg-[#c96442] text-[#faf9f5] shadow-[0px_0px_0px_1px_#c96442] hover:bg-[#d97757] active:shadow-[inset_0px_0px_0px_1px_rgba(0,0,0,0.15)]',
    secondary: 'bg-[#e8e6dc] text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5] hover:bg-[#d1cfc5] active:shadow-[inset_0px_0px_0px_1px_rgba(0,0,0,0.1)]',
    outline: 'bg-transparent border border-[#e8e6dc] text-[#4d4c48] hover:border-[#c96442] hover:text-[#c96442] active:bg-[#f0eee6]',
    danger: 'bg-[#b53333] text-white shadow-[0px_0px_0px_1px_#b53333] hover:bg-[#c93d3d] active:shadow-[inset_0px_0px_0px_1px_rgba(0,0,0,0.15)]',
    ghost: 'bg-transparent text-[#87867f] hover:bg-[#f0eee6] hover:text-[#4d4c48] active:bg-[#e8e6dc]',
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
