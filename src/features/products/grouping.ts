import type { Category, Product } from '@/shared/db/types';
import { categoryLabel } from '@/shared/lib/i18n';

export interface Group {
  categoryId: string | null;
  title: string;
  products: Product[];
}

/**
 * Группировка в порядке отделов магазина (D-007), внутри — алфавит.
 * Заголовок обычным регистром, не капслоком: на мелком кегле кириллица
 * в капслоке превращается в кашу.
 */
export function groupByCategory(products: Product[], categories: Category[]): Group[] {
  const byId = new Map(categories.filter((c) => c.kind === 'product').map((c) => [c.id, c]));
  const buckets = new Map<string | null, Product[]>();

  for (const product of products) {
    const bucket = buckets.get(product.category_id);
    if (bucket) bucket.push(product);
    else buckets.set(product.category_id, [product]);
  }

  return [...buckets.entries()]
    .map(([categoryId, items]) => {
      const category = categoryId ? byId.get(categoryId) : undefined;
      return {
        categoryId,
        title: category ? categoryLabel('product', category.key, category.name) : 'Прочее',
        order: category?.sort_order ?? 9999,
        products: items.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ categoryId, title, products: items }) => ({ categoryId, title, products: items }));
}
