/**
 * Заглушки браузерных API. Очередь несохранённых правок читает localStorage
 * прямо при импорте модуля, а `isNetworkError` смотрит на navigator.onLine —
 * без этих двух заглушек тесты падали бы на импорте, а не на логике.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

if (!('localStorage' in globalThis)) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(), configurable: true,
  });
}

if (!('navigator' in globalThis)) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true }, configurable: true,
  });
} else if (typeof navigator.onLine !== 'boolean') {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
}
