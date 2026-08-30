/**
 * Нормализация и поиск. См. D-008, D-034.
 * Порог — два символа везде: на трёх ломаются «мука», «соль», «яйца».
 */
export const SEARCH_MIN_LENGTH = 2;

/**
 * Общая нормализация вместо частного случая «ё→е»: разложение Unicode
 * снимает диакритику, что нужно и украинскому, и испанскому.
 */
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

export interface Nameable { name: string }

/** Подстрока, но совпадения с начала идут первыми. */
export function searchByName<T extends Nameable>(items: T[], query: string): T[] {
  const q = norm(query);
  if (q.length < SEARCH_MIN_LENGTH) return items;
  return items
    .filter((i) => norm(i.name).includes(q))
    .sort((a, b) => {
      const rank = (n: string) => (norm(n).startsWith(q) ? 0 : 1);
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'ru');
    });
}

/** 1.50 → «1,5»; 2 → «2». Единица подставляется вызывающим. */
export function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(/\.?0+$/, '').replace('.', ',');
}
