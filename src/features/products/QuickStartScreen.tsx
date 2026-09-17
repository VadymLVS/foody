import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, SwipeDeck, useToast, type DeckItem } from '@/shared/ui';
import { repo, qk } from '@/shared/api';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useCategories, useProducts, useSuggestions } from '@/shared/hooks/useProducts';
import { norm } from '@/shared/lib/text';
import { t } from '@/shared/lib/i18n';
import type { NewProduct } from '@/shared/api/repo';
import type { Unit } from '@/shared/db/types';

/** Восемь заранее подобранных оттенков: соседние карты всегда различимы. */
const HUES = [
  'linear-gradient(140deg,#3d5a30,#7aa855)',
  'linear-gradient(140deg,#7a4a22,#c98a4a)',
  'linear-gradient(140deg,#6b2f26,#b45a45)',
  'linear-gradient(140deg,#33404f,#5e7791)',
  'linear-gradient(140deg,#5a4630,#a08055)',
  'linear-gradient(140deg,#4a3550,#8a6aa0)',
  'linear-gradient(140deg,#2f4a48,#5a9088)',
  'linear-gradient(140deg,#6a5a2e,#b39a54)',
];

interface Pick { key: string; name: string; categoryKey: string | null; unit: Unit }

/**
 * Наполнение списка смахиванием (D-040).
 *
 * Проблема, которую это решает: на пустой кухне единственный путь —
 * форма добавления по одному продукту, и пройти её тридцать раз никто не будет.
 * Справочник в базе уже есть, не хватало способа быстро по нему пройтись.
 *
 * Отмеченное попадает в кухню как имеющееся, а не как «нужно купить».
 * Иначе первый же список покупок окажется из сорока позиций и потеряет смысл.
 * Обратное действие — один тап по ползунку, и это основной жест приложения.
 */
export function QuickStartScreen() {
  const kitchen = useCurrentKitchen();
  const kitchenId = kitchen?.id ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useSuggestions();
  const { data: products = [] } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);

  const [accepted, setAccepted] = useState<Pick[]>([]);
  const [finished, setFinished] = useState(false);

  const save = useMutation({
    mutationFn: async (picks: Pick[]) => {
      const byKey = new Map(
        categories.filter((c) => c.kind === 'product').map((c) => [c.key, c.id]),
      );
      const inputs: NewProduct[] = picks.map((pick) => ({
        name: pick.name,
        categoryId: (pick.categoryKey && byKey.get(pick.categoryKey)) ?? null,
        unit: pick.unit,
        inStock: true,
        libraryKey: pick.key,
      }));
      return repo.createProducts(kitchenId, inputs);
    },
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: qk.products(kitchenId) });
      toast.show(t('onboarding.added', { count }));
      navigate('/products');
    },
  });

  // Уже добавленное не показываем: смахивать то, что и так есть, бессмысленно
  const deck = useMemo<DeckItem[]>(() => {
    const have = new Set(products.map((p) => norm(p.name)));
    return suggestions
      .filter((s) => !have.has(norm(s.name)))
      .map((s, i) => ({
        id: s.key,
        title: s.name,
        background: HUES[i % HUES.length]!,
      }));
  }, [suggestions, products]);

  const byKey = useMemo(
    () => new Map(suggestions.map((s) => [s.key, s as Pick])),
    [suggestions],
  );

  if (isLoading) {
    return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
  }

  if (deck.length === 0 || finished || accepted.length >= deck.length) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] items-center px-6">
        <EmptyState
          title={t('onboarding.done')}
          description={t('onboarding.added', { count: accepted.length })}
          action={
            <div className="flex gap-2">
              <Button onClick={() => save.mutate(accepted)} loading={save.isPending}>
                {t('onboarding.finish')}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/products')}>
                {t('common.cancel')}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col px-3 pb-6 pt-4">
      <header className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="text-micro text-text-muted"
        >
          {t('onboarding.skip')}
        </button>
        <span className="text-micro text-[#8A8A8A]">
          {t('onboarding.added', { count: accepted.length })}
        </span>
      </header>

      <div className="mb-3.5 h-[3px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${Math.round((accepted.length / Math.max(1, deck.length)) * 100)}%` }}
        />
      </div>

      <p className="mb-3 text-center text-micro text-text-dim">{t('onboarding.hint')}</p>

      <SwipeDeck
        items={deck}
        acceptLabel="Покупаю это"
        rejectLabel="Не нужно"
        onDecide={(item, isAccepted) => {
          if (!isAccepted) return;
          const pick = byKey.get(item.id);
          if (pick) setAccepted((prev) => [...prev, pick]);
        }}
        onUndo={(item, wasAccepted) => {
          if (wasAccepted) setAccepted((prev) => prev.filter((p) => p.key !== item.id));
        }}
      />

      {accepted.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setFinished(true)}>
            {t('onboarding.finish')} · {accepted.length}
          </Button>
        </div>
      )}
    </div>
  );
}
