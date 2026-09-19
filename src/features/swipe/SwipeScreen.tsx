import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { Button, EmptyState, SwipeDeck, type DeckItem } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useDeck, usePlanActions } from '@/shared/hooks/useDishes';
import { useUI } from '@/shared/store/ui';
import { t } from '@/shared/lib/i18n';
import { DECK_HUES } from '@/features/products/QuickStartScreen';
import { pickReaction } from './reactions';

/**
 * Карусель — второй вид того же выбора, что и плитка (D-029).
 * Каждый выбор сохраняется сразу, а не в конце: закрыть экран
 * на середине больше не значит потерять всё.
 *
 * С v0.9 работает на общей колоде SwipeDeck: раньше у этого экрана был свой
 * жест с порогом 40% ширины, и правка порога (backlog п. 9) до него не доходила.
 */
export function SwipeScreen() {
  const kitchenId = useCurrentKitchen()?.id ?? '';
  const navigate = useNavigate();
  const { data: cards = [], isLoading } = useDeck(kitchenId);
  const { add, remove } = usePlanActions(kitchenId);
  const playful = useUI((s) => s.playfulReactions);

  const [chosen, setChosen] = useState(0);
  const [position, setPosition] = useState(0);
  const [deckOver, setDeckOver] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  // Счётчик отказов подряд живёт в ref: перерисовывать колоду ради него незачем
  const streak = useRef(0);

  // Реакция уходит сама: держать её до следующего действия значит мешать смотреть
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), 2500);
    return () => clearTimeout(timer);
  }, [reaction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/dishes');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (isLoading) {
    return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
  }

  if (cards.length === 0 || deckOver) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center px-6">
        <EmptyState
          icon={<UtensilsCrossed className="h-12 w-12" />}
          title={cards.length === 0 ? t('swipe.emptyDeck') : t('swipe.deckDone')}
          description={chosen > 0 ? t('swipe.chosen', { count: chosen }) : undefined}
          action={
            chosen > 0
              ? <Button onClick={() => navigate('/dishes?tab=planned')}>{t('dishes.doneSelecting', { count: chosen })}</Button>
              : <Button onClick={() => navigate('/dishes')}>{t('dishes.title')}</Button>
          }
        />
      </div>
    );
  }

  const items: DeckItem[] = cards.map((card, i) => ({
    id: card.dish_id,
    title: card.name,
    subtitle: card.missing_count === 0
      ? t('swipe.allSet')
      : t('swipe.needToBuy', { names: card.missing_names.join(', ') }),
    background: DECK_HUES[i % DECK_HUES.length]!,
    image: card.library_key ? `/library/dishes/${card.library_key}.webp` : null,
  }));

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-3 pb-6 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/dishes')}
          className="flex h-11 items-center px-1 text-caption text-text-muted"
        >
          {t('swipe.close')}
        </button>
        <span className="text-caption text-[#8A8A8A]">{t('swipe.chosen', { count: chosen })}</span>
      </div>

      <div className="mb-3.5 h-[3px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${Math.round((position / items.length) * 100)}%` }}
        />
      </div>

      <SwipeDeck
        items={items}
        acceptLabel="Готовим это"
        rejectLabel="Пропустить"
        onProgress={setPosition}
        onEnd={() => setDeckOver(true)}
        onDecide={(item, accepted) => {
          if (accepted) {
            add.mutate(item.id); // сохраняем сразу
            setChosen((c) => c + 1);
            streak.current = 0;
            setReaction(null);
            return;
          }
          streak.current += 1;
          if (playful) {
            const phrase = pickReaction(streak.current, seen.current);
            if (phrase) setReaction(phrase);
          }
        }}
        onUndo={(item, wasAccepted) => {
          if (wasAccepted) {
            remove.mutate(item.id);
            setChosen((c) => Math.max(0, c - 1));
          } else {
            streak.current = Math.max(0, streak.current - 1);
          }
          setReaction(null);
        }}
        overlay={reaction && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-6">
            <p className="rounded-md bg-black/85 px-4 py-3 text-center text-body text-white">{reaction}</p>
          </div>
        )}
      />

      {/* Выход с сохранённым выбором — раньше был только «Закрыть» (п. 20) */}
      <div className="mt-4 flex h-12 justify-center">
        {chosen > 0 && (
          <Button onClick={() => navigate('/dishes?tab=planned')}>
            {t('dishes.doneSelecting', { count: chosen })}
          </Button>
        )}
      </div>
    </div>
  );
}
