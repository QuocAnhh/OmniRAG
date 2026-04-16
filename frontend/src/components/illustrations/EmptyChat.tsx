import type { IllustrationProps } from './types';
import { sizeMap } from './types';

/**
 * Hand-drawn illustration — "start a conversation" empty chat state.
 */
export function EmptyChat({ className, title, size = 'md' }: IllustrationProps) {
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
      {/* Back bubble — user */}
      <path
        d="M38 60 Q36 46 52 44 L118 44 Q132 45 132 58 L132 92 Q131 104 118 104 L72 106 L54 118 L58 104 L52 104 Q38 103 38 92 Z"
        fill="#f0eee6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Three dots — typing / prompt */}
      <circle cx="66" cy="74" r="3" fill="currentColor" />
      <circle cx="84" cy="74" r="3" fill="currentColor" />
      <circle cx="102" cy="74" r="3" fill="currentColor" />
      {/* Bot bubble — front, slightly rotated */}
      <g transform="rotate(3 130 140)">
        <path
          d="M70 108 Q68 96 84 94 L150 92 Q164 93 164 106 L164 138 Q164 150 150 150 L146 150 L150 162 L132 150 L84 150 Q70 149 70 138 Z"
          fill="#fbe1d6"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Sparkle inside bot bubble */}
        <path
          d="M100 122 L104 126 L108 122 L104 118 Z"
          fill="currentColor"
        />
        <path d="M126 118 L126 126" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M122 122 L130 122" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Decorative squiggle below */}
      <path
        d="M48 178 Q62 174 78 178 T108 178 T138 178 T168 178"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </svg>
  );
}
