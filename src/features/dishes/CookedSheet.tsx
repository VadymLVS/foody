import { useState } from 'react';
import { Button, Toggle } from '@/shared/ui';
import type { DishWithStatus } from '@/shared/api/repo';

/**
 * Что закончилось после готовки.
 *
 * Это замена кнопке «Я приготовил это» и единственный момент, когда продукты
 * уходят из наличия. Без него список «готовим» только растёт, а отмеченное
 * месяц назад молоко числится вечно.
 *
 * По умолчанию не отмечено ничего: отметить лишнее — значит стереть половину
 * кухни одним нажатием, а забыть отметить — всего лишь увидеть блюдо готовым
 * на день дольше. Цена ошибок разная, поэтому осторожный вариант по умолчанию.
 */
export function CookedSheet({
  dish, onConfirm, onClose,
}: {
  dish: DishWithStatus;
  onConfirm: (usedUpProductIds: string[]) => void;
  onClose: () => void;
}) {
  const [usedUp, setUsedUp] = useState<Set<string>>(new Set());

  // Ингредиенты без привязки к продукту списать нельзя — их просто нет в кухне
  const linked = (dish.ingredients ?? []).filter((i) => i.product_id);

  const toggle = (productId: string, next: boolean) =>
    setUsedUp((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(productId);
      else copy.delete(productId);
      return copy;
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Приготовили: ${dish.name}`}
        className="relative w-full max-w-[420px] rounded-t-lg bg-surface p-4 sm:rounded-lg"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <h2 className="text-headline">Приготовили {dish.name}</h2>
        <p className="mt-1 text-caption text-text-muted">Что закончилось?</p>

        <div className="mt-4 max-h-[50vh] overflow-y-auto">
          {linked.length === 0 && (
            <p className="py-6 text-center text-caption text-text-muted">
              У блюда нет привязанных продуктов
            </p>
          )}

          {linked.map((ingredient) => (
            <div
              key={ingredient.id}
              className="flex items-center justify-between border-b border-line py-2.5 last:border-0"
            >
              <span className="text-body">{ingredient.product_name}</span>
              <Toggle
                checked={usedUp.has(ingredient.product_id!)}
                onChange={(next) => toggle(ingredient.product_id!, next)}
                label={`${ingredient.product_name} закончился`}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Отмена</Button>
          <Button fullWidth onClick={() => onConfirm([...usedUp])}>
            {usedUp.size > 0 ? `Готово · списать ${usedUp.size}` : 'Готово'}
          </Button>
        </div>
      </div>
    </div>
  );
}
