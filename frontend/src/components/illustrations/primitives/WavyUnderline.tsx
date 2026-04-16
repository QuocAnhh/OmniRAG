import type { ReactNode } from 'react';

interface WavyUnderlineProps {
  children: ReactNode;
  className?: string;
  /** Always visible (true) or only on hover (false). Default hover-only. */
  always?: boolean;
}

/**
 * Text wrapper with a hand-drawn wavy underline.
 * Use for active nav link or hover moment on links.
 * Uses `currentColor` — stroke adapts to parent color.
 *
 * Usage:
 *   <WavyUnderline>Active page</WavyUnderline>
 *   <a href="#"><WavyUnderline>Learn more</WavyUnderline></a>
 */
export function WavyUnderline({ children, className, always = false }: WavyUnderlineProps) {
  return (
    <span className={`relative inline-block group ${className ?? ''}`}>
      <span>{children}</span>
      <svg
        className={`pointer-events-none absolute left-0 right-0 -bottom-1 w-full h-[6px] ${
          always
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
        }`}
        viewBox="0 0 100 6"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M2 3 Q 12 1 22 3 T 42 3 T 62 3 T 82 3 T 98 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
