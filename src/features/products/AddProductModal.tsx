import { useMemo, useState } from 'react';
import { Modal, Button, Input } from '@/shared/ui';
import { useCategories, useCreateProduct, useSuggestions } from '@/shared/hooks/useProducts';
import { norm } from '@/shared/lib/text';
import { categoryLabel, unitLabel, t } from '@/shared/lib/i18n';
import type { Unit } from '@/shared/db/types';

const UNITS: Unit[] = ['pcs', 'kg', 'g', 'l', 'ml', 'pack'];

interface Props {
  kitchenId: string;
  open: boolean;
  initialName?: string;
  existingNames: string[];
  onClose: () => void;
}

export function AddProductModal({ kitchenId, open, initialName = '', existingNames, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>('pcs');
  const [libraryKey, setLibraryKey] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);

  const { data: categories = [] } = useCategories(kitchenId);
  const { data: suggestions = [] } = useSuggestions();
  const create = useCreateProduct(kitchenId);

  const productCategories = useMemo(
    () => categories.filter((c) => c.kind === 'product'),
    [categories],
  );

  const duplicate = useMemo(
    () => existingNames.some((e) => norm(e) === norm(name)),
    [existingNames, name],
  );

  // Подсказка подставляет категорию, единицу и снимок из библиотеки разом
  const matches = useMemo(() => {
    const q = norm(name);
    if (q.length < 2) return [];
    return suggestions.filter((s) => norm(s.name).includes(q)).slice(0, 4);
  }, [suggestions, name]);

  const submit = () => {
    if (!name.trim() || duplicate) return;
    create.mutate(
      { name: name.trim(), categoryId, unit, inStock, libraryKey },
      {
        onSuccess: () => {
          setName(''); setCategoryId(null); setUnit('pcs');
          setLibraryKey(null); setInStock(false);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      title={t('common.add')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
          <Button fullWidth onClick={submit} loading={create.isPending} disabled={!name.trim() || duplicate}>
            {t('common.add')}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название"
        autoFocus
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
              className="h-8 rounded-full border border-line px-3 text-micro text-text-muted"
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
          className="h-11 w-full rounded-sm border border-line bg-surface-2 px-3 text-body text-text-primary"
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
          onChange={(e) => setUnit(e.target.value as Unit)}
          className="h-11 w-full rounded-sm border border-line bg-surface-2 px-3 text-body text-text-primary"
        >
          {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
        </select>
      </label>

      <label className="flex h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
          className="h-5 w-5 accent-[rgb(var(--accent))]"
        />
        <span className="text-body">Уже в наличии</span>
      </label>
    </Modal>
  );
}
