import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Star, Trash2 } from 'lucide-react';
import { Button, useToast } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useProducts, useToggleProduct } from '@/shared/hooks/useProducts';
import { formatNumber } from '@/shared/lib/text';
import { t, unitLabel } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';
import { recipeFor } from '@/shared/lib/dishRecipes';
import type { DishWithStatus } from '@/shared/api/repo';
import { CookedSheet } from './CookedSheet';

/**
 * Карточка блюда. Недостающих ингредиентов касание меняет одно: ставит им
 * «есть дома». Купить их не нужно добавлять — продукт без наличия и так лежит
 * в «Купить», а с блюдом в меню приходит туда с количеством. Раньше то же
 * действие звалось «Добавить недостающее» и читалось наоборот (U-2).
 */
export function DishDetail({
  dish, onClose, onToggleFavorite, onDelete, onCooked, onEdit,
}: {
  dish: DishWithStatus;
  onClose: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onCooked: (usedUpProductIds: string[]) => void;
}) {
  const [cookedOpen, setCookedOpen] = useState(false);
  const kitchenId = useCurrentKitchen()?.id ?? '';
  const toggleProduct = useToggleProduct(kitchenId);
  const toast = useToast();
  const missing = new Set(dish.missingNames);
  const recipe = recipeFor(dish);
  // Библиотека картинок пока пустая: битый снимок прячем, как в плитке (п. 29)
  const [broken, setBroken] = useState(false);
  const image = !broken && dish.library_key ? `/library/dishes/${dish.library_key}.webp` : null;
  // Единица живёт у продукта (D-030), у ингредиента её нет
  const { data: products = [] } = useProducts(kitchenId);
  const unitOf = useMemo(() => new Map(products.map((p) => [p.id, p.unit])), [products]);

  // Escape закрывает карточку, как и любое другое окно: в Modal это есть,
  // а карточка блюда — своя разметка, и клавиша не работала
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Отметить наличие — поштучно или всё разом, с возвратом через тост. */
  const markInStock = (ids: string[], close: boolean) => {
    if (ids.length === 0) return;
    for (const id of ids) toggleProduct(id, true);
    toast.show(t('dishes.markedInStock'), {
      action: { label: t('common.undo'), onClick: () => ids.forEach((id) => toggleProduct(id, false)) },
    });
    if (close) onClose();
  };

  const markAll = () => markInStock(
    (dish.ingredients ?? [])
      .filter((i) => i.product_id && missing.has(i.product_name))
      .map((i) => i.product_id!),
    true,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dish.name}
        className="relative max-h-[92dvh] w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-t-lg bg-black sm:rounded-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="relative h-40 bg-surface-2">
          {image && (
            <img src={image} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          )}
          <span
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.4) 30%, rgba(0,0,0,0) 65%)' }}
          />
          <button type="button" onClick={onClose} aria-label={t('common.back')}
            className="absolute left-1 top-1 flex h-11 w-11 items-center justify-center text-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute right-1 top-1 flex">
            {/* Правка блюда (п. 32) */}
            <button type="button" onClick={onEdit} aria-label={t('dishes.edit')}
              className="flex h-11 w-11 items-center justify-center">
              <Pencil className="h-5 w-5 text-white" />
            </button>
            <button type="button" onClick={onToggleFavorite} aria-label="В избранное"
              className="flex h-11 w-11 items-center justify-center">
              <Star className={cn('h-5 w-5', dish.isFavorite ? 'fill-accent text-accent' : 'text-white')} />
            </button>
            <button type="button" onClick={onDelete} aria-label={t('common.delete')}
              className="flex h-11 w-11 items-center justify-center">
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
                aria-label={t('dishes.markInStockOne', { name: ingredient.product_name })}
                onClick={() => ingredient.product_id && markInStock([ingredient.product_id], false)}
                className="flex w-full items-center gap-2.5 border-b border-line py-2.5 text-left text-body last:border-0"
              >
                <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full',
                  absent ? 'border border-[#3A3A3A]' : 'bg-accent')} />
                <span className={cn('flex-1', absent ? 'text-text-muted' : 'text-text-primary')}>
                  {ingredient.product_name}
                  {ingredient.quantity != null && (
                    <span className="ml-1.5 text-micro text-text-dim">
                      {formatNumber(ingredient.quantity)}
                      {ingredient.product_id && unitOf.has(ingredient.product_id)
                        && ` ${unitLabel(unitOf.get(ingredient.product_id)!)}`}
                    </span>
                  )}
                </span>
                {/* Не «+»: касание не добавляет в покупки, а снимает нехватку */}
                {absent && ingredient.product_id && (
                  <span className="shrink-0 text-caption text-accent">{t('dishes.inStockShort')}</span>
                )}
              </button>
            );
          })}

          {/* Как готовить (п. 33): свой текст или рецепт справочника */}
          {recipe ? (
            <section className="mt-5">
              <h3 className="mb-2 text-micro text-text-muted">{t('dishes.recipe')}</h3>
              <p className="whitespace-pre-line text-body leading-relaxed text-text-primary">{recipe}</p>
            </section>
          ) : (
            <button type="button" onClick={onEdit} className="mt-4 flex h-11 items-center text-caption text-accent">
              + {t('dishes.recipe.add')}
            </button>
          )}

          <div className="mt-5 flex justify-center gap-2">
            {dish.missingCount > 0 && (
              <Button variant="secondary" onClick={markAll}>{t('dishes.markInStock')}</Button>
            )}
            {/* Единственный выход блюда из плана и единственное место,
                где продукты уходят из наличия */}
            {dish.isPlanned && (
              <Button
                variant={dish.missingCount > 0 ? 'secondary' : 'primary'}
                onClick={() => setCookedOpen(true)}
              >
                Приготовили
              </Button>
            )}
          </div>
        </div>
      </div>

      {cookedOpen && (
        <CookedSheet
          dish={dish}
          onClose={() => setCookedOpen(false)}
          onConfirm={(ids) => {
            setCookedOpen(false);
            onCooked(ids);
          }}
        />
      )}
    </div>
  );
}
