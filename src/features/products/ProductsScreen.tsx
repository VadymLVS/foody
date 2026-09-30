import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, CloudOff, Eraser, ListChecks, ListPlus, PackageCheck, PackagePlus,
  PartyPopper, Pencil, Receipt, SearchX, ShoppingBasket, Sparkles, Trash2, UtensilsCrossed,
} from 'lucide-react';
import {
  ActionSheet, BottomNav, Button, EmptyState, FilterPills, ProductRow, SearchField, Tabs,
  useToast, type PlanNeed,
} from '@/shared/ui';
import { repo } from '@/shared/api';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import {
  useBulkPatch, useCategories, useDeleteProduct, usePendingCount, useProducts,
  useProductsRealtime, useQueueFlusher, useSetQuantity, useToggleProduct,
} from '@/shared/hooks/useProducts';
import { usePlanNeeds, usePlanned } from '@/shared/hooks/useDishes';
import {
  useActiveOnceList, useProductListActions, useProductLists, useProductListsRealtime,
} from '@/shared/hooks/useProductLists';
import { useUI } from '@/shared/store/ui';
import { capitalize, multiSearch, plural, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { useTapSelect } from '@/shared/lib/tapSelect';
import { categoryLabel, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';
import { groupByCategory } from './grouping';
import { AddProductModal } from './AddProductModal';
import { ListEditor } from './ListEditor';
// Разбор чека открывают редко — грузим его по нажатию, а не при старте
const ReceiptImport = lazy(() => import('./ReceiptImport').then((m) => ({ default: m.ReceiptImport })));
import type { Product } from '@/shared/db/types';
import type { ProductList } from '@/shared/api/repo';

type Status = 'all' | 'to-buy' | 'plan' | 'in-stock';

/**
 * Какие фильтры группируются по отделам магазина (D-007).
 * «Купить» и «Для плана» — это списки для похода в магазин, по ним идут по залу.
 * «Все» и «В наличии» — просмотр того, что есть: там заголовки отделов только
 * занимают место, нужен плоский алфавит (backlog п. 15, решение Vadym).
 */
const GROUPED: ReadonlySet<Status> = new Set(['to-buy', 'plan']);

export function ProductsScreen() {
  const kitchen = useCurrentKitchen();
  const kitchenId = kitchen?.id ?? '';
  const toast = useToast();
  const navigate = useNavigate();

  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const categoryFilter = useUI((s) => s.categoryFilter);
  const setCategoryFilter = useUI((s) => s.setCategoryFilter);
  const statusFilter = useUI((s) => s.statusFilter) as Status;
  const setStatusFilter = useUI((s) => s.setStatusFilter);
  const activeProductId = useUI((s) => s.activeProductId);
  const setActiveProduct = useUI((s) => s.setActiveProduct);
  const showImages = useUI((s) => s.showRowImages);

  const { data: products = [], isLoading } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const { data: needs = [] } = usePlanNeeds(kitchenId);
  const { data: planned = [] } = usePlanned(kitchenId);

  // Подписка на изменения — только здесь, в одном месте (backlog п. 7)
  useProductsRealtime(kitchenId);
  useQueueFlusher(kitchenId);
  const pending = usePendingCount();

  // «Создать «X»» под полем поиска — тот же случай, что подсказки (п. 43)
  const tap = useTapSelect();
  const toggleProduct = useToggleProduct(kitchenId);
  const setQuantity = useSetQuantity(kitchenId);
  const bulkPatch = useBulkPatch(kitchenId);
  const { remove, restore } = useDeleteProduct(kitchenId);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const openAdd = (name = '') => {
    setAddName(name);
    setAddOpen(true);
  };
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Product | null>(null);
  const [editFor, setEditFor] = useState<Product | null>(null);
  const [confirmTurnOff, setConfirmTurnOff] = useState(false);

  /* ── Списки покупок (п. 45) ─────────────────────────────── */
  const listFilter = useUI((st) => st.listFilter);
  const setListFilter = useUI((st) => st.setListFilter);
  const { data: lists = [] } = useProductLists(kitchenId);
  useProductListsRealtime(kitchenId);
  const onceList = useActiveOnceList(lists);
  const listActions = useProductListActions(kitchenId);
  const [listSheetOpen, setListSheetOpen] = useState(false);
  /*
   * Пилюля выбранного списка стоит в конце ряда и при ширине телефона
   * оказывается за кадром: подводим ряд к ней, когда список включили.
   * `inline: 'end'` доводит до правого края, а зарезервированный отступ
   * в FilterPills не даёт ей уехать под закреплённую кнопку.
   */
  const listPillRef = useRef<HTMLButtonElement>(null);
  const [editorFor, setEditorFor] = useState<ProductList | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const activeList = useMemo(
    () => lists.find((l) => l.id === listFilter) ?? null,
    [lists, listFilter],
  );

  /**
   * Отмеченное в этом заходе остаётся в списке до смены фильтра.
   * Иначе строка исчезает из-под пальца, и в магазине непонятно,
   * что уже собрано, — как вычеркнутая строка в бумажном списке.
   */
  const [justToggled, setJustToggled] = useState<Set<string>>(new Set());
  const remember = (id: string) => setJustToggled((s) => new Set(s).add(id));

  useEffect(() => {
    setJustToggled(new Set());
  }, [statusFilter, categoryFilter, search]);

  /*
   * Разовый список показывается сам, без поиска по интерфейсу: его создают
   * для того, кто уже едет в магазин (п. 45).
   *
   * Отметка о показе живёт в sessionStorage, а не в localStorage: один раз
   * за запуск приложения. Вышел из списка сам — в этот раз больше не
   * навязываемся; открыл приложение у полки заново — список снова первым,
   * пока поездка не закрыта.
   */
  const AUTO_SHOWN = 'pantrysync:list:autoshown';
  useEffect(() => {
    if (!onceList) return;
    let shown: string | null = null;
    try { shown = sessionStorage.getItem(AUTO_SHOWN); } catch { /* приватный режим */ }
    if (shown === onceList.id) return;
    try { sessionStorage.setItem(AUTO_SHOWN, onceList.id); } catch { /* ignore */ }
    setListFilter(onceList.id);
  }, [onceList, setListFilter]);

  useEffect(() => {
    if (!listFilter) return;
    // Подводим ряд к пилюле только если она действительно не видна целиком:
    // прежняя безусловная прокрутка до конца уносила «Все» за левый край
    const pill = listPillRef.current;
    const row = pill?.parentElement;
    if (!pill || !row) return;
    const hidden = pill.offsetLeft + pill.offsetWidth - row.scrollLeft > row.clientWidth;
    if (hidden) row.scrollTo({ left: row.scrollWidth, behavior: 'smooth' });
  }, [listFilter]);

  const closeList = (list: ProductList) => {
    listActions.close.mutate(list.id, {
      onSuccess: () => {
        setListFilter(null);
        toast.show(t('lists.once.closed', { name: list.name }));
      },
    });
  };

  const searching = search.trim().length >= SEARCH_MIN_LENGTH;

  /** Потребности плана по product_id — из них берётся грань и подпись (D-032). */
  const needByProduct = useMemo(() => {
    const map = new Map<string, PlanNeed>();
    for (const row of needs) {
      map.set(row.product_id, { totalQuantity: row.total_quantity, dishes: row.dishes });
    }
    return map;
  }, [needs]);

  const productCategories = useMemo(
    () => categories.filter((c) => c.kind === 'product'),
    [categories],
  );

  /*
   * Поиск идёт по всем продуктам, мимо вкладки категории и фильтра статуса (п. 21):
   * иначе «огурцы» на вкладке «Молочное» не находились, и предлагалось
   * создать дубль. Фраза из нескольких продуктов разбирается на части.
   */
  const searchResult = useMemo(
    () => (searching ? multiSearch(products, search) : null),
    [searching, products, search],
  );

  const visible = useMemo(() => {
    if (searchResult) return searchResult.matches;
    let list = products;
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    /*
     * Выбран список покупок — показываем только его позиции, и купленные,
     * и некупленные: по нему идут по залу и отмечают на ходу. Фильтры
     * состояния при этом не применяются, иначе отмеченное исчезало бы
     * из-под пальца (п. 45).
     */
    if (activeList) {
      const inList = new Set(activeList.items.map((i) => i.productId));
      list = list.filter((p) => inList.has(p.id));
    } else {
      const kept = (p: Product) => justToggled.has(p.id);
      if (statusFilter === 'plan') list = list.filter((p) => needByProduct.has(p.id) || kept(p));
      if (statusFilter === 'to-buy') list = list.filter((p) => !p.in_stock || kept(p));
      if (statusFilter === 'in-stock') list = list.filter((p) => p.in_stock || kept(p));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [products, categoryFilter, statusFilter, searchResult, needByProduct, justToggled, activeList]);

  /** Сколько позиций списка уже куплено — для подписи и вопроса о закрытии. */
  const listDone = useMemo(() => {
    if (!activeList) return 0;
    const byId = new Map(products.map((p) => [p.id, p]));
    return activeList.items.filter((i) => byId.get(i.productId)?.in_stock).length;
  }, [activeList, products]);

  /*
   * Всё куплено — предлагаем закрыть поездку. Тостом, а не окном: закрывать
   * список необязательно, и перегораживать экран вопросом незачем.
   */
  const askedToClose = useRef<string | null>(null);
  useEffect(() => {
    if (!activeList || activeList.kind !== 'once') return;
    const total = activeList.items.length;
    if (total === 0 || listDone < total) return;
    if (askedToClose.current === activeList.id) return;
    askedToClose.current = activeList.id;
    toast.show(t('lists.once.allBought'), {
      key: 'list-done',
      action: { label: t('lists.once.close'), onClick: () => closeList(activeList) },
    });
    // closeList и toast намеренно не в зависимостях: они пересоздаются каждый
    // рендер, и эффект гонялся бы вхолостую при каждой перерисовке
  }, [activeList, listDone]);

  /*
   * Заголовки отделов показываем, только если они что-то дают:
   * - не при поиске — там ищут конкретный продукт;
   * - не на вкладке конкретной категории — заголовок повторял бы вкладку;
   * - только в фильтрах-списках покупок.
   */
  const groups = useMemo(() => {
    const grouped = !searching && categoryFilter === 'all'
      && (activeList !== null || GROUPED.has(statusFilter));
    return grouped ? groupByCategory(visible, categories) : null;
  }, [searching, categoryFilter, statusFilter, visible, categories, activeList]);

  /**
   * п. 41 · Выключенный продукт не держит прежнее количество.
   *
   * Количество у выключенной позиции быстро становится неактуальным:
   * в магазине человек смотрит «сколько брать» и видит цифру с прошлого раза
   * (фидбек Vadym 09-26). Поэтому выключение сбрасывает количество — но это
   * потеря данных от одного касания, поэтому рядом «Отменить».
   *
   * Отмена накапливает подряд выключенные позиции: тост один (по ключу),
   * и возвращает он всю серию, а не последнюю строку.
   */
  const resetBatch = useRef<Array<{ id: string; quantity: number }>>([]);
  const resetTimer = useRef<number | null>(null);

  const turnOffOne = (product: Product) => {
    bulkPatch.mutate({ ids: [product.id], patch: { in_stock: false, quantity: 0 } });
    resetBatch.current = [
      ...resetBatch.current.filter((e) => e.id !== product.id),
      { id: product.id, quantity: product.quantity },
    ];
    const batch = [...resetBatch.current];
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => { resetBatch.current = []; }, 5000);
    toast.show(
      batch.length === 1
        ? t('products.quantityReset', { name: product.name })
        : t('products.quantityResetMany', { count: batch.length }),
      {
        key: 'quantity-reset',
        action: { label: t('products.undo'), onClick: () => restoreQuantities(batch) },
      },
    );
  };

  /** Возврат после сброса: одинаковые количества — одним запросом. */
  const restoreQuantities = (batch: Array<{ id: string; quantity: number }>) => {
    const byQuantity = new Map<number, string[]>();
    for (const entry of batch) {
      byQuantity.set(entry.quantity, [...(byQuantity.get(entry.quantity) ?? []), entry.id]);
    }
    for (const [quantity, ids] of byQuantity) {
      bulkPatch.mutate({ ids, patch: { in_stock: true, quantity } });
    }
    resetBatch.current = [];
  };

  /**
   * п. 42 · «Актуализировать» список: выключить всё и пройтись заново.
   *
   * Область — то, что человек видит: отдел, если выбрана вкладка, найденное
   * при поиске, иначе вся кухня. Число и область стоят в подтверждении,
   * иначе «Выключить всё» на вкладке «Овощи» звучит как «во всей кухне».
   */
  const turnOffCandidates = useMemo(() => visible.filter((p) => p.in_stock), [visible]);
  const scopeLabel = searching
    ? t('products.scope.found')
    : categoryFilter === 'all'
      ? t('products.scope.all')
      : t('products.scope.category', {
        name: categoryLabel(
          'product',
          productCategories.find((c) => c.id === categoryFilter)?.key ?? null,
          productCategories.find((c) => c.id === categoryFilter)?.name ?? null,
        ),
      });

  const turnOffAll = () => {
    const batch = turnOffCandidates.map((p) => ({ id: p.id, quantity: p.quantity }));
    if (batch.length === 0) return;
    bulkPatch.mutate({ ids: batch.map((e) => e.id), patch: { in_stock: false, quantity: 0 } });
    // Снимок держим до следующего действия, а не пять секунд: человек уходит
    // проходить список и возвращается не сразу (обзор 09-26, риск по п. 42)
    resetBatch.current = batch;
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    toast.show(t('products.turnOffAllDone', { count: batch.length }), {
      key: 'quantity-reset',
      action: { label: t('products.undo'), onClick: () => restoreQuantities(batch) },
    });
  };

  const handleDelete = (product: Product) => {
    remove(product.id);
    toast.show(t('products.deleted', { name: product.name }), {
      action: { label: t('products.undo'), onClick: () => restore(product.id) },
    });
  };

  /** Заявки выбранного списка: «сколько взять», по продукту. */
  const listQuantities = useMemo(() => {
    if (!activeList) return null;
    return new Map(activeList.items.map((i) => [i.productId, i.quantity]));
  }, [activeList]);

  const renderRow = (product: Product) => (
    <ProductRow
      key={product.id}
      product={product}
      need={needByProduct.get(product.id)}
      /*
       * Внутри списка число у названия — заявка этой поездки, а не количество
       * продукта, и потребностей блюд не видно: быстрый закуп идёт без
       * планирования под блюда (решение Vadym 09-30, 10-01). Ползунок при
       * этом по-прежнему значит наличие: по списку идут и отмечают купленное,
       * из этого же считается «Куплено 3 из 5».
       */
      listQuantity={listQuantities?.get(product.id)}
      hideNeeds={activeList !== null}
      showImage={showImages}
      expanded={activeProductId === product.id}
      // Ползунок только отмечает наличие и панель не раскрывает — иначе в магазине
      // каждая отметка открывала бы панель (решение Vadym, backlog п. 12)
      onToggle={(next) => {
        // Включение — обычная отметка наличия; выключение сбрасывает
        // количество и предлагает «Отменить» (п. 41)
        if (next) toggleProduct(product.id, true);
        else if (product.quantity > 0) turnOffOne(product);
        else toggleProduct(product.id, false);
        remember(product.id);
      }}
      // Тап по строке открывает и закрывает панель у любого продукта
      onExpand={() => setActiveProduct(activeProductId === product.id ? null : product.id)}
      onQuantityChange={(q) => {
        if (activeList && listQuantities?.has(product.id)) {
          listActions.setQuantity.mutate({
            listId: activeList.id, productId: product.id, quantity: q,
          });
        } else {
          setQuantity(product.id, q);
        }
      }}
      onMenu={() => setMenuFor(product)}
    />
  );

  /** «Создать» по каждой ненайденной части, а не всей фразой (п. 21). */
  const renderCreateButtons = (names: string[]) => (
    <div className="flex flex-wrap justify-center gap-2">
      {names.map((name) => (
        <Button key={name} size="sm" {...tap(() => openAdd(capitalize(name)))}>
          {t('products.create', { name: capitalize(name) })}
        </Button>
      ))}
    </div>
  );

  /** Своё пустое состояние у каждого фильтра (backlog п. 13). */
  const renderEmpty = () => {
    // Список есть, а показывать нечего: его позиции удалили из кухни (п. 45)
    if (activeList) {
      return (
        <EmptyState
          icon={<ListChecks className="h-12 w-12" />}
          title={t('lists.emptyList')}
          description={t('lists.emptyListHint')}
          action={
            <Button onClick={() => { setEditorFor(activeList); setEditorOpen(true); }}>
              {t('lists.edit', { name: activeList.name })}
            </Button>
          }
        />
      );
    }
    if (searchResult) {
      return (
        <EmptyState
          icon={<SearchX className="h-12 w-12" />}
          title={t('products.notFound')}
          action={renderCreateButtons(searchResult.missing)}
        />
      );
    }
    // Приглашение добавить — только когда в кухне нет ни одного продукта (D-041)
    if (products.length === 0) {
      return (
        <EmptyState
          icon={<Sparkles className="h-12 w-12" />}
          title={t('products.nothingYet')}
          description={t('products.pickUsual')}
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => navigate('/products/quick-start')}>
                {t('products.quickStart')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openAdd()}>
                {t('products.firstProduct')}
              </Button>
            </div>
          }
        />
      );
    }
    if (statusFilter === 'plan') {
      return planned.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-12 w-12" />}
          title={t('products.plan.noDishes')}
          description={t('products.plan.noDishesHint')}
          action={
            <Button onClick={() => navigate('/dishes?select=1')}>
              {t('products.plan.pickDishes')}
            </Button>
          }
        />
      ) : (
        <EmptyState icon={<PartyPopper className="h-12 w-12" />} title={t('products.plan.allSet')} />
      );
    }
    if (statusFilter === 'to-buy') {
      return <EmptyState icon={<PartyPopper className="h-12 w-12" />} title={t('products.allSet')} />;
    }
    if (statusFilter === 'in-stock') {
      return <EmptyState icon={<PackageCheck className="h-12 w-12" />} title={t('products.inStock.empty')} />;
    }
    // «Все» при непустой кухне пуст только на вкладке категории без продуктов
    return (
      <EmptyState
        icon={<PackagePlus className="h-12 w-12" />}
        title={t('products.empty')}
        action={<Button onClick={() => openAdd()}>{t('common.add')}</Button>}
      />
    );
  };

  return (
    <div className="mx-auto max-w-[520px] px-3 pt-4">
      <header className="mb-3 flex items-center gap-2 px-0.5">
        <h1 className="text-title">{kitchen?.name ?? 'PantrySync'}</h1>

        {/* Несохранённое видно сразу: в магазине это важнее любой другой детали */}
        {pending > 0 ? (
          <span className="flex items-center gap-1 text-micro text-warning" title="Ждут отправки">
            <CloudOff className="h-3.5 w-3.5" />
            {pending}
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Всё сохранено" />
        )}

        {repo.isDemo && (
          <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-micro text-text-muted">
            демо
          </span>
        )}

        {/* Зона касания 44×44 при иконке 22px (backlog п. 16) */}
        <button
          type="button"
          onClick={() => setReceiptOpen(true)}
          aria-label="Импорт чека"
          className={
            'flex h-11 w-11 items-center justify-center rounded-full text-text-muted active:bg-surface '
            + (repo.isDemo ? '' : 'ml-auto')
          }
        >
          <Receipt className="h-[22px] w-[22px]" />
        </button>

      </header>

      {/* Разовый список — яркой полосой: её видно с любого экрана продуктов,
          и по ней можно вернуться к списку или закрыть поездку (п. 45) */}
      {onceList && (
        <div
          className="mb-3 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-accent-ink"
          aria-label={t('lists.once.aria', { name: onceList.name })}
        >
          <ShoppingBasket className="h-4 w-4 shrink-0" />
          {/* Список открыт — его название уже стоит в пилюле, и в полосе
              полезнее прогресс; свёрнут — название и как вернуться */}
          <span className="min-w-0 flex-1 truncate text-caption">
            {activeList?.id === onceList.id
              ? t('lists.progress', { done: listDone, total: onceList.items.length })
              : onceList.name}
          </span>
          {activeList?.id === onceList.id ? (
            <button
              type="button"
              onClick={() => closeList(onceList)}
              className="shrink-0 rounded-full bg-accent-ink/10 px-2.5 py-1 text-micro"
            >
              {t('lists.once.close')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setListFilter(onceList.id)}
              className="shrink-0 rounded-full bg-accent-ink/10 px-2.5 py-1 text-micro"
            >
              {t('lists.once.open')}
            </button>
          )}
        </div>
      )}

      <div className="mb-4">
        <SearchField value={search} onChange={setSearch} placeholder={t('products.search')} />
      </div>

      <div className="mb-4">
        <Tabs
          active={categoryFilter}
          onChange={setCategoryFilter}
          items={[
            { id: 'all', label: t('products.filter.all') },
            ...productCategories.map((c) => ({
              id: c.id,
              label: categoryLabel('product', c.key, c.name),
            })),
          ]}
        />
      </div>

      {/* «Все» первым, как у вкладок категорий выше (backlog п. 14) */}
      <div className="mb-4">
        <FilterPills
          // При активном списке ни один фильтр состояния не выбран: внутри
          // списка видны и купленные, и некупленные позиции (п. 45)
          active={activeList ? '' : statusFilter}
          onChange={(id) => setStatusFilter(id as Status)}
          items={[
            { id: 'all', label: t('products.filter.all') },
            { id: 'to-buy', label: t('products.filter.toBuy') },
            { id: 'plan', label: t('products.filter.plan') },
            { id: 'in-stock', label: t('products.filter.inStock') },
          ]}
          after={(
            /* Выбор списка покупок — та же пилюля, но со стрелкой: за ней
               не фильтр, а выбор из нескольких (п. 45) */
            <button
              ref={listPillRef}
              type="button"
              onClick={() => setListSheetOpen(true)}
              aria-haspopup="menu"
              aria-expanded={listSheetOpen}
              className={cn(
                'relative flex max-w-[48vw] shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-micro transition-colors',
                'before:absolute before:-inset-y-2 before:inset-x-0 before:content-[""]',
                activeList ? 'bg-accent text-accent-ink' : 'border border-[#242424] text-[#8A8A8A]',
              )}
            >
              {/* Длинное название обрезается, но стрелка видна всегда:
                  иначе непонятно, что за пилюлей выбор */}
              <span className="min-w-0 truncate">
                {activeList ? activeList.name : t('lists.pill')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
          pinned={(
            /* «Выключить всё» стояло в меню «⋯» в шапке: нажатие в правом
               верхнем углу, ответ снизу экрана — связи не видно. Теперь
               кнопка закреплена прямо над списком (п. 44, выбор Vadym) */
            <button
              type="button"
              onClick={() => {
                if (turnOffCandidates.length === 0) toast.show(t('products.turnOffAllEmpty'));
                else setConfirmTurnOff(true);
              }}
              aria-label={t('products.turnOffAll')}
              className="flex h-11 w-11 items-center justify-center rounded-full text-text-muted active:bg-surface"
            >
              {/* Ластик, а не кнопка выключения: действие читается как
                  «очистить», тот же значок стоит у «Очистить меню»
                  (замечание Vadym 09-30) */}
              <Eraser className="h-[19px] w-[19px]" />
            </button>
          )}
        />
        {activeList && activeList.id !== onceList?.id && (
          <p className="mt-2 px-0.5 text-micro text-text-dim">
            {t('lists.progress', { done: listDone, total: activeList.items.length })}
          </p>
        )}
      </div>

      <main className="pb-28">
        {isLoading && <p className="py-12 text-center text-caption text-text-muted">{t('common.loading')}</p>}

        {!isLoading && visible.length === 0 && renderEmpty()}

        {!groups && visible.map(renderRow)}

        {/* Нашлось не всё из сказанного — недостающее можно создать тут же */}
        {searchResult && visible.length > 0 && searchResult.missing.length > 0 && (
          <section className="mt-4 px-0.5">
            <h2 className="mb-2 text-micro text-text-dim">{t('products.notInList')}</h2>
            <div className="flex flex-wrap gap-2">
              {searchResult.missing.map((name) => (
                <Button key={name} size="sm" variant="ghost" {...tap(() => openAdd(capitalize(name)))}>
                  {t('products.create', { name: capitalize(name) })}
                </Button>
              ))}
            </div>
          </section>
        )}

        {groups?.map((group) => (
          <section key={group.categoryId ?? 'none'} className="mb-4">
            <h2 className="mb-2 px-0.5 text-micro text-text-dim">{group.title}</h2>
            {group.products.map(renderRow)}
          </section>
        ))}
      </main>

      {/* «+» — оба пути добавления в одном месте (backlog п. 2, решение Vadym) */}
      <BottomNav onAdd={() => setAddMenuOpen(true)} />

      <ActionSheet
        open={addMenuOpen}
        title={t('common.add')}
        onClose={() => setAddMenuOpen(false)}
        actions={[
          { label: t('products.addFromList'), Icon: ListChecks, onClick: () => navigate('/products/quick-start') },
          { label: t('products.addOwn'), Icon: PackagePlus, onClick: () => openAdd() },
          // Создание списка искать логичнее там, где вообще добавляют
          // (предложение Vadym 09-30). В панели списков пункт тоже остался
          { label: t('lists.create'), Icon: ListPlus, onClick: () => { setEditorFor(null); setEditorOpen(true); } },
        ]}
      />

      {receiptOpen && (
        <Suspense fallback={null}>
          <ReceiptImport kitchenId={kitchenId} onClose={() => setReceiptOpen(false)} />
        </Suspense>
      )}

      <AddProductModal
        kitchenId={kitchenId}
        open={addOpen}
        initialName={addName}
        existingNames={products.map((p) => p.name)}
        onClose={() => setAddOpen(false)}
      />

      <AddProductModal
        kitchenId={kitchenId}
        open={editFor !== null}
        product={editFor}
        existingNames={products.map((p) => p.name)}
        onClose={() => setEditFor(null)}
      />

      <ActionSheet
        open={confirmTurnOff}
        title={t('products.turnOffAllConfirm', {
          count: turnOffCandidates.length,
          noun: plural(turnOffCandidates.length, 'продукт', 'продукта', 'продуктов'),
          scope: scopeLabel,
        })}
        note={t('products.turnOffAllNote')}
        onClose={() => setConfirmTurnOff(false)}
        actions={[{
          label: t('products.turnOffAll'),
          Icon: Eraser,
          danger: true,
          onClick: turnOffAll,
        }]}
      />

      {/* Выбор списка покупок. Дропдаун сделан листом снизу: до верхнего
          края экрана большим пальцем не дотянуться, а остальные меню
          приложения открываются так же (п. 45) */}
      <ActionSheet
        open={listSheetOpen}
        title={t('lists.sheetTitle')}
        note={lists.length > 0 ? t('lists.sheetHint') : t('lists.empty')}
        onClose={() => setListSheetOpen(false)}
        actions={[
          ...(activeList ? [{
            label: t('lists.allProducts'),
            Icon: PackageCheck,
            onClick: () => setListFilter(null),
          }] : []),
          ...lists.map((list) => ({
            label: `${list.name} · ${t('lists.itemsCount', {
              count: list.items.length,
              noun: plural(list.items.length, 'позиция', 'позиции', 'позиций'),
            })}`,
            Icon: list.kind === 'once' ? ShoppingBasket : ListChecks,
            onClick: () => setListFilter(list.id),
          })),
          ...(activeList ? [{
            label: t('lists.edit', { name: activeList.name }),
            Icon: Pencil,
            onClick: () => { setEditorFor(activeList); setEditorOpen(true); },
          }] : []),
          {
            label: t('lists.create'),
            Icon: ListPlus,
            onClick: () => { setEditorFor(null); setEditorOpen(true); },
          },
        ]}
      />

      <ListEditor
        kitchenId={kitchenId}
        open={editorOpen}
        list={editorFor}
        onClose={() => setEditorOpen(false)}
        onSaved={(id) => setListFilter(id || null)}
      />

      <ActionSheet
        open={menuFor !== null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? [
          { label: t('products.edit'), Icon: Pencil, onClick: () => setEditFor(menuFor) },
          { label: t('common.delete'), Icon: Trash2, danger: true, onClick: () => handleDelete(menuFor) },
        ] : []}
      />
    </div>
  );
}
