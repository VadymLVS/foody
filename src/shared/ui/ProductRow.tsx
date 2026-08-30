import { useState } from 'react';
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
  onExpand: () => void;
  onQuantityChange: (next: number) => void;
  onMenu: () => void;
}

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
  const [longPress, setLongPress] = useState<number>();
  const image = product.library_key ? `/library/products/${product.library_key}.webp` : null;
  const hasImage = showImage && Boolean(image);
  const subtitle = need
    ? need.dishes.slice(0, 2).map((d) => (d.owner ? `${d.dish} — ${d.owner}` : d.dish)).join(' · ') +
      (need.dishes.length > 2 ? ` и ещё ${need.dishes.length - 2}` : '')
    : null;

  const startPress = () => setLongPress(window.setTimeout(onMenu, 500));
  const endPress = () => longPress && clearTimeout(longPress);

  return (
    <div className="mb-0.5">
      <div
        className={cn(
          'relative flex items-center justify-between overflow-hidden rounded-md bg-surface px-3',
          subtitle ? 'h-16' : hasImage ? 'h-14' : 'h-12',
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

        <button
          type="button"
          onClick={onExpand}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
          className="relative z-[2] flex min-w-0 flex-col justify-center gap-0.5 text-left"
        >
          <span className={cn('truncate text-body', product.in_stock ? 'text-text-primary' : 'text-[#8A8A8A]')}>
            {product.name}
            {need?.totalQuantity != null && (
              <span className="ml-1.5 text-micro text-accent">
                {formatNumber(need.totalQuantity)} {unitLabel(product.unit)}
              </span>
            )}
            {!need && product.in_stock && product.quantity > 0 && (
              <span className="ml-1.5 text-micro text-text-muted">
                {formatNumber(product.quantity)} {unitLabel(product.unit)}
              </span>
            )}
          </span>
          {subtitle && <span className="truncate text-micro text-text-muted">{subtitle}</span>}
        </button>

        <Toggle
          checked={product.in_stock}
          onChange={onToggle}
          label={`${product.name} — в наличии`}
        />
      </div>

      {expanded && (
        <div className="mb-0.5 rounded-b-md bg-surface-2 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-muted">
              Количество, {unitLabel(product.unit)}
            </span>
            <div className="flex items-center gap-3.5">
              <StepButton label="Уменьшить" onClick={() => onQuantityChange(Math.max(0, product.quantity - STEP[product.unit]))} />
              <span className="min-w-[40px] text-center text-body tabular-nums">
                {formatNumber(product.quantity)}
              </span>
              <StepButton label="Увеличить" plus onClick={() => onQuantityChange(product.quantity + STEP[product.unit])} />
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
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1F1F] text-text-muted transition active:scale-95"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {plus && <path d="M7 1v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
