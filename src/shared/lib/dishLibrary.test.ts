import { describe, expect, it } from 'vitest';
import { DISH_LIBRARY, PRODUCT_META, SET_LIBRARY } from './dishLibrary';
import { DISH_RECIPES } from './dishRecipes';
import { PRODUCT_GROUPS, dishAllowed, forbiddenGroups } from './diet';
import { dishLabel, productLabel } from './i18n';

/**
 * Целостность справочника блюд (расширение до 113 блюд, v0.20).
 *
 * Справочник живёт в четырёх местах сразу: состав (dishLibrary.ts), названия
 * (словарь), рецепты (dishRecipes.ts) и группы питания (diet.ts). Блюдо,
 * забытое хотя бы в одном из них, ломается тихо: показывается ключом вместо
 * названия, приходит без рецепта или создаёт продукт «pcs» без отдела. Этот
 * набор ловит такие пропуски до того, как их увидит Vadym.
 */

const KEYS = DISH_LIBRARY.map((d) => d.key);
const DISH_CATEGORIES = new Set(['soups', 'mains', 'salads', 'breakfasts', 'baking', 'other']);
const MEAT = new Set(['pork', 'beef', 'poultry']);

const isMeat = (ingredients: Array<[string, number | null]>) =>
  ingredients.some(([k]) => (PRODUCT_GROUPS[k] ?? []).some((g) => MEAT.has(g)));

describe('справочник блюд', () => {
  it('блюд не меньше ста — просьба Vadym 10-04', () => {
    expect(DISH_LIBRARY.length).toBeGreaterThanOrEqual(100);
  });

  it('ключи блюд не повторяются', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
  });

  it('мясных блюд не больше 10 % — условие Vadym', () => {
    const meat = DISH_LIBRARY.filter((d) => isMeat(d.ingredients));
    expect(meat.length / DISH_LIBRARY.length).toBeLessThanOrEqual(0.1);
  });

  it('у каждого блюда есть название, а не ключ', () => {
    const missing = KEYS.filter((k) => dishLabel(k) === k);
    expect(missing).toEqual([]);
  });

  it('у каждого блюда есть рецепт «Как готовить»', () => {
    const missing = KEYS.filter((k) => !DISH_RECIPES[k]?.trim());
    expect(missing).toEqual([]);
  });

  it('рецептов без блюда нет — иначе это опечатка в ключе', () => {
    const orphan = Object.keys(DISH_RECIPES).filter((k) => !KEYS.includes(k));
    expect(orphan).toEqual([]);
  });

  it('категория блюда есть в базе (0005_seed)', () => {
    const bad = DISH_LIBRARY.filter((d) => !DISH_CATEGORIES.has(d.category)).map((d) => d.key);
    expect(bad).toEqual([]);
  });

  it('у каждого ингредиента есть единица, отдел и название', () => {
    const problems: string[] = [];
    for (const dish of DISH_LIBRARY) {
      for (const [key] of dish.ingredients) {
        if (!PRODUCT_META[key]) problems.push(`${dish.key}: нет единицы и отдела у «${key}»`);
        if (productLabel(key, '') === '') problems.push(`${dish.key}: нет названия у «${key}»`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('продукт не повторяется внутри одного блюда', () => {
    const dup = DISH_LIBRARY.filter((d) => {
      const ks = d.ingredients.map(([k]) => k);
      return new Set(ks).size !== ks.length;
    }).map((d) => d.key);
    expect(dup).toEqual([]);
  });

  it('количество — положительное число или «не указано»', () => {
    const bad = DISH_LIBRARY.flatMap((d) => d.ingredients
      .filter(([, q]) => q !== null && !(q > 0))
      .map(([k, q]) => `${d.key}: ${k} = ${q}`));
    expect(bad).toEqual([]);
  });

  it('готовые наборы ссылаются только на существующие блюда', () => {
    const missing = SET_LIBRARY.flatMap((s) => s.dishes.filter((k) => !KEYS.includes(k)));
    expect(missing).toEqual([]);
  });

  it('вегетарианцу остаётся больше 80 блюд', () => {
    const forbidden = forbiddenGroups({ diet: 'vegetarian', excludes: [] });
    const allowed = DISH_LIBRARY.filter((d) => dishAllowed(d.ingredients.map(([k]) => k), forbidden));
    expect(allowed.length).toBeGreaterThan(80);
  });

  it('фалафель в лаваше не проходит в «без глютена»', () => {
    const forbidden = forbiddenGroups({ diet: 'omnivore', excludes: ['gluten'] });
    const falafel = DISH_LIBRARY.find((d) => d.key === 'falafel')!;
    expect(dishAllowed(falafel.ingredients.map(([k]) => k), forbidden)).toBe(false);
  });

  it('паэлья с морепродуктами не проходит вегетарианцу', () => {
    const forbidden = forbiddenGroups({ diet: 'vegetarian', excludes: [] });
    const paella = DISH_LIBRARY.find((d) => d.key === 'paella_seafood')!;
    expect(dishAllowed(paella.ingredients.map(([k]) => k), forbidden)).toBe(false);
  });
});
