import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Modal } from '@/shared/ui';
import { useCategories, useCreateProduct, useProducts, useSuggestions } from '@/shared/hooks/useProducts';
import { useDishes } from '@/shared/hooks/useDishes';
import { useSaveSet } from '@/shared/hooks/useSets';
import { norm, searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { t, unitLabel } from '@/shared/lib/i18n';
import type { DishSet } from '@/shared/api/repo';
import type { Product, Unit } from '@/shared/db/types';

interface PickedProduct {
  id: string;
  name: string;
  unit: Unit;
  /** Строка из поля: пустая — количество не указано. */
  quantity: string;
}

interface Props {
  kitchenId: string;
  open: boolean;
  /** Правка существующего набора; без него — новый. */
  set?: DishSet | null;
  /** Новый набор из текущего плана («Сохранить как набор»). */
  initialDishIds?: string[];
  onClose: () => void;
  onSaved?: () => void;
}

const toNumber = (raw: string): number | null => {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() && Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Свой набор или правка набора (D-053).
 *
 * Состав — блюда кухни и продукты без блюда. Продукт без блюда ищется
 * среди продуктов кухни; если его нет, создаётся тут же как «нет в наличии»,
 * как в форме своего блюда.
 */
export function SetEditor({ kitchenId, open, set = null, initialDishIds, onClose, onSaved }: Props) {
  const { data: dishes = [] } = useDishes(kitchenId);
  const { data: products = [] } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const { data: suggestions = [] } = useSuggestions();
  const createProduct = useCreateProduct(kitchenId);
  const saveSet = useSaveSet(kitchenId);

  const [name, setName] = useState('');
  const [dishIds, setDishIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<PickedProduct[]>([]);
  const [dishQuery, setDishQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Форма заполняется при каждом открытии, а не при каждом обновлении данных:
  // иначе обновление списка продуктов стирало бы то, что уже набрано
  useEffect(() => {
    if (!open) return;
    setName(set?.name ?? '');
    setDishIds(set?.dishIds ?? initialDishIds ?? []);
    // Состав берётся из самого набора: список продуктов кухни мог ещё не загрузиться
    setPicked((set?.products ?? []).map((p) => ({
      id: p.productId,
      name: p.productName,
      unit: p.unit,
      quantity: p.quantity != null ? String(p.quantity).replace('.', ',') : '',
    })));
    setDishQuery('');
    setProductQuery('');
    setError(null);
  }, [open, set, initialDishIds]);

  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);

  const dishResults = useMemo(() => {
    if (dishQuery.trim().length < SEARCH_MIN_LENGTH) return [];
    return searchByName(dishes.filter((d) => !dishIds.includes(d.id)), dishQuery).slice(0, 6);
  }, [dishes, dishIds, dishQuery]);

  const productResults = useMemo(() => {
    if (productQuery.trim().length < SEARCH_MIN_LENGTH) return [];
    const pickedIds = new Set(picked.map((p) => p.id));
    return searchByName(products.filter((p) => !pickedIds.has(p.id)), productQuery).slice(0, 6);
  }, [products, picked, productQuery]);

  const canCreateProduct = productQuery.trim().length >= SEARCH_MIN_LENGTH
    && !products.some((p) => norm(p.name) === norm(productQuery));

  const addProduct = (product: Product) => {
    setPicked((prev) => [...prev, { id: product.id, name: product.name, unit: product.unit, quantity: '' }]);
    setProductQuery('');
  };

  const createAndAdd = () => {
    const title = productQuery.trim();
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
        onSuccess: addProduct,
        onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось создать продукт'),
      },
    );
  };

  const empty = dishIds.length === 0 && picked.length === 0;

  const submit = () => {
    if (!name.trim()) return;
    if (empty) {
      setError(t('sets.editor.needSomething'));
      return;
    }
    setError(null);
    saveSet.mutate(
      {
        id: set?.id,
        input: {
          name: name.trim(),
          libraryKey: set?.libraryKey ?? null,
          dishIds,
          products: picked.map(({ id, quantity }) => ({ productId: id, quantity: toNumber(quantity) })),
        },
      },
      {
        onSuccess: () => {
          onSaved?.();
          onClose();
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось сохранить'),
      },
    );
  };

  const searchList = (children: React.ReactNode) => (
    <div className="mt-1 overflow-hidden rounded-sm border border-line">{children}</div>
  );

  return (
    <Modal
      open={open}
      title={set ? t('sets.editor.titleEdit') : t('sets.editor.titleNew')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
          <Button fullWidth onClick={submit} loading={saveSet.isPending} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('sets.editor.name')} />

      {/* ── Блюда ── */}
      <div>
        <span className="mb-1 block text-micro text-text-muted">{t('sets.editor.dishes')}</span>
        {dishIds.length === 0 && <p className="mb-2 text-caption text-text-dim">{t('sets.editor.dishesEmpty')}</p>}
        <div className="max-h-[24vh] overflow-y-auto">
          {dishIds.map((id) => (
            <div key={id} className="flex h-11 items-center gap-2 border-b border-line">
              <span className="min-w-0 flex-1 truncate text-body">{dishById.get(id)?.name ?? '—'}</span>
              <button
                type="button"
                aria-label={`Убрать ${dishById.get(id)?.name ?? ''}`}
                onClick={() => setDishIds((prev) => prev.filter((d) => d !== id))}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Input value={dishQuery} onChange={(e) => setDishQuery(e.target.value)} placeholder={t('sets.editor.dishSearch')} />
        </div>
        {dishResults.length > 0 && searchList(
          dishResults.map((dish) => (
            <button
              key={dish.id}
              type="button"
              onClick={() => { setDishIds((prev) => [...prev, dish.id]); setDishQuery(''); }}
              className="flex h-11 w-full items-center px-3 text-left text-body active:bg-surface-2"
            >
              {dish.name}
            </button>
          )),
        )}
      </div>

      {/* ── Продукты без блюда ── */}
      <div>
        <span className="mb-1 block text-micro text-text-muted">{t('sets.editor.products')}</span>
        {picked.length === 0 && <p className="mb-2 text-caption text-text-dim">{t('sets.editor.productsEmpty')}</p>}
        <div className="max-h-[24vh] overflow-y-auto">
          {picked.map((product) => (
            <div key={product.id} className="flex h-12 items-center gap-2 border-b border-line">
              <span className="min-w-0 flex-1 truncate text-body">{product.name}</span>
              <input
                value={product.quantity}
                onChange={(e) => setPicked((prev) => prev.map((p) =>
                  p.id === product.id ? { ...p, quantity: e.target.value } : p))}
                inputMode="decimal"
                placeholder={t('dishes.create.qty')}
                aria-label={`${product.name}, количество в ${unitLabel(product.unit)}`}
                className="h-9 w-20 rounded-sm border border-line bg-surface-2 px-2 text-right text-body outline-none focus:border-accent"
              />
              <span className="w-9 text-caption text-text-muted">{unitLabel(product.unit)}</span>
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
          <Input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder={t('sets.editor.productSearch')}
          />
        </div>
        {(productResults.length > 0 || canCreateProduct) && searchList(
          <>
            {productResults.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
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
                {t('dishes.create.newProduct', { name: productQuery.trim() })}
              </button>
            )}
          </>,
        )}
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}
    </Modal>
  );
}
