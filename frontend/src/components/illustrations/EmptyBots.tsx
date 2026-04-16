import type { IllustrationProps } from './types';
import { sizeMap } from './types';

/**
 * Hand-drawn illustration — "no bots yet" empty state.
 * Uses `currentColor` for stroke; parent controls hue via `text-*` class.
 * Default strokes: terracotta. Accent fills: sketch-fill.
 */
export function EmptyBots({ className, title, size = 'md' }: IllustrationProps) {
  const dim = sizeMap[size];
  const decorative = !title;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative}
      aria-label={title}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {/* Soft parchment disc */}
      <ellipse cx="100" cy="168" rx="68" ry="6" fill="#f0eee6" />
      {/* Bot body — imperfect rounded rectangle */}
      <path
        d="M56 70 Q54 54 70 52 L128 50 Q146 51 146 68 L146 128 Q145 146 128 146 L72 148 Q54 147 54 130 Z"
        fill="#fbe1d6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Antenna */}
      <path d="M100 50 L100 34" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="100" cy="30" r="5" fill="currentColor" />
      {/* Eyes — sleepy dots */}
      <path d="M78 90 Q82 86 86 90" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M114 90 Q118 86 122 90" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {/* Mouth — tiny curve */}
      <path d="M88 112 Q100 118 112 112" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {/* Side panels — sketch hash */}
      <path d="M54 78 L52 78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M54 88 L52 88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M146 78 L148 78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M146 88 L148 88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Zzz — sleeping */}
      <path
        d="M148 46 Q156 44 160 48 Q156 52 160 56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      {/* Dotted ground squiggle */}
      <path
        d="M40 178 Q60 174 80 178 T120 178 T160 178"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="3 5"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}
