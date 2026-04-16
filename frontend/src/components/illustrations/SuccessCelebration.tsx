import type { IllustrationProps } from './types';
import { sizeMap } from './types';

/**
 * Hand-drawn illustration — onboarding / wizard success moment.
 * Confetti + check. Celebratory without being loud.
 */
export function SuccessCelebration({ className, title, size = 'md' }: IllustrationProps) {
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
      {/* Big imperfect circle (hand-drawn) */}
      <path
        d="M100 42 C142 42 158 74 158 102 C158 136 134 156 100 156 C66 156 44 134 44 100 C44 68 62 42 100 42 Z"
        fill="#fbe1d6"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Check mark — hand drawn */}
      <path
        d="M76 100 L94 118 L128 82"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Confetti streamers */}
      <path d="M30 50 Q36 44 42 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M160 40 L164 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M172 70 L178 74" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 100 L18 104" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 144 Q30 148 34 146" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M168 134 L174 130" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Confetti dots */}
      <circle cx="38" cy="72" r="2.5" fill="currentColor" />
      <circle cx="166" cy="96" r="2.5" fill="currentColor" />
      <circle cx="58" cy="34" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="146" cy="168" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="54" cy="170" r="2.2" fill="currentColor" opacity="0.7" />
      {/* Sparkle */}
      <path d="M150 52 L150 60 M146 56 L154 56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
