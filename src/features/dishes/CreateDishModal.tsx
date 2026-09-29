import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input, Modal } from '@/shared/ui';
import { useCategories, useProducts } from '@/shared/hooks/useProducts';
import { ProductPicker, UnitSelect } from '@/features/products/ProductPicker';
import { useCreateDish, useUpdateDish } from '@/shared/hooks/useDishes';
import { recipeFor } from '@/shared/lib/dishRecipes';
import type { DishWithStatus } from '@/shared/api/repo';
import { categoryLabel, t } from '@/shared/lib/i18n';
import type { Unit } from '@/shared/db/types';

interface Picked {
  id: string;
  name: string;
  unit: Unit;
  /** Строка из поля ввода: пустая — количество не указано (D-031). */
  quantity: string;
}

interface Props {
  kitchenId: string;
  open: boolean;
  /** Название, набранное в поиске редактора набора (п. 26). */
  initialName?: string;
  /** id созданного блюда — редактор набора сразу добавляет его в состав. */
  onCreated?: (dishId: string) => void;
  /** Правка существующего блюда (п. 32); без него — новое. */
  dish?: DishWithStatus | null;
  onClose: () => void;
}

/**
 * Своё блюдо (backlog п. 3).
 *
 * Состав собирается из продуктов кухни: ингредиент — это ссылка на продукт
 * (D-005), иначе не работают готовность блюда и список покупок. Если продукта
 * ещё нет, он создаётся отсюда же как «нет в наличии» — или берётся из
 * справочника с правильной единицей (п. 27).
 */
export function CreateDishModal({ kitchenId, open, initialName = '', onCreated, dish = null, onClose }: Props) {
  const { data: categories = [] } = useCategories(kitchenId);
  const { data: products = [] } = useProducts(kitchenId);
  const createDish = useCreateDish(kitchenId);
  const updateDish = useUpdateDish(kitchenId);
  const [recipe, setRecipe] = useState('');

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Форма заполняется при открытии; products — только для единиц, поэтому
  // обновление списка продуктов не должно стирать набранное
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!dish) {
      setName(initialName); setCategoryId(null); setPicked([]); setRecipe('');
      return;
    }
    setName(dish.name);
    setCategoryId(dish.category_id);
    // Рецепт справочника подставляется в поле: после сохранения он станет своим текстом
    setRecipe(recipeFor(dish) ?? '');
    const unitOf = new Map(products.map((p) => [p.id, p.unit]));
    setPicked((dish.ingredients ?? []).flatMap((i) => (i.product_id ? [{
      id: i.product_id,
      name: i.product_name,
      unit: unitOf.get(i.product_id) ?? 'pcs',
      quantity: i.quantity != null ? String(i.quantity).replace('.', ',') : '',
    }] : [])));
  }, [open, initialName, dish]); // products намеренно не в зависимостях: см. комментарий выше

  const dishCategories = useMemo(() => categories.filter((c) => c.kind === 'dish'), [categories]);

  const submit = () => {
    if (!name.trim() || picked.length === 0) return;
    setError(null);
    const input = {
      name: name.trim(),
      categoryId,
      recipe: recipe.trim() || null,
      ingredients: picked.map(({ id, name: productName, quantity }) => {
        const value = Number(quantity.replace(',', '.'));
        return {
          productId: id,
          productName,
          quantity: quantity.trim() && Number.isFinite(value) && value > 0 ? value : null,
        };
      }),
    };
    const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    if (dish) {
      updateDish.mutate({ id: dish.id, input }, { onSuccess: onClose, onError: fail });
      return;
    }
    createDish.mutate(input, {
      onSuccess: (dishId) => {
        onCreated?.(dishId);
        onClose();
      },
      onError: fail,
    });
  };

  return (
    <Modal
      open={open}
      title={dish ? t('dishes.edit.title') : t('dishes.create.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            fullWidth
            onClick={submit}
            loading={createDish.isPending || updateDish.isPending}
            disabled={!name.trim() || picked.length === 0}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('dishes.create.name')}
      />

      <label className="block">
        <span className="mb-1 block text-micro text-text-muted">{t('dishes.create.category')}</span>
        <select
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="h-12 w-full rounded-sm border border-line bg-surface-2 px-3 text-body text-text-primary"
        >
          <option value="">{t('dishes.create.noCategory')}</option>
          {dishCategories.map((c) => (
            <option key={c.id} value={c.id}>{categoryLabel('dish', c.key, c.name)}</option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-micro text-text-muted">{t('dishes.create.ingredients')}</span>

        {picked.length === 0 && (
          <p className="mb-2 text-caption text-text-dim">{t('dishes.create.empty')}</p>
        )}

        {/* Без своей прокрутки: высотой и прокруткой занимается сам модал (R-7) */}
        <div>
          {picked.map((product) => (
            <div key={product.id} className="flex h-12 items-center gap-1 border-b border-line">
              <span className="min-w-0 flex-1 truncate text-body">{product.name}</span>
              <input
                value={product.quantity}
                onChange={(e) => setPicked((prev) => prev.map((p) =>
                  p.id === product.id ? { ...p, quantity: e.target.value } : p))}
                inputMode="decimal"
                placeholder={t('dishes.create.qty')}
                aria-label={`${product.name}, количество`}
                className="h-9 w-20 rounded-sm border border-line bg-surface-2 px-2 text-right text-body outline-none focus:border-accent"
              />
              <UnitSelect
                kitchenId={kitchenId}
                productId={product.id}
                productName={product.name}
                unit={product.unit}
                onChanged={(unit) => setPicked((prev) => prev.map((p) =>
                  p.id === product.id ? { ...p, unit } : p))}
              />
              <button
                type="button"
                aria-label={`Убрать ${product.name}`}
                onClick={() => setPicked((prev) => prev.filter((p) => p.id !== product.id))}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2">
          <ProductPicker
            kitchenId={kitchenId}
            pickedIds={picked.map((p) => p.id)}
            placeholder={t('dishes.create.search')}
            onPick={(product) => setPicked((prev) => [
              ...prev, { id: product.id, name: product.name, unit: product.unit, quantity: '' },
            ])}
            onError={setError}
          />
        </div>
      </div>

      {/* Как готовить (п. 33) — свободный текст, шаги с новой строки */}
      <label className="block">
        <span className="mb-1 block text-micro text-text-muted">{t('dishes.recipe')}</span>
        <textarea
          value={recipe}
          onChange={(e) => setRecipe(e.target.value)}
          placeholder={t('dishes.recipe.placeholder')}
          rows={6}
          maxLength={5000}
          className="w-full rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-body text-text-primary outline-none placeholder:text-[#4A4A4A] focus:border-accent"
        />
      </label>

      {error && <p className="text-caption text-danger">{error}</p>}
    </Modal>
  );
}
