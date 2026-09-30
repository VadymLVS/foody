import { describe, expect, it } from 'vitest';
import type { Category, Product } from '@/shared/db/types';
import { groupByCategory } from './grouping';

const categories: Category[] = [
  { id: 'c-dairy', kitchen_id: 'k', kind: 'product', key: 'dairy', name: null, sort_order: 30 },
  { id: 'c-veg', kitchen_id: 'k', kind: 'product', key: 'vegetables', name: null, sort_order: 10 },
  { id: 'c-soups', kitchen_id: 'k', kind: 'dish', key: 'soups', name: null, sort_order: 10 },
];

const product = (name: string, categoryId: string | null): Product => ({
  id: `p-${name}`, kitchen_id: 'k', name, category_id: categoryId,
  unit: 'pcs', quantity: 0, in_stock: false, library_key: null,
  deleted_at: null, updated_by: null, updated_at: '',
});

describe('groupByCategory', () => {
  it('идёт в порядке отделов магазина, а не по алфавиту названий (D-007)', () => {
    const groups = groupByCategory(
      [product('Молоко', 'c-dairy'), product('Огурцы', 'c-veg')],
      categories,
    );
    expect(groups.map((g) => g.title)).toEqual(['Овощи', 'Молочка']);
  });

  it('внутри отдела — алфавит', () => {
    const groups = groupByCategory(
      [product('Яблоки', 'c-veg'), product('Авокадо', 'c-veg')],
      categories,
    );
    expect(groups[0]!.products.map((p) => p.name)).toEqual(['Авокадо', 'Яблоки']);
  });

  it('продукты без категории уходят в конец', () => {
    const groups = groupByCategory(
      [product('Салфетки', null), product('Огурцы', 'c-veg')],
      categories,
    );
    expect(groups.map((g) => g.title)).toEqual(['Овощи', 'Прочее']);
  });

  it('категории блюд в отделах продуктов не участвуют', () => {
    const groups = groupByCategory([product('Борщ?', 'c-soups')], categories);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBe('Прочее');
  });

  it('пустой список — пустая группировка, а не группа-пустышка', () => {
    expect(groupByCategory([], categories)).toEqual([]);
  });
});
