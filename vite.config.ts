import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// Версия читается из package.json, а не из переменной npm: на сборщике
// переменной может не быть, и в Настройках показалось бы «0.0.0»
const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  plugins: [
    react(),
    VitePWA({
      /*
       * 'prompt', а не 'autoUpdate': обновление предлагается тостом, а не
       * подменяет экран под руками — человек может стоять в магазине с
       * открытым списком (R-10). Регистрацию делает src/app/useAppUpdate.ts,
       * поэтому свой скрипт плагин не вставляет.
       */
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'fonts/*.woff2'],
      manifest: {
        id: '/',
        lang: 'ru',
        name: 'PantrySync',
        short_name: 'PantrySync',
        description: 'Продукты и блюда для всей семьи',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Тема одна и тёмная (D-022). Раньше здесь стояли зелёный и светлый
        // фон из первого макета: при запуске с домашнего экрана телефон
        // показывал белую заставку, а потом чёрный интерфейс (обзор 09-26, R-8).
        theme_color: '#0A0A0A',
        background_color: '#000000',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Шрифт заголовков должен быть и без сети, иначе названия блюд
        // при каждом запуске в подвале магазина прыгают на Georgia
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Данные НИКОГДА не кэшируются агрессивно: список продуктов
        // обязан быть свежим, иначе в магазине купишь лишнее.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  // Видимая в Настройках версия: без неё нельзя понять, обновился телефон или нет
  define: {
    __BUILD_VERSION__: JSON.stringify(`${version} · ${new Date().toISOString().slice(0, 10)}`),
  },
  build: { target: 'es2022', sourcemap: false },
});
