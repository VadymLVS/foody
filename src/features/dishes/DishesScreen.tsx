import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Soup, Salad, EggFried, CakeSlice, UtensilsCrossed, LayoutGrid, GalleryHorizontalEnd,
  ListChecks, ChefHat, Sparkles, Layers, X, Eraser, BookmarkPlus,
} from 'lucide-react';
import {
  ActionSheet, Button, DishTile, EmptyState, SearchField, Tabs, useToast, BottomNav,
} from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useDishes, usePlanActions } from '@/shared/hooks/useDishes';
import { useCategories, useToggleProduct } from '@/shared/hooks/useProducts';
import { searchByName } from '@/shared/lib/text';
import { categoryLabel, t } from '@/shared/lib/i18n';
import {
  useApplySet, useClearPlan, useDeleteSet, useMaterializeSet, useRemovePlannedSet, useSets,
} from '@/shared/hooks/useSets';
import { DishDetail } from './DishDetail';
import { CreateDishModal } from './CreateDishModal';
import { SetsList, toSetView, type SetView } from './sets/SetsList';
import { SetSheet } from './sets/SetSheet';
import { SetEditor } from './sets/SetEditor';
import { StockCheck } from '@/features/products/StockCheck';
import type { DishSet, DishWithStatus } from '@/shared/api/repo';
import type { Product } from '@/shared/db/types';

interface EditorState {
  set: DishSet | null;
  initialDishIds?: string[];
}

const TABS_FROM_URL = new Set(['planned', 'sets']);

/** Иконка по категории — вместо цветной заливки на плитках без фото. */
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  soups: <Soup className="h-6 w-6 text-[#3E3E3E]" />,
  salads: <Salad className="h-6 w-6 text-[#3E3E3E]" />,
  breakfasts: <EggFried className="h-6 w-6 text-[#3E3E3E]" />,
  baking: <CakeSlice className="h-6 w-6 text-[#3E3E3E]" />,
  mains: <UtensilsCrossed className="h-6 w-6 text-[#3E3E3E]" />,
};

export function DishesScreen() {
  const kitchen = useCurrentKitchen();
  const kitchenId = kitchen?.id ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: dishes = [], isLoading } = useDishes(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const { add, remove, favorite, removeDish } = usePlanActions(kitchenId);
  const toggleProduct = useToggleProduct(kitchenId);

  // ?tab=planned — сюда ведут «Готово» из карусели и из режима выбора (п. 19–20)
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const fromUrl = params.get('tab') ?? '';
    return TABS_FROM_URL.has(fromUrl) ? fromUrl : 'all';
  });
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DishWithStatus | null>(null);
  // «Выбрать блюда» из пустого фильтра «Для плана» открывает сразу режим выбора
  const [selecting, setSelecting] = useState(params.get('select') === '1');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // ── Наборы (D-053…D-056) ──
  const { data: setsData } = useSets(kitchenId);
  const sets = useMemo(() => setsData?.sets ?? [], [setsData]);
  const library = setsData?.library ?? [];
  const activeSets = useMemo(
    () => sets.filter((s) => s.plannedSetId)
      .sort((a, b) => (a.plannedAt ?? '').localeCompare(b.plannedAt ?? '')),
    [sets],
  );
  const applySet = useApplySet(kitchenId);
  const removePlanned = useRemovePlannedSet(kitchenId);
  const deleteSet = useDeleteSet(kitchenId);
  const materialize = useMaterializeSet(kitchenId);
  const clearPlan = useClearPlan(kitchenId);

  const [sheet, setSheet] = useState<SetView | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Созданные продукты → шаг «что уже есть дома?»; после него может открыться правка набора
  const [created, setCreated] = useState<Product[] | null>(null);
  const [editorAfterStock, setEditorAfterStock] = useState<EditorState | null>(null);

  const failed = (e: unknown) =>
    toast.show(t('products.saveFailed', { reason: e instanceof Error ? e.message : '' }));

  // Лист набора показывает свежие данные: после применения набор становится «в плане»
  const sheetView = useMemo(() => {
    if (!sheet || !('set' in sheet.ref)) return sheet;
    const id = sheet.ref.set.id;
    const fresh = sets.find((s) => s.id === id);
    return fresh ? toSetView({ set: fresh }, dishes) : sheet;
  }, [sheet, sets, dishes]);

  const onApply = (view: SetView) => {
    applySet.mutate(view.ref, {
      onSuccess: (newProducts) => {
        toast.show(t('sets.applied', { name: view.name }));
        setSheet(null);
        setTab('planned');
        if (newProducts.length > 0) setCreated(newProducts);
      },
      onError: failed,
    });
  };

  const onRemoveSet = (set: DishSet) => {
    if (!set.plannedSetId) return;
    removePlanned.mutate(set.plannedSetId, {
      onSuccess: () => {
        toast.show(t('sets.removed', { name: set.name }));
        setSheet(null);
      },
      onError: failed,
    });
  };

  const onEdit = (view: SetView) => {
    setSheet(null);
    if ('set' in view.ref) {
      setEditor({ set: view.ref.set });
      return;
    }
    // Готовый набор перед правкой заводится в кухне
    materialize.mutate(view.ref.library, {
      onSuccess: ({ set, created: newProducts }) => {
        const next = { set };
        if (newProducts.length > 0) {
          setEditorAfterStock(next);
          setCreated(newProducts);
        } else {
          setEditor(next);
        }
      },
      onError: failed,
    });
  };

  const onDeleteSet = (view: SetView) => {
    deleteSet.mutate(view.ref, {
      onSuccess: () => {
        toast.show(t('sets.deleted', { name: view.name }));
        setSheet(null);
      },
      onError: failed,
    });
  };

  const dishCategories = useMemo(() => categories.filter((c) => c.kind === 'dish'), [categories]);
  const readyCount = dishes.filter((d) => d.missingCount === 0).length;
  const plannedCount = dishes.filter((d) => d.isPlanned).length;

  const iconFor = (dish: DishWithStatus) => {
    const category = dishCategories.find((c) => c.id === dish.category_id);
    return (category?.key && CATEGORY_ICON[category.key]) ?? undefined;
  };

  const visible = useMemo(() => {
    let list = dishes;
    if (tab === 'planned') list = list.filter((d) => d.isPlanned);
    else if (tab === 'ready') list = list.filter((d) => d.missingCount === 0);
    else if (tab === 'fav') list = list.filter((d) => d.isFavorite);
    else if (tab !== 'all') list = list.filter((d) => d.category_id === tab);
    return searchByName(list, search);
  }, [dishes, tab, search]);

  // Выбирают из всех блюд: на вкладке «Готовим» снятая плитка исчезала бы из-под пальца
  const startSelecting = () => {
    setSelecting(true);
    if (tab === 'planned' || tab === 'sets') setTab('all');
  };
  const finishSelecting = () => {
    setSelecting(false);
    setTab('planned');
  };

  const togglePlan = (dish: DishWithStatus) => {
    if (dish.isPlanned) remove.mutate(dish.id);
    else add.mutate(dish.id);
  };

  if (created) {
    return (
      <StockCheck
        kitchenId={kitchenId}
        products={created}
        onDone={() => {
          setCreated(null);
          if (editorAfterStock) {
            setEditor(editorAfterStock);
            setEditorAfterStock(null);
          }
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[520px] px-3 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3 px-0.5">
        <h1 className="min-w-0 truncate text-title">{t('dishes.title')}</h1>
        {selecting ? (
          /* shrink-0: переключатель не сжимается и не уезжает за край (backlog п. 5) */
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface p-1">
            <span className="flex h-9 w-11 items-center justify-center rounded-full bg-accent" aria-label="Плитка">
              <LayoutGrid className="h-[18px] w-[18px] text-accent-ink" />
            </span>
            <button
              type="button"
              aria-label="Карусель"
              onClick={() => navigate('/today/choose')}
              className="flex h-9 w-11 items-center justify-center rounded-full text-text-muted"
            >
              <GalleryHorizontalEnd className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <Button size="sm" onClick={startSelecting}>{t('dishes.cook')}</Button>
        )}
      </header>

      <div className="mb-4">
        <SearchField value={search} onChange={setSearch} placeholder={t('dishes.search')} withVoice={false} />
      </div>

      <div className="mb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: 'all', label: t('dishes.all') },
            // План — отдельной вкладкой, а не медалями поверх «Все» (п. 19)
            { id: 'planned', label: plannedCount > 0 ? t('dishes.planned', { count: plannedCount }) : t('dishes.plannedTab') },
            { id: 'sets', label: t('sets.tab') },
            { id: 'ready', label: `${t('dishes.ready')} ${readyCount}` },
            { id: 'fav', label: t('dishes.favorites') },
            ...dishCategories.map((c) => ({ id: c.id, label: categoryLabel('dish', c.key, c.name) })),
          ]}
        />
      </div>

      <main className="pb-28">
        {isLoading && <p className="py-12 text-center text-caption text-text-muted">{t('common.loading')}</p>}

        {/* Наборы — свой список вместо сетки блюд */}
        {tab === 'sets' && (
          <SetsList
            sets={sets}
            library={library}
            dishes={dishes}
            search={search}
            onOpen={setSheet}
            onCreate={() => setEditor({ set: null })}
          />
        )}

        {/* Применённые наборы и действия с планом целиком */}
        {tab === 'planned' && (activeSets.length > 0 || plannedCount > 0) && (
          <div className="mb-3">
            {activeSets.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {activeSets.map((set) => (
                  <span key={set.id} className="flex h-9 items-center gap-1 rounded-full border-[0.5px] border-accent/70 pl-3 text-caption text-accent">
                    <Layers className="h-3.5 w-3.5" />
                    {set.name}
                    <button
                      type="button"
                      aria-label={t('sets.removeAria', { name: set.name })}
                      onClick={() => onRemoveSet(set)}
                      className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              {plannedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setEditor({
                    set: null,
                    initialDishIds: dishes.filter((d) => d.isPlanned).map((d) => d.id),
                  })}
                  className="flex h-11 items-center gap-1.5 rounded-full px-3 text-caption text-text-muted active:bg-surface"
                >
                  <BookmarkPlus className="h-4 w-4" />
                  {t('sets.saveAsSet')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="ml-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-caption text-text-muted active:bg-surface"
              >
                <Eraser className="h-4 w-4" />
                {t('sets.clearPlan')}
              </button>
            </div>
          </div>
        )}

        {/* Пустой раздел зовёт к действию: карусель — основной путь (backlog п. 4) */}
        {!isLoading && tab !== 'sets' && dishes.length === 0 && (
          <EmptyState
            icon={<Sparkles className="h-12 w-12" />}
            title={t('dishes.nothingYet')}
            description={t('dishes.pickHint')}
            action={
              <div className="flex flex-col items-center gap-2">
                <Button onClick={() => navigate('/dishes/quick-start')}>{t('products.quickStart')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
                  {t('dishes.addOwn')}
                </Button>
              </div>
            }
          />
        )}

        {!isLoading && tab !== 'sets' && dishes.length > 0 && visible.length === 0 && (
          tab === 'planned' && !search ? (
            activeSets.length > 0 ? null : (
            <EmptyState
              icon={<UtensilsCrossed className="h-12 w-12" />}
              title={t('dishes.plannedEmpty')}
              description={t('dishes.plannedEmptyHint')}
              action={
                <div className="flex flex-col items-center gap-2">
                  <Button onClick={startSelecting}>{t('dishes.cook')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setTab('sets')}>{t('sets.tab')}</Button>
                </div>
              }
            />
            )
          ) : (
            <EmptyState icon={<UtensilsCrossed className="h-12 w-12" />} title={t('dishes.empty')} />
          )
        )}

        <div className="columns-2 gap-1.5">
          {tab !== 'sets' && visible.map((dish) => (
            <DishTile
              key={dish.id}
              selectable={selecting}
              // Медаль — только в режиме выбора; в обычном просмотре план живёт на своей вкладке
              selected={selecting && dish.isPlanned}
              onClick={() => (selecting ? togglePlan(dish) : setDetail(dish))}
              dish={{
                id: dish.id,
                name: dish.name,
                imageUrl: dish.library_key ? `/library/dishes/${dish.library_key}.webp` : null,
                aspect: dish.image_w && dish.image_h ? dish.image_w / dish.image_h : null,
                missingCount: dish.missingCount,
                isFavorite: dish.isFavorite,
                categoryIcon: iconFor(dish),
              }}
            />
          ))}
        </div>
      </main>

      {selecting && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center">
          <Button onClick={finishSelecting}>
            {t('dishes.doneSelecting', { count: plannedCount })}
          </Button>
        </div>
      )}

      {/* «+» — оба пути добавления блюда в одном месте */}
      <BottomNav onAdd={() => setAddMenuOpen(true)} />

      <ActionSheet
        open={addMenuOpen}
        title={t('common.add')}
        onClose={() => setAddMenuOpen(false)}
        actions={[
          { label: t('dishes.addFromList'), Icon: ListChecks, onClick: () => navigate('/dishes/quick-start') },
          { label: t('dishes.addOwn'), Icon: ChefHat, onClick: () => setCreateOpen(true) },
          { label: t('dishes.addSet'), Icon: Layers, onClick: () => setEditor({ set: null }) },
        ]}
      />

      <ActionSheet
        open={confirmClear}
        title={t('sets.clearConfirm')}
        onClose={() => setConfirmClear(false)}
        actions={[{
          label: t('sets.clearPlan'),
          Icon: Eraser,
          danger: true,
          onClick: () => clearPlan.mutate(undefined, {
            onSuccess: () => toast.show(t('sets.cleared')),
            onError: failed,
          }),
        }]}
      />

      <SetSheet
        view={sheetView}
        busy={applySet.isPending || removePlanned.isPending || materialize.isPending || deleteSet.isPending}
        onClose={() => setSheet(null)}
        onApply={() => sheetView && onApply(sheetView)}
        onRemove={() => sheetView && 'set' in sheetView.ref && onRemoveSet(sheetView.ref.set)}
        onEdit={() => sheetView && onEdit(sheetView)}
        onDelete={() => sheetView && onDeleteSet(sheetView)}
      />

      <SetEditor
        kitchenId={kitchenId}
        open={editor !== null}
        set={editor?.set ?? null}
        initialDishIds={editor?.initialDishIds}
        onClose={() => setEditor(null)}
        onSaved={() => {
          toast.show(t('sets.saved'));
          setTab('sets');
        }}
      />

      <CreateDishModal kitchenId={kitchenId} open={createOpen} onClose={() => setCreateOpen(false)} />

      {detail && (
        <DishDetail
          dish={detail}
          onClose={() => setDetail(null)}
          onToggleFavorite={() => favorite.mutate({ id: detail.id, next: !detail.isFavorite })}
          onCooked={(usedUpIds) => {
            for (const productId of usedUpIds) toggleProduct(productId, false);
            remove.mutate(detail.id);
            toast.show(`${detail.name} — приготовлено`);
            setDetail(null);
          }}
          onDelete={() => {
            removeDish.mutate(detail.id);
            toast.show(`${detail.name} удалено`);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
