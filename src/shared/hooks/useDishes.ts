import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import type { NewDish, NewProduct } from '@/shared/api/repo';
import type { Product } from '@/shared/db/types';
import { DISH_LIBRARY, PRODUCT_META } from '@/shared/lib/dishLibrary';
import { dishLabel, productLabel } from '@/shared/lib/i18n';
import { norm } from '@/shared/lib/text';

export function useDishes(kitchenId: string) {
  return useQuery({
    queryKey: qk.dishes(kitchenId),
    queryFn: () => repo.listDishes(kitchenId),
    enabled: Boolean(kitchenId),
  });
}

export function useDeck(kitchenId: string) {
  return useQuery({
    queryKey: qk.deck(kitchenId),
    queryFn: () => repo.loadDeck(kitchenId),
    enabled: Boolean(kitchenId),
    // Колода собирается один раз на сессию выбора: пересчёт в середине
    // подменил бы карты под рукой.
    staleTime: Infinity,
    refetchOnMount: false,
  });
}

/** Блюда, которые текущий пользователь собирается готовить (D-028). */
export function usePlanned(kitchenId: string) {
  return useQuery({
    queryKey: qk.planned(kitchenId),
    queryFn: () => repo.listPlanned(kitchenId),
    enabled: Boolean(kitchenId),
  });
}

/** Что нужно купить под план — сложено по всем участникам кухни (D-031). */
export function usePlanNeeds(kitchenId: string) {
  return useQuery({
    queryKey: qk.planNeeds(kitchenId),
    queryFn: () => repo.planNeeds(kitchenId),
    enabled: Boolean(kitchenId),
  });
}

export function usePlanActions(kitchenId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) });
    void qc.invalidateQueries({ queryKey: qk.planNeeds(kitchenId) });
    void qc.invalidateQueries({ queryKey: qk.planned(kitchenId) });
  };

  const add = useMutation({
    mutationFn: (dishId: string) => repo.addToPlan(kitchenId, dishId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (dishId: string) => repo.removeFromPlan(kitchenId, dishId),
    onSuccess: refresh,
  });
  const favorite = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => repo.toggleFavorite(id, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) }),
  });
  const removeDish = useMutation({
    mutationFn: (id: string) => repo.deleteDish(id),
    onSuccess: refresh,
  });

  return { add, remove, favorite, removeDish };
}

/**
 * Добавить блюда из стартового справочника (D-043).
 *
 * Продукты из состава, которых нет в кухне, заводятся сами — иначе блюдо
 * без продуктов бесполезно. Заводятся они как «нет в наличии»: выбор блюда
 * ничего не говорит о том, что лежит дома (backlog п. 8). Наличие отмечается
 * на следующем шаге, поэтому созданные продукты возвращаются вызывающему.
 *
 * Существующий продукт ищется по ключу справочника, затем по имени — чтобы
 * «Помидоры», заведённые вручную, не задублировались.
 */
export function useAddLibraryDishes(kitchenId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (keys: string[]): Promise<Product[]> => {
      const chosen = DISH_LIBRARY.filter((d) => keys.includes(d.key));
      const categories = await repo.listCategories(kitchenId);
      const productCategory = new Map(
        categories.filter((c) => c.kind === 'product').map((c) => [c.key, c.id]),
      );
      const dishCategory = new Map(
        categories.filter((c) => c.kind === 'dish').map((c) => [c.key, c.id]),
      );

      const findIn = (products: Product[], key: string) =>
        products.find((p) => p.library_key === key)
        ?? products.find((p) => norm(p.name) === norm(productLabel(key, key)));

      // 1. Недостающие продукты — одним пакетом
      const before = await repo.listProducts(kitchenId);
      const neededKeys = [...new Set(chosen.flatMap((d) => d.ingredients.map(([k]) => k)))];
      const missing: NewProduct[] = neededKeys
        .filter((key) => !findIn(before, key))
        .map((key) => ({
          name: productLabel(key, key),
          categoryId: productCategory.get(PRODUCT_META[key]?.category ?? '') ?? null,
          unit: PRODUCT_META[key]?.unit ?? 'pcs',
          inStock: false,
          libraryKey: key,
        }));
      const created = await repo.createProducts(kitchenId, missing);

      // 2. Блюда со ссылками на продукты кухни
      const after = await repo.listProducts(kitchenId);
      for (const dish of chosen) {
        const input: NewDish = {
          name: dishLabel(dish.key),
          categoryId: dishCategory.get(dish.category) ?? null,
          libraryKey: dish.key,
          ingredients: dish.ingredients.flatMap(([key, quantity]) => {
            const product = findIn(after, key);
            return product ? [{ productId: product.id, productName: product.name, quantity }] : [];
          }),
        };
        await repo.createDish(kitchenId, input);
      }
      return created;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.products(kitchenId) });
      void qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) });
      void qc.invalidateQueries({ queryKey: qk.deck(kitchenId) });
    },
  });
}

/** Своё блюдо из формы. */
export function useCreateDish(kitchenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewDish) => repo.createDish(kitchenId, input),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) });
      void qc.invalidateQueries({ queryKey: qk.deck(kitchenId) });
    },
  });
}
