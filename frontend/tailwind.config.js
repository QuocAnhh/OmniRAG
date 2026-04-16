/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
          950: "var(--color-primary-950)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        /* Warm neutral palette for direct usage */
        warm: {
          sand: "#e8e6dc",
          cream: "#f0eee6",
          ivory: "#faf9f5",
          parchment: "#f5f4ed",
          charcoal: "#4d4c48",
          olive: "#5e5d59",
          stone: "#87867f",
          silver: "#b0aea5",
          dark: "#30302e",
          "near-black": "#141413",
        },
        terracotta: {
          DEFAULT: "#c96442",
          light: "#d97757",
          dark: "#b3522f",
        },
        /* Semantic text roles */
        text: {
          primary: "#141413",
          secondary: "#5e5d59",
          tertiary: "#87867f",
          inverse: "#faf9f5",
          muted: "#b0aea5",
          link: "#c96442",
          "link-hover": "#d97757",
        },
        /* Semantic border roles */
        "border-subtle": "#f0eee6",
        "border-warm": "#e8e6dc",
        "border-dark": "#30302e",
        "border-focus": "#3898ec",
        /* Semantic brand */
        brand: {
          terracotta: "#c96442",
          coral: "#d97757",
          crimson: "#b53333",
        },
        /* Sketch accents (Doodle layer) */
        sketch: {
          stroke: "#b3522f",
          fill: "#fbe1d6",
          highlight: "#ee9a74",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        sharp: "4px",
        subtle: "6px",
        comfort: "8px",
        generous: "12px",
        feature: "16px",
        tag: "24px",
        hero: "32px",
      },
      boxShadow: {
        "ring": "0px 0px 0px 1px var(--border)",
        "ring-subtle": "0px 0px 0px 1px #f0eee6",
        "ring-warm": "0px 0px 0px 1px #e8e6dc",
        "ring-hover": "0px 0px 0px 1px #d1cfc5",
        "ring-active": "0px 0px 0px 1px #c2c0b6",
        "ring-primary": "0px 0px 0px 1px #c96442",
        "whisper-sm": "0px 2px 8px rgba(0,0,0,0.04)",
        "whisper": "rgba(0,0,0,0.05) 0px 4px 24px",
        "whisper-lg": "0px 8px 32px rgba(0,0,0,0.06)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Georgia", '"Times New Roman"', "serif"],
        mono: ['"SF Mono"', '"Fira Code"', "monospace"],
      },
    },
  },
  plugins: [],
}
