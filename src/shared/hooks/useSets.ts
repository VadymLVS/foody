import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import type { DishSet, DishSetInput } from '@/shared/api/repo';
import type { Product } from '@/shared/db/types';
import { SET_LIBRARY, type LibrarySet } from '@/shared/lib/dishLibrary';
import { setLabel } from '@/shared/lib/i18n';
import { ensureLibraryItems } from './useDishes';

/** Наборы кухни и готовые наборы, которые ещё не заводились (D-053, D-054). */
export function useSets(kitchenId: string) {
  return useQuery({
    queryKey: qk.sets(kitchenId),
    queryFn: () => repo.listSets(kitchenId),
    enabled: Boolean(kitchenId),
    select: (listing) => ({
      sets: listing.sets,
      library: SET_LIBRARY.filter((s) => !listing.usedLibraryKeys.includes(s.key)),
    }),
  });
}

/** Набор нужен сразу в нескольких местах: всё, что он меняет, обновляется разом. */
function useRefreshPlan(kitchenId: string) {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      qk.sets(kitchenId), qk.dishes(kitchenId), qk.products(kitchenId),
      qk.planNeeds(kitchenId), qk.planned(kitchenId), qk.deck(kitchenId),
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

/**
 * Завести готовый набор в кухне: недостающие блюда и продукты создаются,
 * набор становится обычным набором кухни с ключом справочника.
 */
async function materialize(kitchenId: string, lib: LibrarySet) {
  const extraKeys = lib.products.map(([key]) => key);
  const { created, dishIdByKey, productByKey } = await ensureLibraryItems(kitchenId, {
    dishKeys: lib.dishes,
    productKeys: extraKeys,
    stockedKeys: extraKeys,
  });
  const input: DishSetInput = {
    name: setLabel(lib.key),
    libraryKey: lib.key,
    dishIds: lib.dishes.flatMap((key) => {
      const id = dishIdByKey.get(key);
      return id ? [id] : [];
    }),
    products: lib.products.flatMap(([key, quantity]) => {
      const product = productByKey.get(key);
      return product ? [{ productId: product.id, quantity }] : [];
    }),
  };
  const setId = await repo.saveSet(kitchenId, input);
  const set = (await repo.listSets(kitchenId)).sets.find((s) => s.id === setId) ?? null;
  // На шаг «что уже есть дома?» — только продукты для блюд: продукты без блюда
  // заведены «в наличии», и их переводит в «Купить» само применение набора
  return { setId, set, created: created.filter((p) => !p.in_stock) };
}

export type SetRef = { set: DishSet } | { library: LibrarySet };

/**
 * Готовим набор. Возвращает продукты, которые пришлось создать, —
 * для шага «что из этого уже есть дома?», как после карусели блюд.
 */
export function useApplySet(kitchenId: string) {
  const refresh = useRefreshPlan(kitchenId);
  return useMutation({
    mutationFn: async (ref: SetRef): Promise<Product[]> => {
      if ('set' in ref) {
        await repo.applySet(ref.set.id);
        return [];
      }
      const { setId, created } = await materialize(kitchenId, ref.library);
      await repo.applySet(setId);
      return created;
    },
    onSettled: refresh,
  });
}

/** Готовый набор перед правкой заводится в кухне — править можно только своё. */
export function useMaterializeSet(kitchenId: string) {
  const refresh = useRefreshPlan(kitchenId);
  return useMutation({
    mutationFn: (lib: LibrarySet) => materialize(kitchenId, lib),
    onSettled: refresh,
  });
}

export function useSaveSet(kitchenId: string) {
  const refresh = useRefreshPlan(kitchenId);
  return useMutation({
    mutationFn: ({ input, id }: { input: DishSetInput; id?: string }) => repo.saveSet(kitchenId, input, id),
    onSettled: refresh,
  });
}

export function useRemovePlannedSet(kitchenId: string) {
  const refresh = useRefreshPlan(kitchenId);
  return useMutation({
    mutationFn: (plannedSetId: string) => repo.removePlannedSet(plannedSetId),
    onSettled: refresh,
  });
}

/** Удалить набор. Если он в плане — сначала снять, чтобы продукты вернулись как были. */
export function useDeleteSet(kitchenId: string) {
  const refresh = useRefreshPlan(kitchenId);
  return useMutation({
    mutationFn: async (ref: SetRef) => {
      if ('library' in ref) {
        await repo.hideLibrarySet(kitchenId, ref.library.key);
        return;
      }
      if (ref.set.plannedSetId) await repo.removePlannedSet(ref.set.plannedSetId);
      await repo.deleteSet(ref.set.id);
    },
    onSettled: refresh,
  });
}

export function useClearPlan(kitchenId: string) {
  const refresh = useRefreshPlan(kitchenId);
  return useMutation({
    mutationFn: () => repo.clearPlan(kitchenId),
    onSettled: refresh,
  });
}
