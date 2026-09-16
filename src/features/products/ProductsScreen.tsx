import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, PartyPopper, PackagePlus, SearchX, Receipt, CloudOff } from 'lucide-react';
import {
  ActionSheet, Button, EmptyState, FilterPills, ProductRow, SearchField, Tabs, useToast,
  type PlanNeed,
} from '@/shared/ui';
import { repo } from '@/shared/api';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import {
  useCategories, useDeleteProduct, usePendingCount, useProducts, useQueueFlusher,
  useRenameProduct, useSetQuantity, useToggleProduct,
} from '@/shared/hooks/useProducts';
import { usePlanNeeds } from '@/shared/hooks/useDishes';
import { useUI } from '@/shared/store/ui';
import { searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { categoryLabel, t } from '@/shared/lib/i18n';
import { groupByCategory } from './grouping';
import { AddProductModal } from './AddProductModal';
import { ReceiptImport } from './ReceiptImport';
import { RenameProductModal } from './RenameProductModal';
import type { Product } from '@/shared/db/types';

type Status = 'plan' | 'to-buy' | 'in-stock' | 'all';

export function ProductsScreen() {
  const kitchen = useCurrentKitchen();
  const kitchenId = kitchen?.id ?? '';
  const toast = useToast();

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

  const toggleProduct = useToggleProduct(kitchenId);
  const setQuantity = useSetQuantity(kitchenId);
  const renameProduct = useRenameProduct(kitchenId);
  const { remove, restore } = useDeleteProduct(kitchenId);

  const [addOpen, setAddOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useQueueFlusher(kitchenId);
  const pending = usePendingCount();
  const [menuFor, setMenuFor] = useState<Product | null>(null);
  const [renameFor, setRenameFor] = useState<Product | null>(null);

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
    return searchByName(list, search);
  }, [products, categoryFilter, statusFilter, search, needByProduct, justToggled]);

  // При поиске группировка мешает: ищут конкретный продукт, а не изучают список
  const groups = useMemo(
    () => (searching ? null : groupByCategory(visible, categories)),
    [searching, visible, categories],
  );

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
      onToggle={(next) => {
        toggleProduct(product.id, next);
        remember(product.id);
        setActiveProduct(next ? product.id : null);
      }}
      onExpand={() => {
        if (!product.in_stock) {
          // Тап по строке включает продукт: попасть в ползунок на ходу трудно
          toggleProduct(product.id, true);
          remember(product.id);
          setActiveProduct(product.id);
          return;
        }
        setActiveProduct(activeProductId === product.id ? null : product.id);
      }}
      onQuantityChange={(q) => setQuantity(product.id, q)}
      onMenu={() => setMenuFor(product)}
    />
  );

  return (
    <div className="mx-auto max-w-[520px] px-3 pt-4">
      <header className="mb-4 flex items-center gap-2 px-0.5">
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

        <button
          type="button"
          onClick={() => setReceiptOpen(true)}
          aria-label="Импорт чека"
          className="ml-auto text-text-dim"
        >
          <Receipt className="h-[18px] w-[18px]" />
        </button>

        {repo.isDemo && (
          <span className="rounded-full bg-surface px-2 py-0.5 text-micro text-text-muted">
            демо
          </span>
        )}
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

      <div className="mb-4">
        <FilterPills
          active={statusFilter}
          onChange={(id) => setStatusFilter(id as Status)}
          items={[
            { id: 'plan', label: t('products.filter.plan') },
            { id: 'to-buy', label: t('products.filter.toBuy') },
            { id: 'in-stock', label: t('products.filter.inStock') },
            { id: 'all', label: t('products.filter.all') },
          ]}
        />
      </div>

      <main className="pb-28">
        {isLoading && <p className="py-12 text-center text-caption text-text-muted">{t('common.loading')}</p>}

        {!isLoading && visible.length === 0 && (
          searching ? (
            <EmptyState
              icon={<SearchX className="h-12 w-12" />}
              title={t('products.notFound')}
              action={
                <Button onClick={() => setAddOpen(true)}>
                  {t('products.create', { name: search.trim() })}
                </Button>
              }
            />
          ) : statusFilter === 'to-buy' ? (
            <EmptyState icon={<PartyPopper className="h-12 w-12" />} title={t('products.allSet')} />
          ) : (
            <EmptyState
              icon={<PackagePlus className="h-12 w-12" />}
              title={t('products.empty')}
              action={<Button onClick={() => setAddOpen(true)}>{t('common.add')}</Button>}
            />
          )
        )}

        {searching && visible.map(renderRow)}

        {!searching && groups?.map((group) => (
          <section key={group.categoryId ?? 'none'} className="mb-4">
            <h2 className="mb-2 px-0.5 text-micro text-text-dim">{group.title}</h2>
            {group.products.map(renderRow)}
          </section>
        ))}
      </main>

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

      <ActionSheet
        open={menuFor !== null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? [
          { label: 'Переименовать', Icon: Pencil, onClick: () => setRenameFor(menuFor) },
          { label: t('common.delete'), Icon: Trash2, danger: true, onClick: () => handleDelete(menuFor) },
        ] : []}
      />

      {renameFor && (
        <RenameProductModal
          open
          currentName={renameFor.name}
          onSave={(name) => renameProduct(renameFor.id, name)}
          onClose={() => setRenameFor(null)}
        />
      )}
    </div>
  );
}
