import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repo, qk } from '@/shared/api';
import { forbiddenGroups, type DietProfile } from '@/shared/lib/diet';

/** Питание текущего человека (п. 36). */
export function useDiet() {
  return useQuery({ queryKey: qk.diet, queryFn: () => repo.getDiet(), staleTime: Infinity });
}

/** Запрещённые группы продуктов — для фильтра подсказок. */
export function useForbidden() {
  const { data } = useDiet();
  // Одно и то же множество между рендерами — иначе зависимые эффекты перезапускались бы
  return useMemo(() => forbiddenGroups(data), [data]);
}

export function useSaveDiet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: DietProfile) => repo.saveDiet(profile),
    onMutate: (profile) => { qc.setQueryData(qk.diet, profile); },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.diet }),
  });
}
