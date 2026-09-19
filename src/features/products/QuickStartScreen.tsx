import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, SwipeDeck, useToast, type DeckItem } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import {
  useCategories, useCreateProducts, useProducts, useSuggestions,
} from '@/shared/hooks/useProducts';
import { norm } from '@/shared/lib/text';
import { t } from '@/shared/lib/i18n';
import { StockCheck } from './StockCheck';
import type { NewProduct } from '@/shared/api/repo';
import type { Product, Unit } from '@/shared/db/types';

/** Восемь заранее подобранных оттенков: соседние карты всегда различимы. */
export const DECK_HUES = [
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
 * Наполнение списка смахиванием (D-040, пересмотрено в v0.9).
 *
 * Поток: смахиваешь → «Готово» сохраняет сразу → «что из этого уже есть?» → список.
 * - Одно «Готово». Раньше кнопка вела на итоговый экран со вторым «Готово» (п. 10).
 * - Всё сохраняется как «нет в наличии», наличие отмечается на следующем шаге.
 *   Раньше всё записывалось как имеющееся — угадывание вместо вопроса (п. 8).
 * - Ошибка сохранения показывается. Раньше вставка падала молча (п. 1).
 */
export function QuickStartScreen() {
  const kitchen = useCurrentKitchen();
  const kitchenId = kitchen?.id ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: suggestions = [], isSuccess: suggestionsReady } = useSuggestions();
  const { data: products = [], isSuccess: productsReady } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const createProducts = useCreateProducts(kitchenId);

  const [deck, setDeck] = useState<DeckItem[] | null>(null);
  const [accepted, setAccepted] = useState<Pick[]>([]);
  const [position, setPosition] = useState(0);
  const [created, setCreated] = useState<Product[] | null>(null);
  const [deckOver, setDeckOver] = useState(false);

  /*
   * Колода собирается один раз. Если пересчитывать её при каждом обновлении
   * списка продуктов, карты под рукой могут смениться посреди прохода.
   * Уже добавленное в колоду не попадает: смахивать то, что и так есть, незачем.
   */
  useEffect(() => {
    if (deck !== null || !suggestionsReady || !productsReady) return;
    const have = new Set(products.map((p) => norm(p.name)));
    setDeck(
      suggestions
        .filter((s) => !have.has(norm(s.name)))
        .map((s, i) => ({ id: s.key, title: s.name, background: DECK_HUES[i % DECK_HUES.length]! })),
    );
  }, [deck, suggestionsReady, productsReady, suggestions, products]);

  const byKey = useMemo(
    () => new Map(suggestions.map((s) => [s.key, s as Pick])),
    [suggestions],
  );

  const save = () => {
    if (accepted.length === 0) {
      navigate('/products');
      return;
    }
    const categoryByKey = new Map(
      categories.filter((c) => c.kind === 'product').map((c) => [c.key, c.id]),
    );
    const inputs: NewProduct[] = accepted.map((pick) => ({
      name: pick.name,
      categoryId: (pick.categoryKey && categoryByKey.get(pick.categoryKey)) ?? null,
      unit: pick.unit,
      inStock: false,
      libraryKey: pick.key,
    }));

    createProducts.mutate(inputs, {
      onSuccess: (rows) => {
        if (rows.length === 0) {
          toast.show('Всё выбранное уже было в списке');
          navigate('/products');
          return;
        }
        // Без всплывающего сообщения: на шаге наличия оно перекрывало «Готово»,
        // а список добавленного и так на экране
        setCreated(rows);
      },
      onError: (e) =>
        toast.show(t('products.saveFailed', { reason: e instanceof Error ? e.message : '' })),
    });
  };

  if (created) {
    return <StockCheck kitchenId={kitchenId} products={created} onDone={() => navigate('/products')} />;
  }

  if (deck === null) {
    return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
  }

  // Колода пуста с самого начала или пройдена до конца
  if (deck.length === 0 || deckOver) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center px-6">
        <EmptyState
          title={deck.length === 0 ? 'Всё из справочника уже в списке' : 'Карты закончились'}
          description={accepted.length > 0 ? t('onboarding.added', { count: accepted.length }) : undefined}
          action={
            <div className="flex justify-center gap-2">
              {accepted.length > 0 ? (
                <Button onClick={save} loading={createProducts.isPending}>
                  {t('onboarding.finish')} · {accepted.length}
                </Button>
              ) : (
                <Button onClick={() => navigate('/products')}>{t('common.back')}</Button>
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
          onClick={() => navigate('/products')}
          className="flex h-11 items-center px-1 text-caption text-text-muted"
        >
          {t('onboarding.skip')}
        </button>
        <span className="text-caption text-[#8A8A8A]">
          {t('onboarding.added', { count: accepted.length })}
        </span>
      </header>

      {/* Полоса — сколько колоды пройдено, а не сколько отмечено */}
      <div className="mb-3.5 h-[3px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${Math.round((position / deck.length) * 100)}%` }}
        />
      </div>

      <p className="mb-3 text-center text-micro text-text-dim">{t('onboarding.hint')}</p>

      <SwipeDeck
        items={deck}
        acceptLabel="Покупаю это"
        rejectLabel="Не нужно"
        onProgress={setPosition}
        onEnd={() => setDeckOver(true)}
        onDecide={(item, isAccepted) => {
          if (!isAccepted) return;
          const pick = byKey.get(item.id);
          if (pick) setAccepted((prev) => [...prev, pick]);
        }}
        onUndo={(item, wasAccepted) => {
          if (wasAccepted) setAccepted((prev) => prev.filter((p) => p.key !== item.id));
        }}
      />

      {/* Сохраняет сразу, без промежуточного экрана (п. 10) */}
      <div className="mt-4 flex h-12 justify-center">
        {accepted.length > 0 && (
          <Button onClick={save} loading={createProducts.isPending}>
            {t('onboarding.finish')} · {accepted.length}
          </Button>
        )}
      </div>
    </div>
  );
}
