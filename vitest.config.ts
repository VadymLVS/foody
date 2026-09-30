import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Модульные тесты на чистую логику (пакет 3 обзора 09-26).
 *
 * Браузерного окружения нет намеренно: под тестами только функции без
 * интерфейса — питание, поиск, группировка по отделам, очередь правок.
 * Экраны проверяются сценариями Playwright против собранной версии.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
