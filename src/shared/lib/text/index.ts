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

/** Связки, которые голос вставляет между продуктами: «огурцы, помидоры и лук». */
const JOINERS = new Set(['и', 'а', 'еще', 'также', 'плюс']);

/**
 * Части запроса в порядке произнесения. Исходное написание сохраняется —
 * из части делается имя нового продукта.
 */
export function splitQuery(query: string): string[] {
  return query
    .split(/[,;.]+|\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= SEARCH_MIN_LENGTH && !JOINERS.has(norm(part)));
}

/**
 * Совпадение части с названием с поправкой на окончание:
 * голос говорит «огурец», в списке «Огурцы». Отрезаем до двух последних
 * букв, но оставляем минимум три — иначе «лук» совпадёт со всем подряд.
 */
function partMatches(name: string, part: string): boolean {
  const n = norm(name);
  const p = norm(part);
  if (n.includes(p)) return true;
  const stem = p.slice(0, Math.max(3, p.length - 2));
  return stem.length >= 3 && n.split(' ').some((word) => word.startsWith(stem));
}

export interface MultiSearchResult<T> {
  matches: T[];
  /** Части запроса, для которых ничего не нашлось, — им предлагаем «Создать». */
  missing: string[];
}

/**
 * Поиск нескольких продуктов одной фразой (backlog п. 21).
 *
 * Сначала фраза целиком — чтобы «масло сливочное» нашло «Масло сливочное»,
 * а не всё масло и всё сливочное. Если целиком ничего нет, ищем по частям
 * и складываем находки в порядке произнесения.
 */
export function multiSearch<T extends Nameable>(items: T[], query: string): MultiSearchResult<T> {
  const whole = searchByName(items, query);
  const parts = splitQuery(query);
  if (whole.length > 0 || parts.length <= 1) {
    return { matches: whole, missing: whole.length > 0 ? [] : [query.trim()] };
  }

  const seen = new Set<T>();
  const matches: T[] = [];
  const missing: string[] = [];
  for (const part of parts) {
    const found = items
      .filter((i) => partMatches(i.name, part))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (found.length === 0) missing.push(part);
    for (const item of found) {
      if (!seen.has(item)) { seen.add(item); matches.push(item); }
    }
  }
  return { matches, missing };
}

/** «огурцы» → «Огурцы»: имя нового продукта из произнесённой части. */
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
