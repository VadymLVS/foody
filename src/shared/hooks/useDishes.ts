import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';

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
