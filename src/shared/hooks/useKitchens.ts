import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kitchens, qk } from '@/shared/api';
import { useUI } from '@/shared/store/ui';

export function useKitchens() {
  const query = useQuery({ queryKey: qk.kitchens, queryFn: () => kitchens.list() });
  const currentKitchenId = useUI((s) => s.currentKitchenId);
  const setKitchen = useUI((s) => s.setKitchen);

  // Если активная кухня не выбрана или её больше нет (вышли, удалили) —
  // переключаемся на первую доступную, а не показываем пустой экран.
  useEffect(() => {
    const list = query.data;
    if (!list || list.length === 0) return;
    const stillExists = list.some((k) => k.id === currentKitchenId);
    if (!stillExists) setKitchen(list[0]!.id);
  }, [query.data, currentKitchenId, setKitchen]);

  return query;
}

export function useCurrentKitchen() {
  const { data: list = [] } = useKitchens();
  const currentKitchenId = useUI((s) => s.currentKitchenId);
  return list.find((k) => k.id === currentKitchenId) ?? list[0] ?? null;
}

export function useMembers(kitchenId: string | null) {
  return useQuery({
    queryKey: qk.members(kitchenId ?? ''),
    queryFn: () => kitchens.listMembers(kitchenId!),
    enabled: Boolean(kitchenId),
  });
}

export function useKitchenActions() {
  const queryClient = useQueryClient();
  const setKitchen = useUI((s) => s.setKitchen);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.kitchens });

  const create = useMutation({
    mutationFn: (name: string) => kitchens.create(name),
    onSuccess: (id) => {
      setKitchen(id);
      void invalidate();
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => kitchens.rename(id, name),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => kitchens.remove(id),
    onSuccess: () => {
      setKitchen(null);
      void invalidate();
    },
  });

  const leave = useMutation({
    mutationFn: (id: string) => kitchens.leave(id),
    onSuccess: () => {
      setKitchen(null);
      void invalidate();
    },
  });

  const regenerateInvite = useMutation({
    mutationFn: (id: string) => kitchens.regenerateInvite(id),
    onSuccess: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      kitchens.removeMember(id, userId),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: qk.members(variables.id) }),
  });

  return { create, rename, remove, leave, regenerateInvite, removeMember };
}
