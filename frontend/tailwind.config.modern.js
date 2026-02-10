// 🎨 Modern Tailwind Config - Professional Color System
// Replace: /frontend/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ============================================
      // 🎨 COLOR SYSTEM - Sophisticated & Modern
      // ============================================
      colors: {
        // Primary - Sophisticated Violet (not generic indigo!)
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',  // Main - Premium violet
          600: '#7c3aed',  // Hover state
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },

        // Accent - Electric Blue (for secondary actions)
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',  // Main
          600: '#2563eb',  // Hover
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // Success/Positive - Modern Teal
        success: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',  // Main
          600: '#0d9488',  // Hover
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },

        // Warning - Amber
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',  // Main
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        // Error/Danger - Modern Red
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',  // Main
          600: '#dc2626',  // Hover
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },

        // Admin Panel (keep from original)
        admin: {
          50: '#eff0ff',
          100: '#e0e2ff',
          200: '#c7caff',
          300: '#a5a9ff',
          400: '#8184ff',
          500: '#5f63ff',
          600: '#2b2eee',
          700: '#2324d1',
          800: '#1d1fa9',
          900: '#1d1f85',
        },
      },

      // ============================================
      // 📐 SPACING SYSTEM (8pt Grid)
      // ============================================
      spacing: {
        // Additional spacing for better layouts
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
        '100': '25rem',   // 400px
        '112': '28rem',   // 448px
        '128': '32rem',   // 512px
      },

      // ============================================
      // 🔤 TYPOGRAPHY
      // ============================================
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Better type scale
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },

      // ============================================
      // 💎 SHADOWS (Elevation System)
      // ============================================
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'DEFAULT': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        
        // Colored shadows for CTAs
        'primary': '0 10px 25px -5px rgb(139 92 246 / 0.3)',
        'primary-lg': '0 20px 40px -10px rgb(139 92 246 / 0.4)',
        'accent': '0 10px 25px -5px rgb(59 130 246 / 0.3)',
        'success': '0 10px 25px -5px rgb(20 184 166 / 0.3)',
        'error': '0 10px 25px -5px rgb(239 68 68 / 0.3)',
      },

      // ============================================
      // 🎭 ANIMATIONS
      // ============================================
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },

      // ============================================
      // 🎯 BORDER RADIUS
      // ============================================
      borderRadius: {
        'DEFAULT': '0.5rem',   // 8px
        'md': '0.75rem',       // 12px
        'lg': '1rem',          // 16px
        'xl': '1.25rem',       // 20px
        '2xl': '1.5rem',       // 24px
        '3xl': '2rem',         // 32px
      },

      // ============================================
      // 📏 MAX WIDTH (Container sizes)
      // ============================================
      maxWidth: {
        '8xl': '90rem',   // 1440px
        '9xl': '96rem',   // 1536px
      },

      // ============================================
      // ⚡ TRANSITIONS
      // ============================================
      transitionDuration: {
        '400': '400ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}
