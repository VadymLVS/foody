import { describe, expect, it } from 'vitest';
import { buildCatalog, libraryKeyOf } from './dishCatalog';
import { DISH_LIBRARY } from './dishLibrary';
import { forbiddenGroups } from './diet';
import type { DishWithStatus } from '@/shared/api/repo';
import type { Category, Product } from '@/shared/db/types';

const K = 'k1';
const categories: Category[] = [
  { id: 'c-soups', kitchen_id: null, kind: 'dish', key: 'soups', name: null, sort_order: 10 },
  { id: 'c-mains', kitchen_id: null, kind: 'dish', key: 'mains', name: null, sort_order: 20 },
  { id: 'c-break', kitchen_id: null, kind: 'dish', key: 'breakfasts', name: null, sort_order: 40 },
];
const product = (id: string, name: string, key: string | null, inStock: boolean): Product => ({
  id, kitchen_id: K, name, category_id: null, unit: 'pcs', quantity: 0, in_stock: inStock,
  library_key: key, image_path: null, deleted_at: null, updated_at: '', updated_by: null,
} as unknown as Product);
const kitchenDish = (id: string, name: string, key: string | null): DishWithStatus => ({
  id, kitchen_id: K, name, category_id: null, image_path: null, library_key: key,
  image_w: null, image_h: null, deleted_at: null,
  missingCount: 0, missingNames: [], isFavorite: false, isPlanned: true,
});

const none = forbiddenGroups({ diet: 'omnivore', excludes: [] });

describe('каталог блюд (п. 57)', () => {
  it('пустая кухня видит весь справочник', () => {
    const c = buildCatalog({ kitchenId: K, dishes: [], products: [], categories, forbidden: none });
    expect(c).toHaveLength(DISH_LIBRARY.length);
    expect(c.every((d) => d.isLibrary)).toBe(true);
  });

  it('блюдо, уже заведённое в кухне, не дублируется справочником', () => {
    const c = buildCatalog({
      kitchenId: K, dishes: [kitchenDish('d1', 'Шакшука', 'shakshuka')],
      products: [], categories, forbidden: none,
    });
    expect(c.filter((d) => d.name === 'Шакшука')).toHaveLength(1);
    expect(c.find((d) => d.name === 'Шакшука')!.isLibrary).toBe(false);
  });

  it('совпадение по имени тоже считается — блюдо, заведённое вручную', () => {
    const c = buildCatalog({
      kitchenId: K, dishes: [kitchenDish('d1', 'шакшука', null)],
      products: [], categories, forbidden: none,
    });
    expect(c.filter((d) => d.name.toLowerCase() === 'шакшука')).toHaveLength(1);
  });

  it('питание отсекает блюда справочника…', () => {
    const veg = forbiddenGroups({ diet: 'vegetarian', excludes: [] });
    const c = buildCatalog({ kitchenId: K, dishes: [], products: [], categories, forbidden: veg });
    expect(c.find((d) => d.library_key === 'pasta_carbonara')).toBeUndefined();
    expect(c.find((d) => d.library_key === 'paella_seafood')).toBeUndefined();
    expect(c.find((d) => d.library_key === 'shakshuka')).toBeDefined();
  });

  it('…но не блюда кухни: кухня общая, чужое не прячется (D-060)', () => {
    const veg = forbiddenGroups({ diet: 'vegetarian', excludes: [] });
    const c = buildCatalog({
      kitchenId: K, dishes: [kitchenDish('d1', 'Паста карбонара', 'pasta_carbonara')],
      products: [], categories, forbidden: veg,
    });
    expect(c.find((d) => d.name === 'Паста карбонара')).toBeDefined();
  });

  it('категория берётся из категорий кухни по ключу', () => {
    const c = buildCatalog({ kitchenId: K, dishes: [], products: [], categories, forbidden: none });
    expect(c.find((d) => d.library_key === 'shakshuka')!.category_id).toBe('c-break');
    expect(c.find((d) => d.library_key === 'borscht_veg')!.category_id).toBe('c-soups');
  });

  it('недостающее считается по наличию продуктов кухни', () => {
    const products = [
      product('p-eggs', 'Яйца', 'eggs', true),
      product('p-tom', 'Помидоры', 'tomato', false),
    ];
    const c = buildCatalog({ kitchenId: K, dishes: [], products, categories, forbidden: none });
    const shak = c.find((d) => d.library_key === 'shakshuka')!;
    expect(shak.missingNames).not.toContain('Яйца');
    expect(shak.missingNames).toContain('Помидоры');
    // Продукта нет в кухне вовсе — тоже не хватает
    expect(shak.missingNames).toContain('Паприка');
    expect(shak.ingredients!.find((i) => i.product_name === 'Яйца')!.product_id).toBe('p-eggs');
    expect(shak.ingredients!.find((i) => i.product_name === 'Паприка')!.product_id).toBeNull();
  });

  it('сортировка по алфавиту — общая для кухни и справочника', () => {
    const c = buildCatalog({
      kitchenId: K, dishes: [kitchenDish('d1', 'Омлет', 'omelette')],
      products: [], categories, forbidden: none,
    });
    const names = c.map((d) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
  });

  it('id виртуального блюда несёт ключ справочника', () => {
    expect(libraryKeyOf('lib:shakshuka')).toBe('shakshuka');
    expect(libraryKeyOf('2f7c…')).toBeNull();
  });
});
