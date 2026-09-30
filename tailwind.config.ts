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
        // Были в вёрстке, но не в конфиге: текст падал в браузерные 16 px
        // обычного веса — вторичные подписи выходили крупнее основного
        // текста, а имя участника не выделялось (обзор 09-26, U-3).
        small:          ['13px', { lineHeight: '18px', fontWeight: '400' }],
        /*
         * Кегль полей ввода. iOS увеличивает страницу при фокусе, если у поля
         * меньше 16px, и после ввода масштаб приходится разводить руками
         * (замечание Vadym 09-30). Запрещать увеличение через maximum-scale
         * нельзя — это ломает доступность (U-6), поэтому поля набираем 16px.
         */
        field:          ['16px', { lineHeight: '22px', fontWeight: '400' }],
        'body-semibold':['14px', { lineHeight: '20px', fontWeight: '600' }],
      },
      boxShadow: {
        // На почти чёрном фоне тень работает как отделение плашки от фона,
        // а не как «подъём»: мягкая и тёмная, без цветных ореолов.
        card:  '0 1px 3px rgb(0 0 0 / 0.5)',
        modal: '0 -8px 32px rgb(0 0 0 / 0.6)',
      },
      borderRadius: { sm: '8px', md: '12px', lg: '16px', tile: '6px' },
      spacing: { 13: '52px', 15: '60px' },
      fontFamily: {
        // Системные цветные эмодзи (п. 37): на iPhone — Apple, без картинок в сборке
        emoji: ['"Apple Color Emoji"', '"Segoe UI Emoji"', '"Noto Color Emoji"', 'sans-serif'],
      },
      // Полоски «идёт запись» у голосового поиска (backlog п. 21)
      keyframes: {
        'voice-bar': {
          '0%, 100%': { height: '4px' },
          '50%': { height: '16px' },
        },
      },
      animation: {
        'voice-bar': 'voice-bar 0.9s ease-in-out infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
