import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import type { ProductList, ProductListInput } from '@/shared/api/repo';
import type { Product } from '@/shared/db/types';

/**
 * Списки покупок (backlog п. 45).
 *
 * Выбор списка ничего не меняет в продуктах — он сужает выдачу. Поэтому здесь
 * нет ни «применить», ни отката: чтение, правка состава, заявка у позиции
 * и закрытие разового списка после поездки.
 */
export function useProductLists(kitchenId: string) {
  return useQuery({
    queryKey: qk.lists(kitchenId),
    queryFn: () => repo.listProductLists(kitchenId),
    enabled: Boolean(kitchenId),
  });
}

/**
 * Разовый список создаёт один человек, а видит другой: без подписки он
 * узнал бы о нём только после перезапуска — то есть уже из магазина.
 */
export function useProductListsRealtime(kitchenId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!kitchenId) return;
    return repo.subscribeProductLists(kitchenId, () => {
      void queryClient.invalidateQueries({ queryKey: qk.lists(kitchenId) });
    });
  }, [kitchenId, queryClient]);
}

/** Активный разовый список — он же самый свежий: их не может быть много. */
export function useActiveOnceList(lists: ProductList[] | undefined): ProductList | null {
  return useMemo(() => {
    const once = (lists ?? []).filter((l) => l.kind === 'once');
    return once.length > 0 ? once[once.length - 1]! : null;
  }, [lists]);
}

export function useProductListActions(kitchenId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.lists(kitchenId) });

  const save = useMutation({
    mutationFn: ({ input, id }: { input: ProductListInput; id?: string }) =>
      repo.saveProductList(kitchenId, input, id),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => repo.deleteProductList(id),
    onSuccess: invalidate,
  });

  const close = useMutation({
    mutationFn: (id: string) => repo.closeProductList(id),
    onSuccess: invalidate,
  });

  /*
   * Заявка у позиции уже сохранённого списка (п. 46): её правят прямо
   * в магазине, не открывая форму. Оптимистично, как отметка наличия:
   * дожидаться ответа на каждое нажатие «+» — значит видеть, как число
   * догоняет палец.
   */
  const setQuantity = useMutation({
    mutationFn: ({ listId, productId, quantity }:
      { listId: string; productId: string; quantity: number }) =>
      repo.setListItemQuantity(listId, productId, quantity),
    onMutate: ({ listId, productId, quantity }) => {
      const key = qk.lists(kitchenId);
      const previous = queryClient.getQueryData<ProductList[]>(key);
      queryClient.setQueryData<ProductList[]>(key, (lists) => (lists ?? []).map((l) => (
        l.id === listId
          ? { ...l, items: l.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)) }
          : l
      )));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(qk.lists(kitchenId), context.previous);
    },
    onSuccess: invalidate,
  });

  /*
   * Отметка «куплено» у позиции списка (п. 49, миграция 0011).
   *
   * Решение Vadym (10-01): отметка значит «куплено» и сразу ставит наличие
   * дома — иначе после магазина пришлось бы отмечать всё второй раз, ради
   * чего приложение и делалось. Снятие убирает «куплено» и возвращает
   * наличие к `stockBefore`, то есть к тому, как было до поездки: брокколи
   * дома были, лука не было, и «не купил» ведёт себя по-разному.
   *
   * Количество продукта при снятии не обнуляется, хотя D-075 обнуляет его
   * при выключении ползунка в обычном списке. Там выключение значит
   * «кончилось», здесь — «не купил»; обнуление стёрло бы то, сколько
   * лежало дома до поездки.
   *
   * Два запроса подряд, а не RPC: позиция и продукт лежат в разных таблицах,
   * и заводить функцию ради двух полей незачем. Если второй запрос упадёт,
   * откатываем оба кэша — расхождение видно сразу, а не после перезагрузки.
   */
  const setBought = useMutation({
    mutationFn: async ({ listId, productId, bought, stockBefore }: {
      listId: string; productId: string; bought: boolean; stockBefore: boolean;
    }) => {
      await repo.setListItemBought(listId, productId, bought);
      await repo.setInStock([productId], bought ? true : stockBefore);
    },
    onMutate: async ({ listId, productId, bought, stockBefore }) => {
      await queryClient.cancelQueries({ queryKey: qk.lists(kitchenId) });
      const lists = queryClient.getQueryData<ProductList[]>(qk.lists(kitchenId));
      const products = queryClient.getQueryData<Product[]>(qk.products(kitchenId));
      queryClient.setQueryData<ProductList[]>(qk.lists(kitchenId), (old) => (old ?? []).map((l) => (
        l.id === listId
          ? { ...l, items: l.items.map((i) => (i.productId === productId ? { ...i, bought } : i)) }
          : l
      )));
      queryClient.setQueryData<Product[]>(qk.products(kitchenId), (old) => (old ?? []).map((p) => (
        p.id === productId ? { ...p, in_stock: bought ? true : stockBefore } : p
      )));
      return { lists, products };
    },
    onError: (_e, _v, context) => {
      if (context?.lists) queryClient.setQueryData(qk.lists(kitchenId), context.lists);
      if (context?.products) queryClient.setQueryData(qk.products(kitchenId), context.products);
    },
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) });
    },
  });

  return { save, remove, close, setQuantity, setBought };
}
