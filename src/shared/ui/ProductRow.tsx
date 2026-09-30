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
  /**
   * Заявка списка вместо количества продукта (п. 46).
   *
   * Задано — строка показывает и правит это число, лаймом: внутри списка
   * покупок «2 кг» означает «взять в эту поездку», а не «лежит дома».
   * Решение Vadym (10-01): заявка живёт только в списке и количество
   * продукта не трогает.
   *
   * Не задано (`undefined`) — обычное поведение: `products.quantity` серым.
   * Ноль — «не указано», как и у количества продукта (D-030).
   */
  listQuantity?: number;
  /**
   * Не показывать потребности блюд и лаймовую грань слева.
   *
   * В быстром списке закуп идёт без планирования под блюда, поэтому
   * потребностей там не видно вовсе. Грань означает «нужно для блюда»;
   * позиция списка с заявкой — просто продукт с заявкой, и метить её тем же
   * знаком значит размыть сам знак (решение Vadym 10-01).
   */
  hideNeeds?: boolean;
  /** Своё состояние ползунка: в сборке списка он значит «берём», а не наличие. */
  checked?: boolean;
  /** Подпись ползунка для чтения с экрана, если он значит не наличие. */
  toggleLabel?: string;
  /** Скрыть «⋯»: в экране сборки списка меню продукта открывать нечего. */
  hideMenu?: boolean;
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
  listQuantity, hideNeeds = false, checked, toggleLabel, hideMenu = false,
}: Props) {
  /** Строка правит заявку списка, а не количество продукта. */
  const listMode = listQuantity !== undefined;
  const on = checked ?? product.in_stock;
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
  const hasNeed = !hideNeeds && Boolean(need);
  /** Число у названия: «сколько лежит» серым или «сколько взять» лаймом. */
  const shownQuantity = listQuantity ?? product.quantity;

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
        {hasNeed && <span className="absolute inset-y-0 left-0 z-[3] w-0.5 bg-accent" />}

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
          <span className={cn(
            'truncate text-body',
            on ? 'text-text-primary' : 'text-[#8A8A8A]',
          )}>
            {product.name}
            {/* Своё количество видно всегда: «сколько есть/брать» серым, «сколько нужно блюду» лаймом ниже (п. 22).
                В режиме списка здесь стоит заявка поездки — лаймом, как у потребностей блюд (просьба Vadym 09-30) */}
            {shownQuantity > 0 && (
              <span className={cn('ml-1.5 text-micro', listMode ? 'text-accent' : 'text-text-muted')}>
                {formatNumber(shownQuantity)} {unitLabel(product.unit)}
              </span>
            )}
          </span>
          {/* Количество стоит у блюда, а не у названия: рядом с продуктом
              оно читается как «столько есть», а не «столько нужно» */}
          {hasNeed && need && (
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
            checked={on}
            onChange={onToggle}
            label={`${product.name} — ${toggleLabel ?? 'в наличии'}`}
          />
        </span>
      </div>

      {expanded && (
        <div className="mb-0.5 rounded-b-md bg-surface-2 px-3.5 py-3">
          <div className="flex items-center justify-between">
            {/* Та же панель, что и в обычной строке: свой орган управления
                придумывать не надо (замечание Vadym 10-01). Подпись другая,
                потому что число отвечает на другой вопрос: не «сколько лежит
                дома», а «сколько взять в эту поездку» */}
            <span className="text-caption text-text-muted">
              {listMode ? 'Сколько взять' : 'Количество'}, {unitLabel(product.unit)}
            </span>
            <div className="flex items-center gap-2">
              <StepButton label="Уменьшить" onClick={() => onQuantityChange(Math.max(0, shownQuantity - STEP[product.unit]))} />
              <span className="min-w-[40px] text-center text-body tabular-nums">
                {formatNumber(shownQuantity)}
              </span>
              <StepButton label="Увеличить" plus onClick={() => onQuantityChange(shownQuantity + STEP[product.unit])} />
              {/* Видимый путь к правке и удалению: долгое нажатие не найти,
                  если про него не знать (идея Vadym, backlog п. 11).
                  В экране сборки списка меню продукта нет — там нечего открывать */}
              {!hideMenu && (
                <button
                  type="button"
                  aria-label="Ещё действия"
                  onClick={onMenu}
                  className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-text-muted active:bg-[#1F1F1F]"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {hasNeed && need && (
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
