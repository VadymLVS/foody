/**
 * Локализация. См. D-034.
 *
 * Переводов пока один, но строки не хардкодятся нигде — добавить язык
 * означает положить рядом ещё один словарь. Ретрофитить это потом
 * означало бы переписать все компоненты.
 */
import { ru } from './ru';

export type UnitCode = keyof typeof ru.units;

/*
 * Словарь пока один. Переключателя языков нет, и заготовка под него
 * (`setLanguage`, `detectLanguage`, карта словарей) убрана в пакете 3:
 * она не использовалась ни в одном месте. Смысл правила прежний —
 * строки не хардкодятся, добавить язык значит положить рядом словарь
 * и вернуть выбор (Q-4).
 */
const dict = () => ru;

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

/** Название готового набора по ключу. */
export function setLabel(key: string): string {
  return (dict().sets as Record<string, string>)[key] ?? key;
}

/** Название блюда из стартового справочника по ключу. */
export function dishLabel(key: string): string {
  return (dict().dishes as Record<string, string>)[key] ?? key;
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
