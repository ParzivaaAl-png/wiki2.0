import type { Config } from 'tailwindcss';

const color = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: color('background'),
        foreground: color('foreground'),
        border: color('border'),
        input: color('input'),
        ring: color('ring'),
        card: {
          DEFAULT: color('card'),
          foreground: color('card-foreground'),
          hover: color('card-hover'),
        },
        popover: {
          DEFAULT: color('popover'),
          foreground: color('popover-foreground'),
        },
        sidebar: {
          bg: color('sidebar-bg'),
          foreground: color('sidebar-foreground'),
        },
        muted: {
          DEFAULT: color('muted'),
          foreground: color('muted-foreground'),
        },
        primary: {
          DEFAULT: color('primary'),
          foreground: color('primary-foreground'),
        },
        secondary: {
          DEFAULT: color('secondary'),
          foreground: color('secondary-foreground'),
        },
        accent: {
          DEFAULT: color('accent'),
          foreground: color('accent-foreground'),
        },
        neutral: {
          50: color('neutral-50'),
          100: color('neutral-100'),
          105: color('neutral-105'),
          150: color('neutral-150'),
          200: color('neutral-200'),
          205: color('neutral-205'),
          250: color('neutral-250'),
          300: color('neutral-300'),
          350: color('neutral-350'),
          400: color('neutral-400'),
          405: color('neutral-405'),
          450: color('neutral-450'),
          455: color('neutral-455'),
          500: color('neutral-500'),
          550: color('neutral-550'),
          600: color('neutral-600'),
          650: color('neutral-650'),
          700: color('neutral-700'),
          750: color('neutral-750'),
          800: color('neutral-800'),
          850: color('neutral-850'),
          900: color('neutral-900'),
          950: color('neutral-950'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 8px 24px rgb(var(--shadow-color) / 0.06)',
        'premium-dark': '0 12px 30px rgb(var(--shadow-color) / 0.28)',
        'glow': '0 0 15px rgba(99, 102, 241, 0.15)',
        'glow-hover': '0 0 25px rgba(99, 102, 241, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.18s ease-out forwards',
        'slide-up': 'slideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
