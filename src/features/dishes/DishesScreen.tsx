import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Soup, Salad, EggFried, CakeSlice, UtensilsCrossed, LayoutGrid, GalleryHorizontalEnd } from 'lucide-react';
import { Button, DishTile, EmptyState, SearchField, Tabs, useToast } from '@/shared/ui';
import { useCurrentKitchen } from '@/shared/hooks/useKitchens';
import { useDishes, usePlanActions } from '@/shared/hooks/useDishes';
import { useCategories } from '@/shared/hooks/useProducts';
import { searchByName } from '@/shared/lib/text';
import { categoryLabel, t } from '@/shared/lib/i18n';
import { DishDetail } from './DishDetail';
import type { DishWithStatus } from '@/shared/api/repo';

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

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DishWithStatus | null>(null);
  const [selecting, setSelecting] = useState(false);

  const dishCategories = useMemo(() => categories.filter((c) => c.kind === 'dish'), [categories]);
  const readyCount = dishes.filter((d) => d.missingCount === 0).length;
  const plannedCount = dishes.filter((d) => d.isPlanned).length;

  const iconFor = (dish: DishWithStatus) => {
    const category = dishCategories.find((c) => c.id === dish.category_id);
    return (category?.key && CATEGORY_ICON[category.key]) ?? undefined;
  };

  const visible = useMemo(() => {
    let list = dishes;
    if (tab === 'ready') list = list.filter((d) => d.missingCount === 0);
    else if (tab === 'fav') list = list.filter((d) => d.isFavorite);
    else if (tab !== 'all') list = list.filter((d) => d.category_id === tab);
    return searchByName(list, search);
  }, [dishes, tab, search]);

  const togglePlan = (dish: DishWithStatus) => {
    if (dish.isPlanned) remove.mutate(dish.id);
    else add.mutate(dish.id);
  };

  return (
    <div className="mx-auto max-w-[520px] px-3 pt-4">
      <header className="mb-4 flex items-center justify-between px-0.5">
        <h1 className="text-title">{t('dishes.title')}</h1>
        {selecting ? (
          <div className="flex items-center gap-1 rounded-full bg-surface p-0.5">
            <span className="flex h-6 w-8 items-center justify-center rounded-full bg-accent">
              <LayoutGrid className="h-4 w-4 text-accent-ink" />
            </span>
            <button
              type="button"
              aria-label="Карусель"
              onClick={() => navigate('/today/choose')}
              className="flex h-6 w-8 items-center justify-center rounded-full text-text-dim"
            >
              <GalleryHorizontalEnd className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setSelecting(true)}>{t('dishes.cook')}</Button>
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
            { id: 'ready', label: `${t('dishes.ready')} ${readyCount}` },
            { id: 'fav', label: t('dishes.favorites') },
            ...dishCategories.map((c) => ({ id: c.id, label: categoryLabel('dish', c.key, c.name) })),
          ]}
        />
      </div>

      <main className="pb-28">
        {isLoading && <p className="py-12 text-center text-caption text-text-muted">{t('common.loading')}</p>}

        {!isLoading && visible.length === 0 && (
          <EmptyState icon={<UtensilsCrossed className="h-12 w-12" />} title={t('dishes.empty')} />
        )}

        <div className="columns-2 gap-1.5">
          {visible.map((dish) => (
            <DishTile
              key={dish.id}
              selectable={selecting}
              selected={dish.isPlanned}
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
          <Button onClick={() => setSelecting(false)}>
            {t('dishes.planned', { count: plannedCount })}
          </Button>
        </div>
      )}

      {detail && (
        <DishDetail
          dish={detail}
          onClose={() => setDetail(null)}
          onToggleFavorite={() => favorite.mutate({ id: detail.id, next: !detail.isFavorite })}
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
