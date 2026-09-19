import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, SwipeDeck, useToast, type DeckItem } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useAddLibraryDishes, useDishes } from '@/shared/hooks/useDishes';
import { DISH_LIBRARY } from '@/shared/lib/dishLibrary';
import { dishLabel, productLabel, t } from '@/shared/lib/i18n';
import { norm } from '@/shared/lib/text';
import { DECK_HUES } from '@/features/products/QuickStartScreen';
import { StockCheck } from '@/features/products/StockCheck';
import type { Product } from '@/shared/db/types';

/**
 * Наполнение блюд смахиванием (backlog п. 4, 6; D-043).
 *
 * Основной способ наполнить раздел: вручную с составом двадцать блюд
 * не вносит никто. Своё блюдо — отдельная форма для уникальных рецептов.
 *
 * Поток тот же, что у продуктов: смахиваешь → «Готово» → «что из этого уже есть?».
 */
export function DishQuickStartScreen() {
  const kitchenId = useCurrentKitchen()?.id ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: dishes = [], isSuccess: dishesReady } = useDishes(kitchenId);
  const addDishes = useAddLibraryDishes(kitchenId);

  const [deck, setDeck] = useState<DeckItem[] | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const [deckOver, setDeckOver] = useState(false);
  const [created, setCreated] = useState<Product[] | null>(null);

  // Колода собирается один раз; уже добавленные блюда в неё не попадают
  useEffect(() => {
    if (deck !== null || !dishesReady) return;
    const have = new Set(dishes.flatMap((d) => [d.library_key ?? '', norm(d.name)]));
    setDeck(
      DISH_LIBRARY
        .filter((d) => !have.has(d.key) && !have.has(norm(dishLabel(d.key))))
        .map((d, i) => {
          const names = d.ingredients.map(([key]) => productLabel(key, key));
          return {
            id: d.key,
            title: dishLabel(d.key),
            subtitle: names.slice(0, 5).join(', ') + (names.length > 5 ? ` и ещё ${names.length - 5}` : ''),
            background: DECK_HUES[i % DECK_HUES.length]!,
          };
        }),
    );
  }, [deck, dishesReady, dishes]);

  const save = () => {
    if (accepted.length === 0) {
      navigate('/dishes');
      return;
    }
    addDishes.mutate(accepted, {
      onSuccess: (newProducts) => {
        if (newProducts.length === 0) {
          toast.show(t('dishes.onboarding.added', { count: accepted.length }));
          navigate('/dishes');
        } else {
          // На шаге наличия сообщение перекрывало бы «Готово»
          setCreated(newProducts);
        }
      },
      onError: (e) =>
        toast.show(t('products.saveFailed', { reason: e instanceof Error ? e.message : '' })),
    });
  };

  if (created) {
    return <StockCheck kitchenId={kitchenId} products={created} onDone={() => navigate('/dishes')} />;
  }

  if (deck === null) {
    return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
  }

  if (deck.length === 0 || deckOver) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center px-6">
        <EmptyState
          title={deck.length === 0 ? t('dishes.onboarding.done') : 'Карты закончились'}
          description={accepted.length > 0 ? t('dishes.onboarding.added', { count: accepted.length }) : undefined}
          action={
            <div className="flex justify-center gap-2">
              {accepted.length > 0 ? (
                <Button onClick={save} loading={addDishes.isPending}>
                  {t('onboarding.finish')} · {accepted.length}
                </Button>
              ) : (
                <Button onClick={() => navigate('/dishes')}>{t('common.back')}</Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-3 pb-6 pt-4">
      <header className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/dishes')}
          className="flex h-11 items-center px-1 text-caption text-text-muted"
        >
          {t('onboarding.skip')}
        </button>
        <span className="text-caption text-[#8A8A8A]">
          {t('dishes.onboarding.added', { count: accepted.length })}
        </span>
      </header>

      <div className="mb-3.5 h-[3px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${Math.round((position / deck.length) * 100)}%` }}
        />
      </div>

      <p className="mb-3 text-center text-micro text-text-dim">{t('dishes.onboarding.hint')}</p>

      <SwipeDeck
        items={deck}
        acceptLabel="Готовлю такое"
        rejectLabel="Не нужно"
        onProgress={setPosition}
        onEnd={() => setDeckOver(true)}
        onDecide={(item, isAccepted) => {
          if (isAccepted) setAccepted((prev) => [...prev, item.id]);
        }}
        onUndo={(item, wasAccepted) => {
          if (wasAccepted) setAccepted((prev) => prev.filter((k) => k !== item.id));
        }}
      />

      <div className="mt-4 flex h-12 justify-center">
        {accepted.length > 0 && (
          <Button onClick={save} loading={addDishes.isPending}>
            {t('onboarding.finish')} · {accepted.length}
          </Button>
        )}
      </div>
    </div>
  );
}
