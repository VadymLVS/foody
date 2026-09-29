import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Soup, Salad, EggFried, CakeSlice, UtensilsCrossed, LayoutGrid, GalleryHorizontalEnd,
  ListChecks, ChefHat, Sparkles, Layers, X, Eraser, BookmarkPlus,
} from 'lucide-react';
import {
  ActionSheet, Button, DishTile, EmptyState, FilterPills, SearchField, Tabs, useToast, BottomNav,
} from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useDishes, usePlanActions } from '@/shared/hooks/useDishes';
import { useCategories, useToggleProduct } from '@/shared/hooks/useProducts';
import { plural, searchByName } from '@/shared/lib/text';
import { categoryLabel, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';
import {
  useApplySet, useClearPlan, useDeleteSet, useMaterializeSet, useRemovePlannedSet, useSets,
} from '@/shared/hooks/useSets';
import { DishDetail } from './DishDetail';
import { SectionIcon } from './SectionIcon';
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

type Mode = 'dishes' | 'sets';
type Status = 'all' | 'planned' | 'ready' | 'fav';

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
  const { add, remove, favorite, removeDish, restoreDish } = usePlanActions(kitchenId);
  const toggleProduct = useToggleProduct(kitchenId);

  // ?tab=planned — сюда ведут «Готово» из карусели и из режима выбора (п. 19–20)
  const [params] = useSearchParams();
  /*
   * Три уровня, как в «Продуктах» (п. 24): раздел «Блюда | Наборы» →
   * тип блюда (вкладки) → состояние (пилюли). Раньше всё было одним рядом,
   * и «В меню», «Можно готовить», «Супы» стояли на равных.
   */
  const [mode, setMode] = useState<Mode>(params.get('tab') === 'sets' ? 'sets' : 'dishes');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<Status>(params.get('tab') === 'planned' ? 'planned' : 'all');
  const isSets = mode === 'sets';
  const isPlannedView = !isSets && status === 'planned';
  const showPlanned = () => {
    setMode('dishes');
    setStatus('planned');
  };
  const [search, setSearch] = useState('');
  // Храним id, а блюдо берём из свежего списка: после правки карточка сразу показывает новое
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = dishes.find((d) => d.id === detailId) ?? null;
  const setDetail = (d: DishWithStatus | null) => setDetailId(d?.id ?? null);
  const [editDish, setEditDish] = useState<DishWithStatus | null>(null);
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
        showPlanned();
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
        // У готового набора это не удаление, а «больше не предлагать» (U-1)
        toast.show(view.isLibrary
          ? t('sets.hidden', { name: view.name })
          : t('sets.deleted', { name: view.name }));
        setSheet(null);
      },
      onError: failed,
    });
  };

  const dishCategories = useMemo(() => categories.filter((c) => c.kind === 'dish'), [categories]);
  const readyCount = dishes.filter((d) => d.missingCount === 0).length;
  const plannedCount = dishes.filter((d) => d.isPlanned).length;

  /**
   * Что именно уйдёт из меню — числом в подтверждении. «Очистить меню»
   * восстанавливать дороже всего, и человек должен видеть охват (U-1).
   */
  const clearScope = useMemo(() => {
    const parts: string[] = [];
    if (plannedCount > 0) {
      parts.push(t('sets.clearCount.dishes', {
        count: plannedCount, noun: plural(plannedCount, 'блюдо', 'блюда', 'блюд'),
      }));
    }
    if (activeSets.length > 0) {
      parts.push(t('sets.clearCount.sets', {
        count: activeSets.length, noun: plural(activeSets.length, 'набор', 'набора', 'наборов'),
      }));
    }
    return parts.length > 0 ? t('sets.clearConfirm', { count: parts.join(' и ') }) : '';
  }, [plannedCount, activeSets.length]);

  const iconFor = (dish: DishWithStatus) => {
    const category = dishCategories.find((c) => c.id === dish.category_id);
    return (category?.key && CATEGORY_ICON[category.key]) ?? undefined;
  };

  const visible = useMemo(() => {
    let list = dishes;
    if (category !== 'all') list = list.filter((d) => d.category_id === category);
    if (status === 'planned') list = list.filter((d) => d.isPlanned);
    else if (status === 'ready') list = list.filter((d) => d.missingCount === 0);
    else if (status === 'fav') list = list.filter((d) => d.isFavorite);
    return searchByName(list, search);
  }, [dishes, category, status, search]);

  /*
   * Меню на момент входа в режим выбора — для «Отмены» (п. 40): передумал —
   * одно нажатие возвращает как было, а не снятие галочек по одной.
   */
  const [menuBefore, setMenuBefore] = useState<Set<string> | null>(null);
  const cancelSelecting = () => {
    if (menuBefore) {
      for (const dish of dishes) {
        if (dish.isPlanned && !menuBefore.has(dish.id)) remove.mutate(dish.id);
        else if (!dish.isPlanned && menuBefore.has(dish.id)) add.mutate(dish.id);
      }
    }
    setMenuBefore(null);
    setSelecting(false);
  };

  // Выбирают из всех блюд: в фильтре «В меню» снятая плитка исчезала бы из-под пальца
  const startSelecting = () => {
    setMenuBefore(new Set(dishes.filter((d) => d.isPlanned).map((d) => d.id)));
    setSelecting(true);
    setMode('dishes');
    if (status === 'planned') setStatus('all');
  };
  const finishSelecting = () => {
    setMenuBefore(null);
    setSelecting(false);
    showPlanned();
  };

  // Раскладка по двум столбцам: оценка высоты по пропорции снимка, без снимка — 104px на ~200px ширины
  const masonry = useMemo(() => {
    const cols: [DishWithStatus[], DishWithStatus[]] = [[], []];
    let left = 0;
    let right = 0;
    for (const dish of visible) {
      const h = (dish.image_w && dish.image_h ? dish.image_h / dish.image_w : 104 / 200) + 0.03;
      if (left <= right) { cols[0].push(dish); left += h; } else { cols[1].push(dish); right += h; }
    }
    return cols;
  }, [visible]);

  const renderTile = (dish: DishWithStatus) => (
    <DishTile
      key={dish.id}
      selectable={selecting}
      // Медаль — только в режиме выбора; в обычном просмотре меню живёт в своём фильтре
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
  );

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

      {/*
        Раздел: блюда или наборы. Наборы — отдельный список, фильтры блюд к ним не относятся.
        Переключатель не замечали (п. 37): цветные значки-эмодзи, у активного пункта
        подложка светлее и значок в полном цвете, у неактивного — приглушён. Без яркой плашки.
      */}
      <div className="mb-4 flex rounded-full bg-surface p-1" role="group" aria-label={t('dishes.section')}>
        {(['dishes', 'sets'] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMode(m);
                if (m === 'sets') cancelSelecting();
              }}
              className={cn(
                'flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-body transition-colors duration-200',
                active ? 'bg-[#2E2D2D] text-text-primary' : 'text-text-muted',
              )}
            >
              <SectionIcon kind={m} active={active} ring={active ? '#2E2D2D' : '#1A1919'} />
              {m === 'dishes' ? t('dishes.title') : t('sets.tab')}
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={isSets ? t('sets.search') : t('dishes.search')}
          withVoice={false}
        />
      </div>

      {!isSets && (
        <>
          <div className="mb-3">
            <Tabs
              active={category}
              onChange={setCategory}
              items={[
                { id: 'all', label: t('dishes.all') },
                ...dishCategories.map((c) => ({ id: c.id, label: categoryLabel('dish', c.key, c.name) })),
              ]}
            />
          </div>
          <div className="mb-4">
            <FilterPills
              active={status}
              onChange={(id) => setStatus(id as Status)}
              items={[
                { id: 'all', label: t('dishes.all') },
                { id: 'planned', label: plannedCount > 0 ? t('dishes.planned', { count: plannedCount }) : t('dishes.plannedTab') },
                // «Готово» читалось как «блюдо уже приготовлено» (п. 24)
                { id: 'ready', label: readyCount > 0 ? t('dishes.readyCount', { count: readyCount }) : t('dishes.ready') },
                { id: 'fav', label: t('dishes.favorites') },
              ]}
            />
          </div>
        </>
      )}

      <main className="pb-28">
        {isLoading && <p className="py-12 text-center text-caption text-text-muted">{t('common.loading')}</p>}

        {/* Наборы — свой список вместо сетки блюд */}
        {isSets && (
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
        {isPlannedView && (activeSets.length > 0 || plannedCount > 0) && (
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
        {!isLoading && !isSets && dishes.length === 0 && (
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

        {!isLoading && !isSets && dishes.length > 0 && visible.length === 0 && (
          isPlannedView && category === 'all' && !search ? (
            activeSets.length > 0 ? null : (
            <EmptyState
              icon={<UtensilsCrossed className="h-12 w-12" />}
              title={t('dishes.plannedEmpty')}
              description={t('dishes.plannedEmptyHint')}
              action={
                <div className="flex flex-col items-center gap-2">
                  <Button onClick={startSelecting}>{t('dishes.cook')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setMode('sets')}>{t('sets.tab')}</Button>
                </div>
              }
            />
            )
          ) : (
            <EmptyState icon={<UtensilsCrossed className="h-12 w-12" />} title={t('dishes.empty')} />
          )
        )}

        {/*
          Кладка — два обычных столбца, а не CSS-колонки (п. 39): Safari с ошибками
          перерисовывал анимацию медали во второй колонке многоколоночного блока.
          Блюдо уходит в столбец, который сейчас короче, — как и раньше, по высоте.
        */}
        {!isSets && (
          <div className="flex items-start gap-1.5">
            {masonry.map((column, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col">
                {column.map(renderTile)}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Нижняя навигация учитывает безопасную зону, а эта панель — нет:
          на iPhone кнопки уезжали под островок (обзор 09-26, U-5) */}
      {selecting && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center gap-2"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
        >
          <Button variant="secondary" className="bg-black/80 backdrop-blur-md" onClick={cancelSelecting}>
            {t('dishes.cancelSelecting')}
          </Button>
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
        title={clearScope || t('sets.clearConfirmEmpty')}
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
          setMode('sets');
        }}
      />

      <CreateDishModal kitchenId={kitchenId} open={createOpen} onClose={() => setCreateOpen(false)} />
      <CreateDishModal
        kitchenId={kitchenId}
        open={editDish !== null}
        dish={editDish}
        onClose={() => setEditDish(null)}
      />

      {detail && !editDish && (
        <DishDetail
          dish={detail}
          onClose={() => setDetail(null)}
          onEdit={() => setEditDish(detail)}
          onToggleFavorite={() => favorite.mutate({ id: detail.id, next: !detail.isFavorite })}
          onCooked={(usedUpIds) => {
            for (const productId of usedUpIds) toggleProduct(productId, false);
            remove.mutate(detail.id);
            toast.show(`${detail.name} — приготовлено`);
            setDetail(null);
          }}
          onDelete={() => {
            const { id, name } = detail;
            removeDish.mutate(id);
            // Удаление блюда — мягкое, поэтому у него есть «Отменить»,
            // как у продуктов (D-009, обзор 09-26, U-1)
            toast.show(`${name} удалено`, {
              action: { label: t('common.undo'), onClick: () => restoreDish.mutate(id) },
            });
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
