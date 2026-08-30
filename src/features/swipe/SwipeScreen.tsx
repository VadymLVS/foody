import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, RotateCcw, UtensilsCrossed, X } from 'lucide-react';
import { Button, EmptyState } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useDeck, usePlanActions } from '@/shared/hooks/useDishes';
import { useUI } from '@/shared/store/ui';
import { t } from '@/shared/lib/i18n';
import { pickReaction } from './reactions';
import { cn } from '@/shared/lib/cn';
import type { DeckCard } from '@/shared/db/types';

/** Доля ширины карты, после которой свайп засчитывается. */
const COMMIT_RATIO = 0.4;

/**
 * Карусель — второй вид того же выбора, что и плитка (D-029).
 * Каждый выбор сохраняется сразу, а не в конце: закрыть экран
 * на середине больше не значит потерять всё.
 */
export function SwipeScreen() {
  const kitchenId = useCurrentKitchen()?.id ?? '';
  const navigate = useNavigate();
  const { data: deck = [], isLoading } = useDeck(kitchenId);
  const { add, remove } = usePlanActions(kitchenId);
  const playful = useUI((s) => s.playfulReactions);

  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<DeckCard[]>([]);
  const [history, setHistory] = useState<Array<'left' | 'right'>>([]);
  const [streak, setStreak] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());

  const current = deck[index];

  const commit = useCallback((direction: 'left' | 'right') => {
    const card = deck[index];
    if (!card) return;

    setHistory((h) => [...h, direction]);
    setOffset(0);
    setIndex((i) => i + 1);

    if (direction === 'right') {
      add.mutate(card.dish_id);          // сохраняем сразу
      setChosen((c) => [...c, card]);
      setStreak(0);
      setReaction(null);
      return;
    }

    setStreak((prev) => {
      const next = prev + 1;
      if (playful) {
        const phrase = pickReaction(next, seen.current);
        if (phrase) setReaction(phrase);
      }
      return next;
    });
  }, [deck, index, add, playful]);

  const undo = () => {
    if (index === 0) return;
    const last = history[history.length - 1];
    const card = deck[index - 1];
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
    if (last === 'right' && card) {
      remove.mutate(card.dish_id);
      setChosen((c) => c.slice(0, -1));
    } else {
      setStreak((s) => Math.max(0, s - 1));
    }
    setReaction(null);
  };

  // Реакция уходит сама: держать её до следующего действия значит мешать смотреть
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), 2500);
    return () => clearTimeout(timer);
  }, [reaction]);

  // Свайп недоступен с клавиатуры — стрелки обязательны
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') commit('right');
      if (e.key === 'ArrowLeft') commit('left');
      if (e.key === 'Escape') navigate('/dishes');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, navigate]);

  const release = () => {
    if (!dragging) return;
    setDragging(false);
    const width = deckRef.current?.offsetWidth ?? 320;
    if (Math.abs(offset) > width * COMMIT_RATIO) commit(offset > 0 ? 'right' : 'left');
    else setOffset(0);
  };

  if (isLoading) {
    return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
  }

  if (deck.length === 0 || !current) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] items-center px-6">
        <EmptyState
          icon={<UtensilsCrossed className="h-12 w-12" />}
          title={deck.length === 0 ? t('swipe.emptyDeck') : t('swipe.deckDone')}
          description={chosen.length > 0 ? t('swipe.chosen', { count: chosen.length }) : undefined}
          action={<Button onClick={() => navigate('/dishes')}>{t('dishes.title')}</Button>}
        />
      </div>
    );
  }

  const progress = Math.round((index / deck.length) * 100);
  const intent = Math.min(1, Math.abs(offset) / 120);

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col px-3 pb-6 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => navigate('/dishes')} className="text-micro text-text-muted">
          {t('swipe.close')}
        </button>
        <span className="text-micro text-[#8A8A8A]">{t('swipe.chosen', { count: chosen.length })}</span>
      </div>

      <div className="mb-3.5 h-[3px] overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div
        ref={deckRef}
        className="relative flex-1 touch-none select-none"
        onPointerDown={(e) => { startX.current = e.clientX; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => dragging && setOffset(e.clientX - startX.current)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {deck.slice(index, index + 2).map((card, depth) => {
          const top = depth === 0;
          const image = card.library_key ? `/library/dishes/${card.library_key}.webp` : null;
          return (
            <div
              key={card.dish_id}
              className={cn('absolute inset-0 overflow-hidden rounded-lg bg-surface-2',
                !dragging && 'transition-transform duration-200 ease-ios')}
              style={{
                transform: top
                  ? `translateX(${offset}px) rotate(${Math.max(-12, Math.min(12, offset / 14))}deg)`
                  : 'translateY(10px) scale(0.96)',
                zIndex: top ? 3 : 2,
                opacity: top ? 1 : 0.55,
              }}
            >
              {image && <img src={image} alt="" className="h-full w-full object-cover" />}
              <span className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.5) 22%, rgba(0,0,0,0) 62%)' }} />

              {top && (
                <>
                  {/* Решение проявляется во весь экран, а не плашкой в углу */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(213,255,64,.26)', opacity: offset > 0 ? intent : 0 }}>
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent"
                      style={{ transform: `scale(${0.8 + intent * 0.2})` }}>
                      <Check className="h-9 w-9 text-accent-ink" />
                    </span>
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,.6)', opacity: offset < 0 ? intent : 0 }}>
                    <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#9A9A9A]"
                      style={{ transform: `scale(${0.8 + intent * 0.2})` }}>
                      <X className="h-8 w-8 text-[#9A9A9A]" />
                    </span>
                  </div>
                </>
              )}

              <div className="absolute inset-x-0 bottom-0 p-4.5 pb-5">
                <h2 className="font-display text-display text-white">{card.name}</h2>
                <p className="mt-2 text-micro text-[#C9C9C9]">
                  {card.missing_count === 0
                    ? t('swipe.allSet')
                    : t('swipe.needToBuy', { names: card.missing_names.join(', ') })}
                </p>
              </div>
            </div>
          );
        })}

        {reaction && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-6">
            <p className="rounded-md bg-black/85 px-4 py-3 text-center text-body text-white">{reaction}</p>
          </div>
        )}
      </div>

      {/* Кнопки-дублёры обязательны: жест недоступен с клавиатуры */}
      <div className="mt-5 flex items-center justify-center gap-5">
        <RoundButton label="Пропустить" onClick={() => commit('left')}>
          <X className="h-5 w-5 text-[#8A8A8A]" />
        </RoundButton>
        <button type="button" onClick={undo} disabled={index === 0} aria-label="Вернуть"
          className="p-1.5 text-text-dim disabled:opacity-30">
          <RotateCcw className="h-4 w-4" />
        </button>
        <RoundButton label="Готовим это" accent onClick={() => commit('right')}>
          <Check className="h-5 w-5 text-accent-ink" />
        </RoundButton>
      </div>
    </div>
  );
}

function RoundButton({
  children, label, onClick, accent,
}: { children: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn('flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95',
        accent ? 'bg-accent' : 'border border-[#2A2A2A]')}
    >
      {children}
    </button>
  );
}
