import type { DishWithStatus } from '@/shared/api/repo';
import type { Category, DishIngredient, Product } from '@/shared/db/types';
import { DISH_LIBRARY } from './dishLibrary';
import { dishAllowed, type DietGroup } from './diet';
import { dishLabel, productLabel } from './i18n';
import { norm } from './text';

/** id блюда справочника, которого ещё нет в кухне: «lib:shakshuka». */
export const LIBRARY_PREFIX = 'lib:';

export const libraryKeyOf = (id: string): string | null =>
  (id.startsWith(LIBRARY_PREFIX) ? id.slice(LIBRARY_PREFIX.length) : null);

export interface CatalogDish extends DishWithStatus {
  /** Блюдо справочника, ещё не заведённое в кухне. */
  isLibrary: boolean;
}

/**
 * Каталог блюд — всё, что есть в кухне, и всё из справочника, что подходит
 * по питанию (backlog п. 57, просьба Vadym 10-04).
 *
 * Зачем. Справочник был виден только через карусель, а карусель — способ
 * выбирать, когда не знаешь, чего хочешь. Когда хочется выбрать конкретное
 * на неделю, нужна вся витрина сразу. Vadym: «нужно во всех блюдах отображать
 * все сразу, что есть в базе, только исключая диету».
 *
 * Блюдо справочника в каталоге — «виртуальное»: в кухне его нет, пока его не
 * выберут. Тогда оно заводится вместе с недостающими продуктами
 * (`ensureLibraryItems`) и встаёт в меню. До этого оно живёт только здесь,
 * и кухню не захламляет — 83 блюда, которые никто не выбирал, в базе не нужны.
 *
 * Питание отсекает только блюда справочника. Блюда кухни показываются всегда,
 * даже неподходящие: кухня общая, и то, что завёл другой человек, прятать
 * нельзя (D-060).
 *
 * Порядок — по алфавиту, общий для кухни и справочника. При выборе блюдо
 * превращается из виртуального в настоящее, и если бы кухня шла первой, плитка
 * перескакивала бы через всю сетку — то, на что Vadym уже жаловался (п. 17).
 */
export function buildCatalog({
  kitchenId, dishes, products, categories, forbidden,
}: {
  kitchenId: string;
  dishes: DishWithStatus[];
  products: Product[];
  categories: Category[];
  forbidden: Set<DietGroup>;
}): CatalogDish[] {
  const have = new Set(dishes.flatMap((d) => [d.library_key ?? '', norm(d.name)]));
  const dishCategory = new Map(
    categories.filter((c) => c.kind === 'dish').map((c) => [c.key, c.id]),
  );

  // Тот же поиск продукта, что при заведении блюда (useDishes.findProduct):
  // по ключу справочника, затем по имени — «Помидоры», заведённые вручную, тоже считаются
  const byKey = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of products) {
    if (p.library_key) byKey.set(p.library_key, p);
    byName.set(norm(p.name), p);
  }
  const productFor = (key: string) => byKey.get(key) ?? byName.get(norm(productLabel(key, key)));
  const byId = new Map(products.map((p) => [p.id, p]));

  const virtual: CatalogDish[] = DISH_LIBRARY
    .filter((d) => !have.has(d.key) && !have.has(norm(dishLabel(d.key))))
    .filter((d) => dishAllowed(d.ingredients.map(([k]) => k), forbidden))
    .map((d) => {
      const id = `${LIBRARY_PREFIX}${d.key}`;
      const ingredients: DishIngredient[] = d.ingredients.map(([key, quantity], i) => {
        const product = productFor(key);
        return {
          id: `${id}-i${i}`,
          dish_id: id,
          product_id: product?.id ?? null,
          product_name: product?.name ?? productLabel(key, key),
          quantity,
        };
      });
      // Не хватает того, чего в кухне нет вовсе или что не отмечено «есть дома»
      const missingNames = ingredients
        .filter((ing) => !(ing.product_id && byId.get(ing.product_id)?.in_stock))
        .map((ing) => ing.product_name);
      return {
        id,
        kitchen_id: kitchenId,
        name: dishLabel(d.key),
        category_id: dishCategory.get(d.category) ?? null,
        image_path: null,
        library_key: d.key,
        image_w: null,
        image_h: null,
        deleted_at: null,
        recipe: null,
        ingredients,
        missingCount: missingNames.length,
        missingNames,
        isFavorite: false,
        isPlanned: false,
        isLibrary: true,
      };
    });

  return [
    ...dishes.map((d) => ({ ...d, isLibrary: false })),
    ...virtual,
  ].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}
