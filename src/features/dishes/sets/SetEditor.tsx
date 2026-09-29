import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button, Input, Modal } from '@/shared/ui';
import { useDishes } from '@/shared/hooks/useDishes';
import { useSaveSet } from '@/shared/hooks/useSets';
import { norm, searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { t } from '@/shared/lib/i18n';
import { ProductPicker, UnitSelect } from '@/features/products/ProductPicker';
import { CreateDishModal } from '../CreateDishModal';
import type { DishSet } from '@/shared/api/repo';
import type { Unit } from '@/shared/db/types';

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
 * Состав — блюда кухни и продукты без блюда. Чего нет в кухне, создаётся
 * отсюда же: продукт — строкой в поиске, блюдо — формой поверх редактора (п. 26),
 * после сохранения оно сразу попадает в набор.
 */
export function SetEditor({ kitchenId, open, set = null, initialDishIds, onClose, onSaved }: Props) {
  const { data: dishes = [] } = useDishes(kitchenId);
  const saveSet = useSaveSet(kitchenId);

  const [name, setName] = useState('');
  const [dishIds, setDishIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<PickedProduct[]>([]);
  const [dishQuery, setDishQuery] = useState('');
  const [newDishName, setNewDishName] = useState<string | null>(null);
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
    setNewDishName(null);
    setError(null);
  }, [open, set, initialDishIds]);

  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);

  const dq = dishQuery.trim();
  const { dishResults, dishAlready } = useMemo(() => {
    if (dq.length < SEARCH_MIN_LENGTH) return { dishResults: [], dishAlready: [] };
    const found = searchByName(dishes, dq);
    return {
      dishResults: found.filter((d) => !dishIds.includes(d.id)).slice(0, 6),
      dishAlready: found.filter((d) => dishIds.includes(d.id)).slice(0, 3),
    };
  }, [dishes, dishIds, dq]);
  const canCreateDish = dq.length >= SEARCH_MIN_LENGTH && !dishes.some((d) => norm(d.name) === norm(dq));

  const addDish = (id: string) => {
    setDishIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDishQuery('');
  };

  const submit = () => {
    if (!name.trim()) return;
    if (dishIds.length === 0 && picked.length === 0) {
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

  const row = 'flex h-11 w-full items-center justify-between gap-2 px-3 text-left text-body active:bg-surface-2';

  return (
    <>
      <Modal
        open={open && newDishName === null}
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
          <div>
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
          {(dishResults.length > 0 || dishAlready.length > 0 || canCreateDish) && (
            <div className="mt-1 overflow-hidden rounded-sm border border-line">
              {dishResults.map((dish) => (
                <button key={dish.id} type="button" onClick={() => addDish(dish.id)} className={row}>
                  {dish.name}
                </button>
              ))}
              {dishAlready.map((dish) => (
                <div key={dish.id} className={`${row} text-text-dim`}>
                  <span>{dish.name}</span>
                  <span className="flex items-center gap-1 text-caption">
                    <Check className="h-3.5 w-3.5" />
                    {t('picker.alreadyAdded')}
                  </span>
                </div>
              ))}
              {canCreateDish && (
                <button
                  type="button"
                  onClick={() => setNewDishName(dq)}
                  className={`${row} justify-start text-accent`}
                >
                  <Plus className="h-4 w-4" />
                  {t('sets.editor.newDish', { name: dq })}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Продукты без блюда ── */}
        <div>
          <span className="mb-1 block text-micro text-text-muted">{t('sets.editor.products')}</span>
          {picked.length === 0 && <p className="mb-2 text-caption text-text-dim">{t('sets.editor.productsEmpty')}</p>}
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
              placeholder={t('sets.editor.productSearch')}
              onPick={(product) => setPicked((prev) => [
                ...prev, { id: product.id, name: product.name, unit: product.unit, quantity: '' },
              ])}
              onError={setError}
            />
          </div>
        </div>

        {error && <p className="text-caption text-danger">{error}</p>}
      </Modal>

      {/* Своё блюдо поверх набора: после сохранения оно сразу в составе (п. 26) */}
      <CreateDishModal
        kitchenId={kitchenId}
        open={newDishName !== null}
        initialName={newDishName ?? ''}
        onCreated={addDish}
        onClose={() => setNewDishName(null)}
      />
    </>
  );
}
