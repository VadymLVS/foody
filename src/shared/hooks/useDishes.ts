import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import type { DishWithStatus, NewDish, NewProduct } from '@/shared/api/repo';
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
    void qc.invalidateQueries({ queryKey: qk.sets(kitchenId) });
  };

  /*
   * Выбор отражается сразу, до ответа базы (backlog п. 17).
   * Раньше медаль ждала сети, а после ответа список блюд приходил
   * в другом порядке — плитки перескакивали. Порядок теперь стабильный,
   * а отметка оптимистичная с откатом при ошибке.
   */
  const setPlanned = (dishId: string, value: boolean) =>
    qc.setQueryData<DishWithStatus[]>(qk.dishes(kitchenId), (old) =>
      old?.map((d) => (d.id === dishId ? { ...d, isPlanned: value } : d)));

  const planMutation = (value: boolean) => ({
    onMutate: async (dishId: string) => {
      // Запрос, ушедший до нажатия, не должен затереть отметку старыми данными
      await qc.cancelQueries({ queryKey: qk.dishes(kitchenId) });
      setPlanned(dishId, value);
    },
    onError: (_e: unknown, dishId: string) => setPlanned(dishId, !value),
    onSettled: refresh,
  });

  const add = useMutation({
    mutationFn: (dishId: string) => repo.addToPlan(kitchenId, dishId),
    ...planMutation(true),
  });
  const remove = useMutation({
    mutationFn: (dishId: string) => repo.removeFromPlan(kitchenId, dishId),
    ...planMutation(false),
  });
  const favorite = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => repo.toggleFavorite(id, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) }),
  });
  const removeDish = useMutation({
    mutationFn: (id: string) => repo.deleteDish(id),
    onSuccess: refresh,
  });
  const restoreDish = useMutation({
    mutationFn: (id: string) => repo.restoreDish(id),
    onSuccess: refresh,
  });

  return { add, remove, favorite, removeDish, restoreDish };
}

/**
 * Завести в кухне блюда и продукты из справочника, которых ещё нет (D-043, D-054).
 *
 * Продукты из состава, которых нет в кухне, заводятся сами — иначе блюдо
 * без продуктов бесполезно. Заводятся они как «нет в наличии»: выбор блюда
 * ничего не говорит о том, что лежит дома (backlog п. 8). Наличие отмечается
 * на следующем шаге, поэтому созданные продукты возвращаются вызывающему.
 *
 * Существующее ищется по ключу справочника, затем по имени — чтобы
 * «Помидоры», заведённые вручную, не задублировались.
 */
export async function ensureLibraryItems(
  kitchenId: string,
  { dishKeys, productKeys, stockedKeys = [] }: {
    dishKeys: string[];
    productKeys: string[];
    /**
     * Продукты, которые заводятся как «в наличии» (D-055): продукты набора без блюда.
     * Применение набора само переведёт их в «Купить», а снятие вернёт обратно —
     * иначе после снятия набора в списке оставался бы уголь, которого раньше не было.
     */
    stockedKeys?: string[];
  },
): Promise<{ created: Product[]; dishIdByKey: Map<string, string>; productByKey: Map<string, Product> }> {
  const categories = await repo.listCategories(kitchenId);
  const productCategory = new Map(
    categories.filter((c) => c.kind === 'product').map((c) => [c.key, c.id]),
  );
  const dishCategory = new Map(
    categories.filter((c) => c.kind === 'dish').map((c) => [c.key, c.id]),
  );

  const findProduct = (products: Product[], key: string) =>
    products.find((p) => p.library_key === key)
    ?? products.find((p) => norm(p.name) === norm(productLabel(key, key)));

  const existingDishes = await repo.listDishes(kitchenId);
  const findDish = (key: string) =>
    existingDishes.find((d) => d.library_key === key)
    ?? existingDishes.find((d) => norm(d.name) === norm(dishLabel(key)));

  const dishesToCreate = DISH_LIBRARY.filter((d) => dishKeys.includes(d.key) && !findDish(d.key));

  // 1. Недостающие продукты — одним пакетом
  const before = await repo.listProducts(kitchenId);
  const neededKeys = [...new Set([
    ...dishesToCreate.flatMap((d) => d.ingredients.map(([k]) => k)),
    ...productKeys,
  ])];
  const missing: NewProduct[] = neededKeys
    .filter((key) => !findProduct(before, key))
    .map((key) => ({
      name: productLabel(key, key),
      categoryId: productCategory.get(PRODUCT_META[key]?.category ?? '') ?? null,
      unit: PRODUCT_META[key]?.unit ?? 'pcs',
      inStock: stockedKeys.includes(key),
      libraryKey: key,
    }));
  const created = await repo.createProducts(kitchenId, missing);

  // 2. Недостающие блюда со ссылками на продукты кухни
  const after = await repo.listProducts(kitchenId);
  const dishIdByKey = new Map<string, string>();
  for (const key of dishKeys) {
    const found = findDish(key);
    if (found) dishIdByKey.set(key, found.id);
  }
  for (const dish of dishesToCreate) {
    const input: NewDish = {
      name: dishLabel(dish.key),
      categoryId: dishCategory.get(dish.category) ?? null,
      libraryKey: dish.key,
      ingredients: dish.ingredients.flatMap(([key, quantity]) => {
        const product = findProduct(after, key);
        return product ? [{ productId: product.id, productName: product.name, quantity }] : [];
      }),
    };
    dishIdByKey.set(dish.key, await repo.createDish(kitchenId, input));
  }

  const productByKey = new Map<string, Product>();
  for (const key of productKeys) {
    const product = findProduct(after, key);
    if (product) productByKey.set(key, product);
  }
  return { created, dishIdByKey, productByKey };
}

/** Добавить блюда из стартового справочника (карусель блюд). */
export function useAddLibraryDishes(kitchenId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (keys: string[]): Promise<Product[]> =>
      (await ensureLibraryItems(kitchenId, { dishKeys: keys, productKeys: [] })).created,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.products(kitchenId) });
      void qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) });
      void qc.invalidateQueries({ queryKey: qk.deck(kitchenId) });
    },
  });
}

/** Правка блюда (п. 32): план и «Для плана» пересчитываются из нового состава. */
export function useUpdateDish(kitchenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: NewDish }) => repo.updateDish(id, input),
    onSettled: () => {
      for (const key of [qk.dishes(kitchenId), qk.deck(kitchenId), qk.planNeeds(kitchenId), qk.sets(kitchenId)]) {
        void qc.invalidateQueries({ queryKey: key });
      }
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

/**
 * Блюдо справочника — в меню одним нажатием из каталога (п. 57).
 *
 * Блюдо заводится в кухне вместе с недостающими продуктами и сразу встаёт в меню.
 * Новые продукты заводятся как «нет дома»: выбранное в меню блюдо — повод
 * купить, а не утверждение, что всё лежит дома (п. 8). Шага «что из этого уже
 * есть?», как после карусели, здесь нет: он прерывал бы составление меню на
 * каждом блюде; наличие отмечается в карточке блюда или в «Купить».
 *
 * Нажатия выстраиваются в очередь. Два блюда с общим продуктом, выбранные
 * подряд, иначе одновременно решили бы, что продукта нет, и завели бы его
 * дважды. `pending` — блюда, которые ещё заводятся: плитка показывает их
 * выбранными сразу, не дожидаясь сети (п. 17).
 */
export function useAddLibraryToMenu(kitchenId: string, onError: (e: unknown) => void) {
  const qc = useQueryClient();
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  /*
   * Что завела эта сессия выбора — для «Отмены» (п. 40). Блюдо справочника
   * заводится в кухне вместе с продуктами, и «Отмена» обязана убрать и то, и
   * другое: иначе блюдо осталось бы в меню, а его продукты — в «Купить».
   * Записываем только между `startSession` и `endSession`/`undoSession`:
   * добавление из карточки блюда — отдельное действие, его «Отмена» не трогает.
   */
  const session = useRef<{ active: boolean; dishIds: string[]; productIds: string[] }>({
    active: false, dishIds: [], productIds: [],
  });

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: qk.dishes(kitchenId) }),
    qc.invalidateQueries({ queryKey: qk.products(kitchenId) }),
    qc.invalidateQueries({ queryKey: qk.planNeeds(kitchenId) }),
    qc.invalidateQueries({ queryKey: qk.planned(kitchenId) }),
    qc.invalidateQueries({ queryKey: qk.deck(kitchenId) }),
  ]);

  const done = (key: string) => setPending((prev) => {
    const next = new Set(prev);
    next.delete(key);
    return next;
  });

  const addToMenu = (key: string) => {
    if (pending.has(key)) return;
    setPending((prev) => new Set(prev).add(key));
    const recording = session.current.active;
    chain.current = chain.current
      .then(async () => {
        const { created, dishIdByKey } = await ensureLibraryItems(kitchenId, { dishKeys: [key], productKeys: [] });
        const id = dishIdByKey.get(key);
        if (id) await repo.addToPlan(kitchenId, id);
        if (recording && session.current.active) {
          if (id) session.current.dishIds.push(id);
          session.current.productIds.push(...created.map((p) => p.id));
        }
        // Метку снимаем только после того, как пришёл свежий список блюд:
        // иначе плитка на мгновение мигнула бы невыбранной
        await refresh();
      })
      .catch(onError)
      .finally(() => done(key));
  };

  const startSession = () => {
    session.current = { active: true, dishIds: [], productIds: [] };
  };
  const endSession = () => {
    session.current = { active: false, dishIds: [], productIds: [] };
  };

  /**
   * Отменить всё, что завела сессия: дождаться заводимого, снять из меню,
   * убрать блюда и созданные ими продукты. Удаление мягкое, как везде.
   * Возвращает id убранных блюд — вызывающему не нужно снимать их второй раз.
   */
  const undoSession = async (): Promise<string[]> => {
    await chain.current;
    const { dishIds, productIds } = session.current;
    endSession();
    for (const id of dishIds) {
      await repo.removeFromPlan(kitchenId, id);
      await repo.deleteDish(id);
    }
    for (const id of productIds) await repo.softDeleteProduct(id);
    if (dishIds.length > 0 || productIds.length > 0) await refresh();
    return dishIds;
  };

  return { addToMenu, pending, startSession, endSession, undoSession, settled: () => chain.current };
}
