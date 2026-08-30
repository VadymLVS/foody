import { ChevronLeft, Star, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useToggleProduct } from '@/shared/hooks/useProducts';
import { formatNumber } from '@/shared/lib/text';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';
import type { DishWithStatus } from '@/shared/api/repo';

/**
 * Карточка блюда. Недостающие ингредиенты кликабельны поштучно или все разом —
 * без этого цепочка «хочу салат → купить огурцы» обрывается.
 */
export function DishDetail({
  dish, onClose, onToggleFavorite, onDelete,
}: {
  dish: DishWithStatus;
  onClose: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const kitchenId = useCurrentKitchen()?.id ?? '';
  const toggleProduct = useToggleProduct(kitchenId);
  const missing = new Set(dish.missingNames);
  const image = dish.library_key ? `/library/dishes/${dish.library_key}.webp` : null;

  const addAll = () => {
    for (const ingredient of dish.ingredients ?? []) {
      if (ingredient.product_id && missing.has(ingredient.product_name)) {
        toggleProduct(ingredient.product_id, true);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
        className="relative w-full max-w-[420px] overflow-hidden rounded-t-lg bg-black sm:rounded-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="relative h-40 bg-surface-2">
          {image && <img src={image} alt="" className="h-full w-full object-cover" />}
          <span
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.4) 30%, rgba(0,0,0,0) 65%)' }}
          />
          <button type="button" onClick={onClose} aria-label={t('common.back')}
            className="absolute left-3 top-3 text-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute right-3 top-3 flex gap-3">
            <button type="button" onClick={onToggleFavorite} aria-label="В избранное">
              <Star className={cn('h-5 w-5', dish.isFavorite ? 'fill-accent text-accent' : 'text-white')} />
            </button>
            <button type="button" onClick={onDelete} aria-label={t('common.delete')}>
              <Trash2 className="h-5 w-5 text-white" />
            </button>
          </div>
          <h2 className="font-display absolute bottom-3 left-3.5 text-display text-white">{dish.name}</h2>
        </div>

        <div className="p-3.5">
          {(dish.ingredients ?? []).map((ingredient) => {
            const absent = missing.has(ingredient.product_name);
            return (
              <button
                key={ingredient.id}
                type="button"
                disabled={!absent || !ingredient.product_id}
                onClick={() => ingredient.product_id && toggleProduct(ingredient.product_id, true)}
                className="flex w-full items-center gap-2.5 border-b border-line py-2.5 text-left text-body last:border-0"
              >
                <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full',
                  absent ? 'border border-[#3A3A3A]' : 'bg-accent')} />
                <span className={cn('flex-1', absent ? 'text-text-muted' : 'text-text-primary')}>
                  {ingredient.product_name}
                  {ingredient.quantity != null && (
                    <span className="ml-1.5 text-micro text-text-dim">
                      {formatNumber(ingredient.quantity)}
                    </span>
                  )}
                </span>
                {absent && <span className="text-caption text-accent">+</span>}
              </button>
            );
          })}

          {dish.missingCount > 0 && (
            <div className="mt-5 flex justify-center">
              <Button onClick={addAll}>{t('dishes.addMissing')}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
