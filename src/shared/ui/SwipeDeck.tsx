import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/*
 * Порог свайпа (backlog п. 9). Было 40% ширины карты: на iPhone 16 Pro Max
 * это ~160px, почти полэкрана. Теперь четверть ширины, но не больше 110px,
 * чтобы на больших экранах порог не рос вместе с картой.
 */
const COMMIT_RATIO = 0.25;
const COMMIT_MAX_PX = 110;
/*
 * Быстрый короткий флик засчитывается независимо от расстояния: это самый
 * естественный жест для колоды, а раньше скорость не учитывалась вовсе.
 * Минимальный сдвиг отсекает случайное касание.
 */
const FLICK_VELOCITY = 0.35; // px/ms — порог жеста iOS около 0.3–0.5
const FLICK_MIN_PX = 24;

export interface DeckItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Фон карты — градиент. Виден всегда, пока нет снимка или он не загрузился. */
  background: string;
  /** Снимок поверх фона. Библиотека картинок пока пустая, поэтому 404 — норма. */
  image?: string | null;
}

interface Props {
  items: DeckItem[];
  onDecide: (item: DeckItem, accepted: boolean) => void;
  onUndo?: (item: DeckItem, wasAccepted: boolean) => void;
  /** Сколько карт пройдено — для полосы прогресса. */
  onProgress?: (index: number) => void;
  /**
   * Карты закончились. Раньше экран вычислял это сам, сравнивая число
   * отмеченных карт с их общим числом, и ошибался при любом отказе (п. 10).
   */
  onEnd?: () => void;
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
  items, onDecide, onUndo, onProgress, onEnd, acceptLabel, rejectLabel, overlay,
}: Props) {
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  /*
   * Жест отслеживается в ref, состояние — только для отрисовки. Состояние
   * обновляется со следующим рендером, а быстрый флик длится 50–100 мс:
   * первые движения приходили раньше, чем dragging становился true, и
   * отбрасывались, а при отпускании читался устаревший сдвиг. Флик не
   * засчитывался вообще (найдено прогоном в браузере).
   */
  const draggingRef = useRef(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  /** Последние точки жеста для расчёта скорости в момент отпускания. */
  const samples = useRef<Array<{ x: number; t: number }>>([]);
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
    onProgress?.(index);
    if (items.length > 0 && index >= items.length) onEnd?.();
    // onProgress и onEnd приходят inline-функциями и в зависимости не входят
    // намеренно: реагируем только на смену позиции в колоде
  }, [index, items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') commit(true);
      if (e.key === 'ArrowLeft') commit(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit]);

  const release = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const offset = offsetRef.current;
    offsetRef.current = 0;

    const width = deckRef.current?.offsetWidth ?? 320;
    const threshold = Math.min(width * COMMIT_RATIO, COMMIT_MAX_PX);

    // Скорость по последним ~100 мс жеста, а не по всему пути
    const recent = samples.current;
    const last = recent[recent.length - 1];
    const first = recent.find((p) => last && last.t - p.t <= 100) ?? recent[0];
    const velocity = last && first && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    samples.current = [];

    const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(offset) > FLICK_MIN_PX
      && Math.sign(velocity) === Math.sign(offset);

    if (Math.abs(offset) > threshold || flick) commit(offset > 0);
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
          samples.current = [{ x: e.clientX, t: e.timeStamp }];
          draggingRef.current = true;
          offsetRef.current = 0;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          samples.current = [...samples.current.slice(-8), { x: e.clientX, t: e.timeStamp }];
          offsetRef.current = e.clientX - startX.current;
          setOffset(offsetRef.current);
        }}
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
                background: item.background,
              }}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
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
