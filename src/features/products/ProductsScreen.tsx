import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloudOff, ListChecks, PackageCheck, PackagePlus, PartyPopper, Pencil, Receipt, SearchX,
  Sparkles, Trash2, UtensilsCrossed,
} from 'lucide-react';
import {
  ActionSheet, BottomNav, Button, EmptyState, FilterPills, ProductRow, SearchField, Tabs,
  useToast, type PlanNeed,
} from '@/shared/ui';
import { repo } from '@/shared/api';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import {
  useCategories, useDeleteProduct, usePendingCount, useProducts, useProductsRealtime,
  useQueueFlusher, useSetQuantity, useToggleProduct,
} from '@/shared/hooks/useProducts';
import { usePlanNeeds, usePlanned } from '@/shared/hooks/useDishes';
import { useUI } from '@/shared/store/ui';
import { searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { categoryLabel, t } from '@/shared/lib/i18n';
import { groupByCategory } from './grouping';
import { AddProductModal } from './AddProductModal';
import { ReceiptImport } from './ReceiptImport';
import type { Product } from '@/shared/db/types';

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

  const toggleProduct = useToggleProduct(kitchenId);
  const setQuantity = useSetQuantity(kitchenId);
  const { remove, restore } = useDeleteProduct(kitchenId);

  const [addOpen, setAddOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Product | null>(null);
  const [editFor, setEditFor] = useState<Product | null>(null);

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

  const visible = useMemo(() => {
    let list = products;
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    const kept = (p: Product) => justToggled.has(p.id);
    if (statusFilter === 'plan') list = list.filter((p) => needByProduct.has(p.id) || kept(p));
    if (statusFilter === 'to-buy') list = list.filter((p) => !p.in_stock || kept(p));
    if (statusFilter === 'in-stock') list = list.filter((p) => p.in_stock || kept(p));
    if (searching) return searchByName(list, search);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [products, categoryFilter, statusFilter, search, searching, needByProduct, justToggled]);

  /*
   * Заголовки отделов показываем, только если они что-то дают:
   * - не при поиске — там ищут конкретный продукт;
   * - не на вкладке конкретной категории — заголовок повторял бы вкладку;
   * - только в фильтрах-списках покупок.
   */
  const groups = useMemo(() => {
    const grouped = !searching && categoryFilter === 'all' && GROUPED.has(statusFilter);
    return grouped ? groupByCategory(visible, categories) : null;
  }, [searching, categoryFilter, statusFilter, visible, categories]);

  const handleDelete = (product: Product) => {
    remove(product.id);
    toast.show(t('products.deleted', { name: product.name }), {
      action: { label: t('products.undo'), onClick: () => restore(product.id) },
    });
  };

  const renderRow = (product: Product) => (
    <ProductRow
      key={product.id}
      product={product}
      need={needByProduct.get(product.id)}
      showImage={showImages}
      expanded={activeProductId === product.id}
      // Ползунок только отмечает наличие и панель не раскрывает — иначе в магазине
      // каждая отметка открывала бы панель (решение Vadym, backlog п. 12)
      onToggle={(next) => {
        toggleProduct(product.id, next);
        remember(product.id);
      }}
      // Тап по строке открывает и закрывает панель у любого продукта
      onExpand={() => setActiveProduct(activeProductId === product.id ? null : product.id)}
      onQuantityChange={(q) => setQuantity(product.id, q)}
      onMenu={() => setMenuFor(product)}
    />
  );

  /** Своё пустое состояние у каждого фильтра (backlog п. 13). */
  const renderEmpty = () => {
    if (searching) {
      return (
        <EmptyState
          icon={<SearchX className="h-12 w-12" />}
          title={t('products.notFound')}
          action={
            <Button onClick={() => setAddOpen(true)}>
              {t('products.create', { name: search.trim() })}
            </Button>
          }
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
              <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
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
        action={<Button onClick={() => setAddOpen(true)}>{t('common.add')}</Button>}
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
          active={statusFilter}
          onChange={(id) => setStatusFilter(id as Status)}
          items={[
            { id: 'all', label: t('products.filter.all') },
            { id: 'to-buy', label: t('products.filter.toBuy') },
            { id: 'plan', label: t('products.filter.plan') },
            { id: 'in-stock', label: t('products.filter.inStock') },
          ]}
        />
      </div>

      <main className="pb-28">
        {isLoading && <p className="py-12 text-center text-caption text-text-muted">{t('common.loading')}</p>}

        {!isLoading && visible.length === 0 && renderEmpty()}

        {!groups && visible.map(renderRow)}

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
          { label: t('products.addOwn'), Icon: PackagePlus, onClick: () => setAddOpen(true) },
        ]}
      />

      {receiptOpen && (
        <ReceiptImport kitchenId={kitchenId} onClose={() => setReceiptOpen(false)} />
      )}

      <AddProductModal
        kitchenId={kitchenId}
        open={addOpen}
        initialName={searching ? search.trim() : ''}
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
