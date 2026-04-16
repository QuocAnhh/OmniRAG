/**
 * Design tokens — single source of truth for TypeScript code.
 * Mirrors `tailwind.config.js` + `src/index.css` CSS variables.
 * Use these for programmatic access (e.g. chart colors, SVG strokes, motion).
 * For styling, prefer Tailwind classes.
 */

export const colors = {
  // Brand
  terracotta: '#c96442',
  terracottaLight: '#d97757',
  terracottaDark: '#b3522f',
  crimson: '#b53333',
  focusBlue: '#3898ec',

  // Surface
  parchment: '#f5f4ed',
  ivory: '#faf9f5',
  sand: '#e8e6dc',
  cream: '#f0eee6',
  dark: '#30302e',
  deep: '#141413',
  white: '#ffffff',

  // Text
  nearBlack: '#141413',
  charcoal: '#4d4c48',
  darkWarm: '#3d3d3a',
  olive: '#5e5d59',
  stone: '#87867f',
  silver: '#b0aea5',

  // Border / ring
  borderCream: '#f0eee6',
  borderWarm: '#e8e6dc',
  borderDark: '#30302e',
  ringWarm: '#d1cfc5',
  ringDeep: '#c2c0b6',

  // Sketch (muted terracotta variants for Doodle accents)
  sketchStroke: '#b3522f',
  sketchFill: '#fbe1d6',
  sketchHighlight: '#ee9a74',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
  '5xl': 80,
  '6xl': 120,
} as const;

export const radii = {
  sharp: 4,
  subtle: 6,
  comfort: 8,
  generous: 12,
  feature: 16,
  tag: 24,
  hero: 32,
} as const;

export const shadows = {
  ring: '0px 0px 0px 1px var(--border)',
  ringHover: '0px 0px 0px 1px #d1cfc5',
  ringActive: '0px 0px 0px 1px #c2c0b6',
  ringPrimary: '0px 0px 0px 1px #c96442',
  whisper: 'rgba(0,0,0,0.05) 0px 4px 24px',
  whisperLg: 'rgba(0,0,0,0.06) 0px 8px 32px',
} as const;

export const typography = {
  display: { size: 64, lineHeight: 1.1, weight: 500 },
  heading: { size: 52, lineHeight: 1.2, weight: 500 },
  subheadingLg: { size: 36, lineHeight: 1.3, weight: 500 },
  subheading: { size: 32, lineHeight: 1.1, weight: 500 },
  subheadingSm: { size: 25, lineHeight: 1.2, weight: 500 },
  feature: { size: 20.8, lineHeight: 1.2, weight: 500 },
  bodyLg: { size: 20, lineHeight: 1.6, weight: 400 },
  body: { size: 17, lineHeight: 1.6, weight: 400 },
  bodyStandard: { size: 16, lineHeight: 1.6, weight: 400 },
  bodySm: { size: 15, lineHeight: 1.6, weight: 400 },
  caption: { size: 14, lineHeight: 1.43, weight: 400 },
  label: { size: 12, lineHeight: 1.25, weight: 500, letterSpacing: 0.12 },
  overline: { size: 10, lineHeight: 1.6, weight: 400, letterSpacing: 0.5 },
} as const;

export const fonts = {
  sans: 'Inter, system-ui, -apple-system, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SF Mono", "Fira Code", monospace',
} as const;

export type ColorToken = keyof typeof colors;
export type RadiusToken = keyof typeof radii;
export type ShadowToken = keyof typeof shadows;
