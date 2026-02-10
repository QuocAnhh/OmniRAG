// 🎨 Modern Card Component System - Professional Grade
// Create: /frontend/src/components/ui/Card.tsx

import type { HTMLAttributes, ReactNode } from 'react';

type CardVariant = 'elevated' | 'flat' | 'bordered' | 'interactive';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
  hover?: boolean; // Enable hover effects
}

export function Card({
  variant = 'elevated',
  padding = 'md',
  hover = false,
  children,
  className = '',
  ...props
}: CardProps) {

  // Base styles
  const baseStyles = `
    rounded-2xl
    transition-all duration-200 ease-out
  `;

  // Padding variants
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6 lg:p-8',
    lg: 'p-8 lg:p-10',
  };

  // Variant styles
  const variantStyles = {
    elevated: `
      bg-white dark:bg-gray-900
      border border-gray-100 dark:border-gray-800
      shadow-sm
      ${hover ? 'hover:shadow-md hover:-translate-y-1 hover:border-gray-200 dark:hover:border-gray-700' : ''}
    `,
    flat: `
      bg-gray-50 dark:bg-gray-900/50
      border border-transparent
      ${hover ? 'hover:border-gray-200 dark:hover:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900/70' : ''}
    `,
    bordered: `
      bg-transparent
      border-2 border-gray-200 dark:border-gray-800
      ${hover ? 'hover:border-primary-200 dark:hover:border-primary-900 hover:bg-gray-50 dark:hover:bg-gray-900/30' : ''}
    `,
    interactive: `
      bg-white dark:bg-gray-900
      border border-gray-100 dark:border-gray-800
      shadow-sm hover:shadow-lg
      cursor-pointer
      hover:-translate-y-2
      hover:border-primary-200 dark:hover:border-primary-900
      active:translate-y-0 active:shadow-md
    `,
  };

  return (
    <div
      className={`
        ${baseStyles}
        ${paddingStyles[padding]}
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// Card Header Component
// ============================================

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================
// Card Footer Component
// ============================================

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// Stat Card Component (for Dashboard)
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ label, value, change, icon, trend = 'neutral' }: StatCardProps) {
  const trendColors = {
    up: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400',
    down: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    neutral: 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card variant="elevated" hover padding="md">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 text-primary-600 dark:text-primary-400">
          {icon}
        </div>
        {change && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${trendColors[trend]}`}>
            {change}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
    </Card>
  );
}

// ============================================
// 📚 Usage Examples
// ============================================

/*
// Basic Elevated Card (default)
<Card>
  <h3>Card Title</h3>
  <p>Card content here...</p>
</Card>

// Flat Card (subtle background)
<Card variant="flat">
  <p>Less important content</p>
</Card>

// Interactive Card (clickable)
<Card variant="interactive" onClick={() => console.log('clicked')}>
  <p>Click me!</p>
</Card>

// Card with Header
<Card>
  <CardHeader
    title="Recent Activity"
    subtitle="Last 7 days"
    icon={<span className="material-symbols-outlined">history</span>}
    action={<button>View All</button>}
  />
  <div>Activity content...</div>
</Card>

// Card with Footer
<Card>
  <div>Main content</div>
  <CardFooter>
    <div className="flex justify-end gap-3">
      <Button variant="ghost">Cancel</Button>
      <Button>Save</Button>
    </div>
  </CardFooter>
</Card>

// Stat Card (for Dashboard)
<StatCard
  label="Total Bots"
  value="12"
  change="+2 this week"
  trend="up"
  icon={<span className="material-symbols-outlined">smart_toy</span>}
/>

// Different padding sizes
<Card padding="none">No padding</Card>
<Card padding="sm">Small padding</Card>
<Card padding="md">Medium padding (default)</Card>
<Card padding="lg">Large padding</Card>

// Hover effects
<Card hover>Hover me!</Card>
*/
