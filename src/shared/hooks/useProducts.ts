import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import type { NewProduct, ProductPatch } from '@/shared/api';
import type { Product } from '@/shared/db/types';
import { useUI } from '@/shared/store/ui';
import { enqueue, flush, isNetworkError, subscribe } from '@/shared/lib/opQueue';

export function useCategories(kitchenId: string) {
  return useQuery({
    queryKey: qk.categories(kitchenId),
    queryFn: () => repo.listCategories(kitchenId),
    enabled: Boolean(kitchenId),
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: qk.suggestions,
    queryFn: () => repo.listSuggestions(),
    staleTime: Infinity,
  });
}

/**
 * Только данные. Подписка на изменения вынесена в useProductsRealtime:
 * раньше она жила здесь, и каждый компонент, которому нужен список продуктов
 * (импорт чека, карусель), открывал вторую подписку на тот же канал —
 * приложение падало (backlog п. 7).
 */
export function useProducts(kitchenId: string) {
  return useQuery({
    queryKey: qk.products(kitchenId),
    queryFn: () => repo.listProducts(kitchenId),
    enabled: Boolean(kitchenId),
  });
}

/** Подписка на изменения продуктов. Вызывать ровно в одном месте — на экране списка. */
export function useProductsRealtime(kitchenId: string) {
  const queryClient = useQueryClient();
  const isEcho = useUI((s) => s.isEcho);

  useEffect(() => {
    // Кухня ещё не выбрана — подписываться не на что.
    if (!kitchenId) return;

    const unsubscribe = repo.subscribeProducts(kitchenId, ({ productId, updatedBy }) => {
      // D-010: не реагируем на эхо собственной операции, которая ещё в полёте —
      // иначе тоггл дёргается между локальным и серверным значением.
      if (isEcho(productId, updatedBy, repo.currentUserId())) return;
      void queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) });
    });
    return unsubscribe;
  }, [kitchenId, queryClient, isEcho]);
}

/**
 * Сколько изменений ждёт отправки. Ноль — всё сохранено.
 * Нужен шапке списка, чтобы в магазине было видно состояние.
 */
export function usePendingCount(): number {
  const [pending, setPending] = useState(0);
  useEffect(() => subscribe(setPending), []);
  return pending;
}

/**
 * Досылает накопленное при возврате связи и раз в пятнадцать секунд.
 * Интервал нужен потому, что событие online срабатывает при появлении
 * сетевого интерфейса, а не реального доступа: в подвале телефон
 * цепляется к вышке раньше, чем начинает ходить трафик.
 */
export function useQueueFlusher(kitchenId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!kitchenId) return;

    const run = async () => {
      const sent = await flush((op) => repo.updateProduct(op.productId, op.patch));
      if (sent > 0) {
        void queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) });
      }
    };

    const onOnline = () => void run();
    void run();
    const timer = setInterval(onOnline, 15_000);
    // Та же ссылка на функцию при снятии: иначе обработчики копились бы
    // при каждом возвращении на экран списка
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [kitchenId, queryClient]);
}

/** Общий оптимистичный апдейт: правим кэш сразу, откатываем при ошибке. */
function useOptimisticPatch(kitchenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProductPatch }) =>
      repo.updateProduct(id, patch),

    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: qk.products(kitchenId) });
      const previous = queryClient.getQueryData<Product[]>(qk.products(kitchenId));

      useUI.getState().beginOp(id, {
        field: Object.keys(patch)[0] ?? '',
        value: Object.values(patch)[0],
      });

      queryClient.setQueryData<Product[]>(qk.products(kitchenId), (old = []) =>
        old.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      return { previous, id };
    },

    onError: (error, { id, patch }, context) => {
      // Сетевая ошибка — не повод откатывать: человек уже положил товар
      // в тележку. Оставляем локальное значение и дожимаем позже.
      if (isNetworkError(error)) {
        enqueue(id, patch);
        return;
      }
      if (context?.previous) {
        queryClient.setQueryData(qk.products(kitchenId), context.previous);
      }
    },

    onSettled: (_data, error, _vars, context) => {
      if (context?.id) useUI.getState().endOp(context.id);
      // Перезапрос стёр бы локальное значение, которое ещё не доехало
      if (error && isNetworkError(error)) return;
      void queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) });
    },
  });
}

export function useToggleProduct(kitchenId: string) {
  const patch = useOptimisticPatch(kitchenId);
  return (id: string, next: boolean) => patch.mutate({ id, patch: { in_stock: next } });
}

export function useSetQuantity(kitchenId: string) {
  const patch = useOptimisticPatch(kitchenId);
  return (id: string, quantity: number) => patch.mutate({ id, patch: { quantity } });
}

/** Правка продукта из формы: название, категория, единица, картинка (backlog п. 11). */
export function useUpdateProduct(kitchenId: string) {
  const patch = useOptimisticPatch(kitchenId);
  return (id: string, changes: ProductPatch) => patch.mutate({ id, patch: changes });
}

/** Отметить наличие сразу у нескольких продуктов — шаг «что из этого уже есть?». */
export function useSetInStock(kitchenId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, inStock }: { ids: string[]; inStock: boolean }) =>
      repo.setInStock(ids, inStock),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) }),
  });
}

/** Пакетное создание. Ошибку показывает вызывающий экран — молчать нельзя (п. 1). */
export function useCreateProducts(kitchenId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: NewProduct[]) => repo.createProducts(kitchenId, inputs),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) }),
  });
}

export function useCreateProduct(kitchenId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewProduct) => repo.createProduct(kitchenId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) }),
  });
}

/** D-009: удаление без модалки, с окном отмены на стороне UI. */
export function useDeleteProduct(kitchenId: string) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => repo.softDeleteProduct(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.products(kitchenId) });
      const previous = queryClient.getQueryData<Product[]>(qk.products(kitchenId));
      queryClient.setQueryData<Product[]>(qk.products(kitchenId), (old = []) =>
        old.filter((p) => p.id !== id),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk.products(kitchenId), ctx.previous);
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => repo.restoreProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) }),
  });

  return { remove: remove.mutate, restore: restore.mutate };
}
