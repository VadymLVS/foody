import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input } from '@/shared/ui';
import { repo } from '@/shared/api';
import {
  useCategories, useCreateProduct, useSuggestions, useUpdateProduct,
} from '@/shared/hooks/useProducts';
import { norm } from '@/shared/lib/text';
import { categoryLabel, unitLabel, t } from '@/shared/lib/i18n';
import type { Product, Unit } from '@/shared/db/types';

const UNITS: Unit[] = ['pcs', 'kg', 'g', 'l', 'ml', 'pack'];

interface Props {
  kitchenId: string;
  open: boolean;
  /** Если передан — форма работает как редактирование этого продукта (backlog п. 11). */
  product?: Product | null;
  initialName?: string;
  existingNames: string[];
  onClose: () => void;
}

/**
 * Одна форма на добавление и правку. Раньше после создания нельзя было
 * поменять ничего, кроме названия: ошибку в категории или единице исправлял
 * только удалением и созданием заново.
 */
export function AddProductModal({
  kitchenId, open, product = null, initialName = '', existingNames, onClose,
}: Props) {
  const editing = product !== null;

  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>('pcs');
  const [libraryKey, setLibraryKey] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Сколько ингредиентов потеряют смысл при смене единицы; null — не проверяли. */
  const [unitWarning, setUnitWarning] = useState<number | null>(null);

  // Форма переиспользуется: при каждом открытии заполняем заново
  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? initialName);
    setCategoryId(product?.category_id ?? null);
    setUnit(product?.unit ?? 'pcs');
    setLibraryKey(product?.library_key ?? null);
    setInStock(product?.in_stock ?? false);
    setError(null);
    setUnitWarning(null);
  }, [open, product, initialName]);

  const { data: categories = [] } = useCategories(kitchenId);
  const { data: suggestions = [] } = useSuggestions();
  const create = useCreateProduct(kitchenId);
  const update = useUpdateProduct(kitchenId);

  const productCategories = useMemo(
    () => categories.filter((c) => c.kind === 'product'),
    [categories],
  );

  // Своё же имя при редактировании дублем не считается
  const duplicate = useMemo(
    () => existingNames.some((e) => norm(e) === norm(name) && norm(e) !== norm(product?.name ?? '')),
    [existingNames, name, product],
  );

  // Подсказка подставляет категорию, единицу и снимок из библиотеки разом
  const matches = useMemo(() => {
    const q = norm(name);
    if (q.length < 2) return [];
    return suggestions.filter((s) => norm(s.name).includes(q) && norm(s.name) !== q).slice(0, 4);
  }, [suggestions, name]);

  const save = () => {
    if (!product) return;
    update(product.id, {
      name: name.trim(),
      category_id: categoryId,
      unit,
      library_key: libraryKey,
    });
    onClose();
  };

  const submit = async () => {
    if (!name.trim() || duplicate) return;
    setError(null);

    if (!editing) {
      create.mutate(
        { name: name.trim(), categoryId, unit, inStock, libraryKey },
        {
          onSuccess: onClose,
          onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось сохранить'),
        },
      );
      return;
    }

    /*
     * Смена единицы у продукта из блюд: количество в ингредиентах хранится
     * числом без единицы (D-030), поэтому «1 кг» молча станет «1 шт».
     * Предупреждаем один раз; второе нажатие «Сохранить» — согласие.
     */
    if (unit !== product.unit && unitWarning === null) {
      try {
        const used = await repo.countQuantifiedUsage(product.id);
        if (used > 0) {
          setUnitWarning(used);
          return;
        }
      } catch {
        /* проверка не удалась — не блокируем сохранение */
      }
    }
    save();
  };

  return (
    <Modal
      open={open}
      title={editing ? 'Редактировать' : t('common.add')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            fullWidth
            onClick={() => void submit()}
            loading={create.isPending}
            disabled={!name.trim() || duplicate}
          >
            {editing ? t('common.save') : t('common.add')}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название"
        error={duplicate ? t('products.duplicate', { name: name.trim() }) : undefined}
      />

      {matches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {matches.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setName(s.name);
                setUnit(s.unit);
                setLibraryKey(s.key);
                const match = productCategories.find((c) => c.key === s.categoryKey);
                setCategoryId(match?.id ?? null);
              }}
              className="h-9 rounded-full border border-line px-3.5 text-micro text-text-muted"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-micro text-text-muted">Категория</span>
        <select
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="h-12 w-full rounded-sm border border-line bg-surface-2 px-3 text-body text-text-primary"
        >
          <option value="">Без категории</option>
          {productCategories.map((c) => (
            <option key={c.id} value={c.id}>{categoryLabel('product', c.key, c.name)}</option>
          ))}
        </select>
      </label>

      {/* Одна единица на продукт: ингредиенты её наследуют (D-030) */}
      <label className="block">
        <span className="mb-1 block text-micro text-text-muted">Единица измерения</span>
        <select
          value={unit}
          onChange={(e) => { setUnit(e.target.value as Unit); setUnitWarning(null); }}
          className="h-12 w-full rounded-sm border border-line bg-surface-2 px-3 text-body text-text-primary"
        >
          {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
        </select>
      </label>

      {unitWarning !== null && product && (
        <p className="rounded-sm bg-warning/10 px-3 py-2.5 text-caption text-warning">
          В {unitWarning} {unitWarning === 1 ? 'блюде' : 'блюдах'} у этого продукта указано
          количество в «{unitLabel(product.unit)}». После смены оно будет считаться
          в «{unitLabel(unit)}» — проверьте состав. Нажмите «Сохранить» ещё раз, чтобы продолжить.
        </p>
      )}

      {/* Наличие при правке меняется ползунком в списке, здесь только при создании */}
      {!editing && (
        <label className="flex h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="h-5 w-5 accent-[rgb(var(--accent))]"
          />
          <span className="text-body">Уже в наличии</span>
        </label>
      )}

      {error && <p className="text-caption text-danger">{error}</p>}
    </Modal>
  );
}
