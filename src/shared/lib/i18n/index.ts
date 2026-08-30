/**
 * Локализация. См. D-034.
 *
 * Переводов пока один, но строки не хардкодятся нигде — добавить язык
 * означает положить рядом ещё один словарь. Ретрофитить это потом
 * означало бы переписать все компоненты.
 */
import { ru } from './ru';

export type Lang = 'ru' | 'uk' | 'en' | 'es';
export type UnitCode = keyof typeof ru.units;

const dictionaries: Record<Lang, typeof ru> = {
  ru,
  uk: ru, // TODO: перевод
  en: ru,
  es: ru,
};

let current: Lang = 'ru';

export function setLanguage(lang: Lang) {
  current = lang;
}

export function detectLanguage(): Lang {
  const code = navigator.language.slice(0, 2);
  return (['ru', 'uk', 'en', 'es'] as const).includes(code as Lang) ? (code as Lang) : 'ru';
}

const dict = () => dictionaries[current];

/** Подстановка вида t('products.create', { name: 'Огурцы' }). */
export function t(key: keyof typeof ru.ui, vars?: Record<string, string | number>): string {
  const raw: string = dict().ui[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export const unitLabel = (unit: UnitCode) => dict().units[unit] ?? unit;

/** Названия из библиотеки переводятся по ключу; свои — показываются как есть. */
export function productLabel(key: string | null, fallback: string): string {
  if (!key) return fallback;
  return (dict().products as Record<string, string>)[key] ?? fallback;
}

export function categoryLabel(
  kind: 'product' | 'dish',
  key: string | null,
  fallback: string | null,
): string {
  if (!key) return fallback ?? '';
  const table = kind === 'product' ? dict().productCategories : dict().dishCategories;
  return (table as Record<string, string>)[key] ?? fallback ?? key;
}
