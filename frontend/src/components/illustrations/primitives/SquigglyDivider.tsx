interface SquigglyDividerProps {
  className?: string;
  /** Width in pixels. Defaults to full container via className. */
  width?: number;
  /** Height (amplitude room) in pixels. Default 12. */
  height?: number;
  /** Label — if omitted, decorative. */
  label?: string;
}

/**
 * Hand-drawn horizontal squiggle for section separation.
 * Uses `currentColor` — parent controls hue via `text-*` class.
 * Section usage (LandingPage chapter breaks): pair with generous vertical margin.
 */
export function SquigglyDivider({
  className,
  width = 160,
  height = 12,
  label,
}: SquigglyDividerProps) {
  const decorative = !label;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative}
      aria-label={label}
      className={className}
      preserveAspectRatio="none"
    >
      {label ? <title>{label}</title> : null}
      <path
        d={`M4 ${height / 2} Q ${width * 0.12} 2 ${width * 0.24} ${height / 2} T ${width * 0.48} ${height / 2} T ${width * 0.72} ${height / 2} T ${width - 4} ${height / 2}`}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
