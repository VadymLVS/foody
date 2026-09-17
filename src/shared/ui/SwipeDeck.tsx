import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/** Доля ширины карты, после которой свайп засчитывается. */
const COMMIT_RATIO = 0.4;

export interface DeckItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Фон карты: снимок или градиент-заглушка. */
  background: string;
  isImage?: boolean;
}

interface Props {
  items: DeckItem[];
  onDecide: (item: DeckItem, accepted: boolean) => void;
  onUndo?: (item: DeckItem, wasAccepted: boolean) => void;
  acceptLabel: string;
  rejectLabel: string;
  overlay?: React.ReactNode;
}

/**
 * Колода со свайпом. Общая механика для выбора блюд и для наполнения
 * списка продуктов — жест, порог, проявление решения и возврат одинаковы,
 * различается только содержимое карты и то, что происходит при выборе.
 *
 * Кнопки-дублёры обязательны: жест недоступен с клавиатуры.
 */
export function SwipeDeck({
  items, onDecide, onUndo, acceptLabel, rejectLabel, overlay,
}: Props) {
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const history = useRef<Array<{ item: DeckItem; accepted: boolean }>>([]);
  const deckRef = useRef<HTMLDivElement>(null);

  const commit = useCallback((accepted: boolean) => {
    const item = items[index];
    if (!item) return;
    history.current.push({ item, accepted });
    setOffset(0);
    setIndex((i) => i + 1);
    onDecide(item, accepted);
  }, [items, index, onDecide]);

  const undo = useCallback(() => {
    const last = history.current.pop();
    if (!last) return;
    setIndex((i) => Math.max(0, i - 1));
    onUndo?.(last.item, last.accepted);
  }, [onUndo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') commit(true);
      if (e.key === 'ArrowLeft') commit(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit]);

  const release = () => {
    if (!dragging) return;
    setDragging(false);
    const width = deckRef.current?.offsetWidth ?? 320;
    if (Math.abs(offset) > width * COMMIT_RATIO) commit(offset > 0);
    else setOffset(0);
  };

  const intent = Math.min(1, Math.abs(offset) / 120);

  return (
    <>
      <div
        ref={deckRef}
        className="relative flex-1 touch-none select-none"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => dragging && setOffset(e.clientX - startX.current)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {items.slice(index, index + 2).map((item, depth) => {
          const top = depth === 0;
          return (
            <div
              key={item.id}
              className={cn(
                'absolute inset-0 overflow-hidden rounded-lg bg-surface-2',
                !dragging && 'transition-transform duration-200 ease-ios',
              )}
              style={{
                transform: top
                  ? `translateX(${offset}px) rotate(${Math.max(-12, Math.min(12, offset / 14))}deg)`
                  : 'translateY(10px) scale(0.96)',
                zIndex: top ? 3 : 2,
                opacity: top ? 1 : 0.55,
                background: item.isImage ? undefined : item.background,
              }}
            >
              {item.isImage && (
                <img src={item.background} alt="" className="h-full w-full object-cover" />
              )}

              <span
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.5) 22%, rgba(0,0,0,0) 62%)',
                }}
              />

              {top && (
                <>
                  {/* Решение проявляется во весь экран, а не плашкой в углу */}
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(213,255,64,.26)', opacity: offset > 0 ? intent : 0 }}
                  >
                    <span
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-accent"
                      style={{ transform: `scale(${0.8 + intent * 0.2})` }}
                    >
                      <Check className="h-9 w-9 text-accent-ink" />
                    </span>
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,.6)', opacity: offset < 0 ? intent : 0 }}
                  >
                    <span
                      className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#9A9A9A]"
                      style={{ transform: `scale(${0.8 + intent * 0.2})` }}
                    >
                      <X className="h-8 w-8 text-[#9A9A9A]" />
                    </span>
                  </div>
                </>
              )}

              <div className="absolute inset-x-0 bottom-0 p-5">
                <h2 className="font-display text-display text-white">{item.title}</h2>
                {item.subtitle && (
                  <p className="mt-2 text-micro text-[#C9C9C9]">{item.subtitle}</p>
                )}
              </div>
            </div>
          );
        })}

        {overlay}
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        <RoundButton label={rejectLabel} onClick={() => commit(false)}>
          <X className="h-5 w-5 text-[#8A8A8A]" />
        </RoundButton>
        <button
          type="button"
          onClick={undo}
          disabled={index === 0}
          aria-label="Вернуть"
          className="flex h-11 w-11 items-center justify-center text-text-dim disabled:opacity-30"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <RoundButton label={acceptLabel} accent onClick={() => commit(true)}>
          <Check className="h-5 w-5 text-accent-ink" />
        </RoundButton>
      </div>
    </>
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
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95',
        accent ? 'bg-accent' : 'border border-[#2A2A2A]',
      )}
    >
      {children}
    </button>
  );
}
