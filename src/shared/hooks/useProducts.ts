import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import type { NewProduct, ProductPatch } from '@/shared/api';
import type { Product } from '@/shared/db/types';
import { useUI } from '@/shared/store/ui';

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

export function useProducts(kitchenId: string) {
  const queryClient = useQueryClient();
  const setConnection = useUI((s) => s.setConnection);
  const isEcho = useUI((s) => s.isEcho);

  const query = useQuery({
    queryKey: qk.products(kitchenId),
    queryFn: () => repo.listProducts(kitchenId),
    enabled: Boolean(kitchenId),
  });

  useEffect(() => {
    // Кухня ещё не выбрана — подписываться не на что.
    if (!kitchenId) return;

    const unsubscribe = repo.subscribeProducts(kitchenId, ({ productId, updatedBy }) => {
      // D-010: не реагируем на эхо собственной операции, которая ещё в полёте —
      // иначе тоггл дёргается между локальным и серверным значением.
      if (isEcho(productId, updatedBy, repo.currentUserId())) return;
      void queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) });
    });
    setConnection('online');
    return unsubscribe;
  }, [kitchenId, queryClient, isEcho, setConnection]);

  return query;
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

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.products(kitchenId), context.previous);
      }
    },

    onSettled: (_data, _err, _vars, context) => {
      if (context?.id) useUI.getState().endOp(context.id);
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

export function useRenameProduct(kitchenId: string) {
  const patch = useOptimisticPatch(kitchenId);
  return (id: string, name: string) => patch.mutate({ id, patch: { name } });
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
