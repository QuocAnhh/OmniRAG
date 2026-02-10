// 🎨 Modern Button Component - Professional Grade
// Replace: /frontend/src/components/ui/Button.tsx

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {

  // Base styles - all buttons
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-semibold rounded-xl
    transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    disabled:hover:scale-100
    ${fullWidth ? 'w-full' : ''}
  `;

  // Size variants
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  // Variant styles
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-primary-500 to-primary-600
      hover:from-primary-600 hover:to-primary-700
      active:from-primary-700 active:to-primary-800
      text-white
      shadow-lg shadow-primary-500/25
      hover:shadow-xl hover:shadow-primary-500/40
      hover:scale-105 active:scale-100
      focus:ring-primary-500 focus:ring-offset-2
      dark:focus:ring-offset-gray-900
    `,
    secondary: `
      bg-white dark:bg-gray-800
      hover:bg-gray-50 dark:hover:bg-gray-700
      active:bg-gray-100 dark:active:bg-gray-600
      text-gray-700 dark:text-gray-200
      border-2 border-gray-200 dark:border-gray-700
      hover:border-gray-300 dark:hover:border-gray-600
      shadow-sm hover:shadow-md
      hover:scale-105 active:scale-100
      focus:ring-gray-500 focus:ring-offset-2
      dark:focus:ring-offset-gray-900
    `,
    ghost: `
      bg-transparent
      hover:bg-gray-100 dark:hover:bg-gray-800
      active:bg-gray-200 dark:active:bg-gray-700
      text-gray-700 dark:text-gray-300
      hover:text-gray-900 dark:hover:text-white
      focus:ring-gray-500 focus:ring-offset-2
      dark:focus:ring-offset-gray-900
    `,
    danger: `
      bg-gradient-to-r from-red-500 to-red-600
      hover:from-red-600 hover:to-red-700
      active:from-red-700 active:to-red-800
      text-white
      shadow-lg shadow-red-500/25
      hover:shadow-xl hover:shadow-red-500/40
      hover:scale-105 active:scale-100
      focus:ring-red-500 focus:ring-offset-2
      dark:focus:ring-offset-gray-900
    `,
    success: `
      bg-gradient-to-r from-teal-500 to-teal-600
      hover:from-teal-600 hover:to-teal-700
      active:from-teal-700 active:to-teal-800
      text-white
      shadow-lg shadow-teal-500/25
      hover:shadow-xl hover:shadow-teal-500/40
      hover:scale-105 active:scale-100
      focus:ring-teal-500 focus:ring-offset-2
      dark:focus:ring-offset-gray-900
    `,
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
          <span>Loading...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

// ============================================
// 📚 Usage Examples
// ============================================

/*
// Primary (default) - Main CTAs
<Button>Create New Bot</Button>
<Button 
  leftIcon={<span className="material-symbols-outlined">add</span>}
>
  Add Document
</Button>

// Secondary - Less emphasis
<Button variant="secondary">Cancel</Button>
<Button 
  variant="secondary"
  rightIcon={<span className="material-symbols-outlined">arrow_forward</span>}
>
  Learn More
</Button>

// Ghost - Minimal
<Button variant="ghost">Skip</Button>

// Danger - Destructive actions
<Button variant="danger">Delete Bot</Button>

// Success - Positive actions
<Button variant="success">Publish</Button>

// With loading state
<Button loading>Saving...</Button>

// Different sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// Full width
<Button fullWidth>Full Width Button</Button>

// Disabled
<Button disabled>Disabled Button</Button>
*/
