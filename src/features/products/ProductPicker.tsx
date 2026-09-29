import { useMemo, useState } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { Input } from '@/shared/ui';
import { repo } from '@/shared/api';
import { useCategories, useCreateProduct, useProducts, useSuggestions, useUpdateProduct } from '@/shared/hooks/useProducts';
import { norm, searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { useTapSelect } from '@/shared/lib/tapSelect';
import { t, unitLabel } from '@/shared/lib/i18n';
import type { Product, Unit } from '@/shared/db/types';

export const UNITS: Unit[] = ['pcs', 'kg', 'g', 'l', 'ml', 'pack'];

interface PickerProps {
  kitchenId: string;
  /** Уже добавленные продукты: в подсказках они показываются как «уже добавлено». */
  pickedIds: string[];
  placeholder: string;
  onPick: (product: Product) => void;
  onError: (message: string) => void;
}

/**
 * Поиск продукта для состава блюда или набора (п. 25, 27).
 *
 * Три источника в одном списке:
 * - продукты кухни;
 * - похожие из справочника, которых в кухне нет: «Уголь» → «Уголь для гриля · упак»,
 *   с правильной единицей и отделом (раньше единица бралась только при точном совпадении);
 * - «Создать «X»» — своё название как есть.
 *
 * Уже добавленный продукт не пропадает молча, а показывается строкой «уже добавлено»:
 * раньше на точном названии («Салфетки») список просто становился пустым.
 */
export function ProductPicker({ kitchenId, pickedIds, placeholder, onPick, onError }: PickerProps) {
  const { data: products = [] } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const { data: suggestions = [] } = useSuggestions();
  const createProduct = useCreateProduct(kitchenId);
  const [query, setQuery] = useState('');

  const q = query.trim();
  const active = q.length >= SEARCH_MIN_LENGTH;

  const { fromKitchen, alreadyPicked, fromLibrary } = useMemo(() => {
    if (!active) return { fromKitchen: [], alreadyPicked: [], fromLibrary: [] };
    const picked = new Set(pickedIds);
    const found = searchByName(products, q);
    const kitchenNames = new Set(products.map((p) => norm(p.name)));
    return {
      fromKitchen: found.filter((p) => !picked.has(p.id)).slice(0, 6),
      alreadyPicked: found.filter((p) => picked.has(p.id)).slice(0, 3),
      fromLibrary: searchByName(suggestions.filter((s) => !kitchenNames.has(norm(s.name))), q).slice(0, 3),
    };
  }, [active, products, pickedIds, suggestions, q]);

  const exactExists = products.some((p) => norm(p.name) === norm(q))
    || suggestions.some((s) => norm(s.name) === norm(q));

  const pick = (product: Product) => {
    onPick(product);
    setQuery('');
  };

  const create = (input: { name: string; unit: Unit; categoryKey: string | null; libraryKey: string | null }) => {
    const category = categories.find((c) => c.kind === 'product' && c.key === input.categoryKey);
    createProduct.mutate(
      {
        name: input.name,
        categoryId: category?.id ?? null,
        unit: input.unit,
        inStock: false,
        libraryKey: input.libraryKey,
      },
      {
        onSuccess: pick,
        onError: (e) => onError(e instanceof Error ? e.message : 'Не удалось создать продукт'),
      },
    );
  };

  // Выбор — на отпускании касания: с открытой клавиатурой onClick не доходит (п. 43)
  const tap = useTapSelect();
  const row = 'flex h-11 w-full items-center justify-between gap-2 px-3 text-left text-body active:bg-surface-2';
  const hasAny = fromKitchen.length + alreadyPicked.length + fromLibrary.length > 0 || (active && !exactExists);

  return (
    <div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      {active && hasAny && (
        <div className="mt-1 overflow-hidden rounded-sm border border-line">
          {fromKitchen.map((product) => (
            <button key={product.id} type="button" {...tap(() => pick(product))} className={row}>
              {product.name}
              <span className="text-caption text-text-dim">{unitLabel(product.unit)}</span>
            </button>
          ))}

          {alreadyPicked.map((product) => (
            <div key={product.id} className={`${row} text-text-dim`}>
              <span>{product.name}</span>
              <span className="flex items-center gap-1 text-caption">
                <Check className="h-3.5 w-3.5" />
                {t('picker.alreadyAdded')}
              </span>
            </div>
          ))}

          {fromLibrary.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={createProduct.isPending}
              {...tap(() => create({
                name: s.name, unit: s.unit, categoryKey: s.categoryKey, libraryKey: s.key,
              }))}
              className={row}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-text-dim" />
                {s.name}
              </span>
              <span className="text-caption text-text-dim">{unitLabel(s.unit)}</span>
            </button>
          ))}

          {!exactExists && (
            <button
              type="button"
              disabled={createProduct.isPending}
              {...tap(() => create({ name: q, unit: 'pcs', categoryKey: null, libraryKey: null }))}
              className={`${row} justify-start text-accent`}
            >
              <Plus className="h-4 w-4" />
              {t('dishes.create.newProduct', { name: q })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Единица у строки состава (п. 27). Нативный список — на iPhone это колесо выбора.
 * Рамка показывает, что единицу можно нажать: раньше это был просто серый текст.
 *
 * Единица одна на продукт (D-030), поэтому меняется у продукта везде. Если продукт
 * уже указан с количеством в блюдах, сначала спрашиваем: числа в блюдах сами
 * не пересчитаются, и «2 шт» превратятся в «2 упак».
 */
export function UnitSelect({
  kitchenId, productId, productName, unit, onChanged,
}: {
  kitchenId: string;
  productId: string;
  productName: string;
  unit: Unit;
  onChanged: (unit: Unit) => void;
}) {
  const updateProduct = useUpdateProduct(kitchenId);

  const change = async (next: Unit) => {
    if (next === unit) return;
    const used = await repo.countQuantifiedUsage(productId);
    if (used > 0 && !window.confirm(t('picker.unitConfirm', {
      name: productName, count: used, unit: unitLabel(next),
    }))) {
      return;
    }
    updateProduct(productId, { unit: next });
    onChanged(next);
  };

  return (
    <select
      value={unit}
      onChange={(e) => void change(e.target.value as Unit)}
      aria-label={t('picker.unitAria', { name: productName })}
      className="h-9 w-14 shrink-0 appearance-none rounded-sm border border-line bg-transparent text-center text-caption text-text-muted active:bg-surface-2"
    >
      {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
    </select>
  );
}
