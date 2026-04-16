export interface IllustrationProps {
  className?: string;
  /** Accessible title — if omitted, SVG is decorative (aria-hidden). */
  title?: string;
  /** Size preset. `md` = 160px, `sm` = 96px, `lg` = 240px. Width/height auto-scale via className too. */
  size?: 'sm' | 'md' | 'lg';
}

export const sizeMap = {
  sm: 96,
  md: 160,
  lg: 240,
} as const;
