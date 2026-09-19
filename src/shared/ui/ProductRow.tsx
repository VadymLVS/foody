import { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { Product } from '@/shared/db/types';
import { formatNumber } from '@/shared/lib/text';
import { unitLabel } from '@/shared/lib/i18n';
import { Toggle } from './Toggle';
import { cn } from '@/shared/lib/cn';

export interface PlanNeed {
  totalQuantity: number | null;
  dishes: Array<{ dish: string; quantity: number | null; owner: string | null }>;
}

interface Props {
  product: Product;
  need?: PlanNeed;
  showImage: boolean;
  expanded: boolean;
  onToggle: (next: boolean) => void;
  /** Тап по строке: открыть или закрыть панель под ней. */
  onExpand: () => void;
  onQuantityChange: (next: number) => void;
  onMenu: () => void;
}

const LONG_PRESS_MS = 500;
/** Сдвиг пальца, после которого это уже прокрутка, а не нажатие. */
const MOVE_TOLERANCE_PX = 10;

const STEP: Record<Product['unit'], number> = {
  pcs: 1, pack: 1, kg: 0.5, l: 0.5, g: 50, ml: 50,
};

/**
 * Строка списка (D-025, D-032).
 * Изображение лежит фоном под информационным слоем: зона фиксирована по центру,
 * поверх — градиент цвета плашки. От длины текста не зависит.
 */
export function ProductRow({
  product, need, showImage, expanded, onToggle, onExpand, onQuantityChange, onMenu,
}: Props) {
  const timer = useRef<number>();
  const origin = useRef<{ x: number; y: number } | null>(null);
  // Долгое нажатие уже открыло меню — следующий click строки надо проглотить,
  // иначе вместе с меню раскроется и панель
  const longPressFired = useRef(false);

  const cancelPress = () => {
    window.clearTimeout(timer.current);
    origin.current = null;
  };
  const image = product.library_key ? `/library/products/${product.library_key}.webp` : null;
  const hasImage = showImage && Boolean(image);
  const hasNeed = Boolean(need);

  /*
   * Тап и долгое нажатие ловятся на всей строке, а не на названии.
   * Раньше обработчики висели на кнопке шириной с текст: у «Арбуза» это
   * полоска слева, по остальной строке ни тап, ни долгое нажатие не работали
   * (backlog п. 11, 12). Ползунок останавливает всплытие и живёт отдельно.
   */
  return (
    <div className="mb-0.5">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={product.name}
        onClick={() => {
          if (longPressFired.current) {
            longPressFired.current = false;
            return;
          }
          onExpand();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); }
        }}
        onPointerDown={(e) => {
          longPressFired.current = false;
          origin.current = { x: e.clientX, y: e.clientY };
          timer.current = window.setTimeout(() => {
            longPressFired.current = true;
            origin.current = null;
            onMenu();
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (!origin.current) return;
          const dx = Math.abs(e.clientX - origin.current.x);
          const dy = Math.abs(e.clientY - origin.current.y);
          if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancelPress();
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => { e.preventDefault(); cancelPress(); onMenu(); }}
        // iOS на долгое нажатие по тексту открывает системное выделение
        // (Copy / Look Up) поверх нашего меню — отключаем для всей строки
        style={{ WebkitTouchCallout: 'none' }}
        className={cn(
          'relative flex cursor-pointer select-none items-center justify-between overflow-hidden rounded-md bg-surface px-3',
          hasNeed ? 'h-16' : hasImage ? 'h-14' : 'h-12',
          expanded && 'rounded-b-none',
        )}
      >
        {/* Лаймовая грань — «нужно для плана», а не «просто закончилось» */}
        {need && <span className="absolute inset-y-0 left-0 z-[3] w-0.5 bg-accent" />}

        {hasImage && (
          <>
            <span
              className="absolute inset-y-0 left-1/2 w-[52%] max-w-[258px] min-w-[150px] -translate-x-1/2 bg-cover bg-center"
              style={{ backgroundImage: `url(${image})` }}
            />
            <span
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, rgb(var(--surface)) 25%, rgb(var(--surface) / 0.2) 50%, rgb(var(--surface)) 75%)',
              }}
            />
          </>
        )}

        <span className="pointer-events-none relative z-[2] flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-3 text-left">
          <span className={cn('truncate text-body', product.in_stock ? 'text-text-primary' : 'text-[#8A8A8A]')}>
            {product.name}
            {!need && product.in_stock && product.quantity > 0 && (
              <span className="ml-1.5 text-micro text-text-muted">
                {formatNumber(product.quantity)} {unitLabel(product.unit)}
              </span>
            )}
          </span>
          {/* Количество стоит у блюда, а не у названия: рядом с продуктом
              оно читается как «столько есть», а не «столько нужно» */}
          {need && (
            <span className="truncate text-micro text-text-muted">
              {need.dishes.slice(0, 2).map((d, i) => (
                <span key={`${d.dish}-${i}`}>
                  {i > 0 && ' · '}
                  {d.dish}{d.owner ? ` — ${d.owner}` : ''}
                  {d.quantity != null && (
                    <span className="text-accent">
                      {' '}{formatNumber(d.quantity)} {unitLabel(product.unit)}
                    </span>
                  )}
                </span>
              ))}
              {need.dishes.length > 2 && ` и ещё ${need.dishes.length - 2}`}
            </span>
          )}
        </span>

        {/* Ползунок не должен ни раскрывать панель, ни запускать долгое нажатие */}
        <span
          className="relative z-[2] shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Toggle
            checked={product.in_stock}
            onChange={onToggle}
            label={`${product.name} — в наличии`}
          />
        </span>
      </div>

      {expanded && (
        <div className="mb-0.5 rounded-b-md bg-surface-2 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-muted">
              Количество, {unitLabel(product.unit)}
            </span>
            <div className="flex items-center gap-2">
              <StepButton label="Уменьшить" onClick={() => onQuantityChange(Math.max(0, product.quantity - STEP[product.unit]))} />
              <span className="min-w-[40px] text-center text-body tabular-nums">
                {formatNumber(product.quantity)}
              </span>
              <StepButton label="Увеличить" plus onClick={() => onQuantityChange(product.quantity + STEP[product.unit])} />
              {/* Видимый путь к правке и удалению: долгое нажатие не найти,
                  если про него не знать (идея Vadym, backlog п. 11) */}
              <button
                type="button"
                aria-label="Ещё действия"
                onClick={onMenu}
                className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-text-muted active:bg-[#1F1F1F]"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          {need && (
            <div className="mt-3 border-t border-line pt-2.5">
              <p className="mb-2 text-micro text-text-dim">Нужно для</p>
              {need.dishes.map((d) => (
                <div key={d.dish + (d.owner ?? '')} className="flex justify-between py-0.5 text-caption">
                  <span className="text-[#B8B8B8]">
                    {d.dish}{d.owner ? ` — ${d.owner}` : ''}
                  </span>
                  {d.quantity != null && (
                    <span className="text-text-muted">
                      {formatNumber(d.quantity)} {unitLabel(product.unit)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepButton({ label, onClick, plus }: { label: string; onClick: () => void; plus?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1F1F1F] text-text-muted transition active:scale-95"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {plus && <path d="M7 1v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
