import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0E17',
        'surface-dark': '#12151F',
        'surface-dark-raised': '#181C29',
        paper: '#FAFAFA',
        'surface-light': '#F1F3F6',
        cobalt: {
          DEFAULT: '#3654FF',
          dim: '#223B99',
          bright: '#5C78FF',
          faint: '#3654FF1A'
        },
        slate: {
          DEFAULT: '#667085',
          light: '#98A2B3',
          border: '#E4E7EC',
          'border-dark': '#242938'
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace']
      },
      maxWidth: {
        chat: '760px'
      },
      keyframes: {
        pulseLine: {
          '0%, 100%': { opacity: '0.35', transform: 'scaleY(0.6)' },
          '50%': { opacity: '1', transform: 'scaleY(1)' }
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'pulse-line': 'pulseLine 1.1s ease-in-out infinite',
        'fade-up': 'fadeUp 0.25s ease-out'
      }
    }
  },
  plugins: []
};

export default config;
