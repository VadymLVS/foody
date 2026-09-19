import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Modal } from '@/shared/ui';
import { useCategories, useCreateProduct, useProducts, useSuggestions } from '@/shared/hooks/useProducts';
import { useCreateDish } from '@/shared/hooks/useDishes';
import { norm, searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { categoryLabel, t, unitLabel } from '@/shared/lib/i18n';
import type { Product } from '@/shared/db/types';

interface Picked {
  product: Product;
  /** Строка из поля ввода: пустая — количество не указано (D-031). */
  quantity: string;
}

interface Props {
  kitchenId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Своё блюдо (backlog п. 3).
 *
 * Раньше создать блюдо было нельзя вовсе: не было ни экрана, ни метода
 * в репозитории. Основной путь наполнения — карусель со справочником;
 * эта форма — для своих рецептов, которых в справочнике нет.
 *
 * Состав собирается из продуктов кухни: ингредиент — это ссылка на продукт
 * (D-005), иначе не работают готовность блюда и список покупок. Если продукта
 * ещё нет, он создаётся отсюда же как «нет в наличии».
 */
export function CreateDishModal({ kitchenId, open, onClose }: Props) {
  const { data: products = [] } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const { data: suggestions = [] } = useSuggestions();
  const createDish = useCreateDish(kitchenId);
  const createProduct = useCreateProduct(kitchenId);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(''); setCategoryId(null); setQuery(''); setPicked([]); setError(null);
  }, [open]);

  const dishCategories = useMemo(() => categories.filter((c) => c.kind === 'dish'), [categories]);

  // Уже выбранные продукты в подсказках не показываем
  const results = useMemo(() => {
    if (query.trim().length < SEARCH_MIN_LENGTH) return [];
    const pickedIds = new Set(picked.map((p) => p.product.id));
    return searchByName(products.filter((p) => !pickedIds.has(p.id)), query).slice(0, 6);
  }, [products, query, picked]);

  const exactExists = products.some((p) => norm(p.name) === norm(query));
  const canCreateProduct = query.trim().length >= SEARCH_MIN_LENGTH && !exactExists;

  const add = (product: Product) => {
    setPicked((prev) => [...prev, { product, quantity: '' }]);
    setQuery('');
  };

  const createAndAdd = () => {
    const title = query.trim();
    // Если продукт есть в справочнике, берём его единицу и картинку
    const suggestion = suggestions.find((s) => norm(s.name) === norm(title));
    const category = categories.find((c) => c.kind === 'product' && c.key === suggestion?.categoryKey);
    createProduct.mutate(
      {
        name: suggestion?.name ?? title,
        categoryId: category?.id ?? null,
        unit: suggestion?.unit ?? 'pcs',
        inStock: false,
        libraryKey: suggestion?.key ?? null,
      },
      {
        onSuccess: add,
        onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось создать продукт'),
      },
    );
  };

  const submit = () => {
    if (!name.trim() || picked.length === 0) return;
    setError(null);
    createDish.mutate(
      {
        name: name.trim(),
        categoryId,
        ingredients: picked.map(({ product, quantity }) => {
          const value = Number(quantity.replace(',', '.'));
          return {
            productId: product.id,
            productName: product.name,
            quantity: quantity.trim() && Number.isFinite(value) && value > 0 ? value : null,
          };
        }),
      },
      {
        onSuccess: onClose,
        onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось сохранить'),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={t('dishes.create.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            fullWidth
            onClick={submit}
            loading={createDish.isPending}
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

        <div className="max-h-[32vh] overflow-y-auto">
          {picked.map(({ product, quantity }) => (
            <div key={product.id} className="flex h-12 items-center gap-2 border-b border-line">
              <span className="min-w-0 flex-1 truncate text-body">{product.name}</span>
              <input
                value={quantity}
                onChange={(e) => setPicked((prev) => prev.map((p) =>
                  p.product.id === product.id ? { ...p, quantity: e.target.value } : p))}
                inputMode="decimal"
                placeholder={t('dishes.create.qty')}
                aria-label={`${product.name}, количество в ${unitLabel(product.unit)}`}
                className="h-9 w-20 rounded-sm border border-line bg-surface-2 px-2 text-right text-body outline-none focus:border-accent"
              />
              <span className="w-9 text-caption text-text-muted">{unitLabel(product.unit)}</span>
              <button
                type="button"
                aria-label={`Убрать ${product.name}`}
                onClick={() => setPicked((prev) => prev.filter((p) => p.product.id !== product.id))}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dishes.create.search')}
          />
        </div>

        {(results.length > 0 || canCreateProduct) && (
          <div className="mt-1 overflow-hidden rounded-sm border border-line">
            {results.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => add(product)}
                className="flex h-11 w-full items-center justify-between px-3 text-left text-body active:bg-surface-2"
              >
                {product.name}
                <span className="text-caption text-text-dim">{unitLabel(product.unit)}</span>
              </button>
            ))}
            {canCreateProduct && (
              <button
                type="button"
                onClick={createAndAdd}
                disabled={createProduct.isPending}
                className="flex h-11 w-full items-center gap-2 px-3 text-left text-body text-accent active:bg-surface-2"
              >
                <Plus className="h-4 w-4" />
                {t('dishes.create.newProduct', { name: query.trim() })}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}
    </Modal>
  );
}
