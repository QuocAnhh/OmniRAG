/**
 * Motion tokens — single source of truth for Framer Motion timings.
 * Use these across components to maintain a consistent cadence.
 * Always respect `prefers-reduced-motion` via `useReducedMotion()` from framer-motion.
 */
import type { Transition, Variants } from 'framer-motion';

export const easings = {
  /** Standard easing for UI transitions. */
  standard: [0.4, 0, 0.2, 1] as const,
  /** Elegant entrance (ease-out-expo). */
  enter: [0.22, 1, 0.36, 1] as const,
  /** Playful circular for Doodle accent motion. */
  sketch: [0.34, 1.56, 0.64, 1] as const,
} as const;

export const durations = {
  fast: 0.15,
  default: 0.2,
  medium: 0.3,
  slow: 0.4,
  page: 0.35,
} as const;

export const transitions = {
  default: { duration: durations.default, ease: easings.standard } satisfies Transition,
  fast: { duration: durations.fast, ease: easings.standard } satisfies Transition,
  page: { duration: durations.page, ease: easings.enter } satisfies Transition,
  sketch: { duration: durations.slow, ease: easings.sketch } satisfies Transition,
  spring: { type: 'spring', stiffness: 300, damping: 28 } satisfies Transition,
} as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.default },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.default },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

/**
 * Media query helper — returns true if user prefers reduced motion.
 * Use in non-Framer contexts (CSS animations, direct DOM).
 * Within Framer Motion, prefer `useReducedMotion()` hook.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
