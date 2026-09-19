import { useMemo } from 'react';
import { Layers, Plus } from 'lucide-react';
import { EmptyState } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dishLabel, productLabel, setLabel, t } from '@/shared/lib/i18n';
import { norm, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import type { DishSet, DishWithStatus } from '@/shared/api/repo';
import { PRODUCT_META, type LibrarySet } from '@/shared/lib/dishLibrary';
import type { Unit } from '@/shared/db/types';
import type { SetRef } from '@/shared/hooks/useSets';

/** Всё, что нужно карточке и листу набора, — одинаково для своих и готовых. */
export interface SetView {
  ref: SetRef;
  key: string;
  name: string;
  dishNames: string[];
  products: Array<{ name: string; quantity: number | null; unit: Unit | null }>;
  isLibrary: boolean;
  isPlanned: boolean;
}

export function toSetView(ref: SetRef, dishes: DishWithStatus[]): SetView {
  if ('set' in ref) {
    const set: DishSet = ref.set;
    const byId = new Map(dishes.map((d) => [d.id, d.name]));
    return {
      ref,
      key: set.id,
      name: set.name,
      dishNames: set.dishIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      products: set.products.map((p) => ({ name: p.productName, quantity: p.quantity, unit: p.unit })),
      isLibrary: false,
      isPlanned: Boolean(set.plannedSetId),
    };
  }
  const lib: LibrarySet = ref.library;
  return {
    ref,
    key: `lib-${lib.key}`,
    name: setLabel(lib.key),
    dishNames: lib.dishes.map(dishLabel),
    products: lib.products.map(([key, quantity]) => ({
      name: productLabel(key, key), quantity, unit: PRODUCT_META[key]?.unit ?? null,
    })),
    isLibrary: true,
    isPlanned: false,
  };
}

interface Props {
  sets: DishSet[];
  library: LibrarySet[];
  dishes: DishWithStatus[];
  search: string;
  onOpen: (view: SetView) => void;
  onCreate: () => void;
}

/**
 * Вкладка «Наборы» (D-053). Свои наборы сверху, готовые — следом:
 * готовый набор, который уже заводили в кухне, становится своим.
 */
export function SetsList({ sets, library, dishes, search, onOpen, onCreate }: Props) {
  const views = useMemo(() => {
    const all = [
      ...sets.map((set) => toSetView({ set }, dishes)),
      ...library.map((lib) => toSetView({ library: lib }, dishes)),
    ];
    const q = norm(search);
    return q.length >= SEARCH_MIN_LENGTH ? all.filter((v) => norm(v.name).includes(q)) : all;
  }, [sets, library, dishes, search]);

  return (
    <div className="flex flex-col gap-1.5">
      {views.length === 0 && (
        <EmptyState icon={<Layers className="h-12 w-12" />} title={t('sets.empty')} />
      )}

      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          onClick={() => onOpen(view)}
          className={cn(
            'w-full rounded-tile border-[0.5px] bg-surface px-3.5 py-3 text-left transition-colors active:bg-surface-2',
            view.isPlanned ? 'border-accent/70' : 'border-transparent',
          )}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('font-display truncate text-headline', view.isPlanned && 'text-accent')}>
              {view.name}
            </span>
            <span className="shrink-0 text-micro text-text-dim">
              {view.isPlanned ? t('sets.inPlan') : view.isLibrary ? t('sets.ready') : ''}
            </span>
          </span>
          <span className="mt-1 block truncate text-caption text-text-muted">
            {[...view.dishNames, ...view.products.map((p) => p.name)].join(', ')}
          </span>
          <span className="mt-1 block text-micro text-text-dim">
            {t('sets.dishesCount', { count: view.dishNames.length })}
            {view.products.length > 0 && ` · ${t('sets.productsCount', { count: view.products.length })}`}
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={onCreate}
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-tile border-[0.5px] border-dashed border-line text-body text-text-muted active:bg-surface"
      >
        <Plus className="h-4 w-4" />
        {t('sets.new')}
      </button>
    </div>
  );
}
