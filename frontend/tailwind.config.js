/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Raycast-Inspired "Deep Midnight" Palette (Ao anh, mo ao)
        'ray-bg': '#05070a', // Gan nhu den nhung nga xanh thach anh
        'ray-surface': '#0d1117', // Tông xanh den sau
        'ray-surface-elevated': '#161b22', // Sang hon chút de có do sâu
        'ray-border': 'rgba(255, 255, 255, 0.08)',
        'ray-border-bright': 'rgba(255, 255, 255, 0.15)',
        'ray-text': '#f0f6fc',
        'ray-muted': '#8b949e',
        'ray-primary': '#ff6363',
        'ray-blue': '#58a6ff',
        'ray-glow': 'rgba(59, 130, 246, 0.1)', // Glow mau xanh mo ao
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.02em',
      },
      borderRadius: {
        'button': '8px',
        'card': '12px',
        'panel': '16px',
      },
      animation: {
        'ray-fade-in': 'ray-fade-in 0.3s ease-out',
        'ray-slide-up': 'ray-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'ray-command-enter': 'ray-command-enter 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'ray-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'ray-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ray-command-enter': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionTimingFunction: {
        'ray-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
}
