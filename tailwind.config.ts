import type { Config } from 'tailwindcss';

/** Имена совпадают с переменными в Figma. Сетка кратна 8 (D-035). */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'text-dim': 'rgb(var(--text-dim) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-track': 'rgb(var(--accent-track) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
      },
      fontSize: {
        title:    ['20px', { lineHeight: '26px', fontWeight: '500', letterSpacing: '-0.5px' }],
        display:  ['26px', { lineHeight: '30px', fontWeight: '500', letterSpacing: '-0.6px' }],
        headline: ['16px', { lineHeight: '22px', fontWeight: '500' }],
        body:     ['14px', { lineHeight: '20px', fontWeight: '400' }],
        caption:  ['12px', { lineHeight: '16px', fontWeight: '400' }],
        micro:    ['11px', { lineHeight: '14px', fontWeight: '400' }],
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px', tile: '6px' },
      spacing: { 13: '52px', 15: '60px' },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
