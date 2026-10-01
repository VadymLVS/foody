import { useEffect, useMemo, useState } from 'react';
import { Eraser, Search } from 'lucide-react';
import { Button, Modal, useToast } from '@/shared/ui';
import { ProductRow } from '@/shared/ui/ProductRow';
import { useCategories, useProducts } from '@/shared/hooks/useProducts';
import { searchByName, SEARCH_MIN_LENGTH } from '@/shared/lib/text';
import { t } from '@/shared/lib/i18n';
import type { ProductListItem } from '@/shared/api/repo';
import { groupByCategory } from './grouping';

interface Props {
  kitchenId: string;
  open: boolean;
  items: ProductListItem[];
  onChange: (next: ProductListItem[]) => void;
  onClose: () => void;
}

/**
 * Сборка состава списка по всей кухне (backlog п. 46).
 *
 * Зачем это вместо кнопки «Взять из «Купить»». Раньше состав собирался поиском
 * по одной позиции или кнопкой «взять всё, что сейчас в «Купить»». Vadym
 * показал, почему этого мало: «Купить» — производная от отметок наличия, а
 * отметки отстают от жизни. Молоко закончилось, ползунок никто не переключил —
 * и в «Купить» его нет. Человек не догадается искать то, чего, по мнению
 * приложения, у него хватает. Поэтому основа для сборки — вся кухня по отделам,
 * ровно как в самом списке продуктов, и решение принимает человек, а не отметка.
 *
 * Ползунок здесь значит «берём», а не «есть дома». Тот же орган управления
 * с другим смыслом — известный риск (мы уже обжигались на U-2), и я предлагал
 * заменить его на плюс. Решение Vadym (10-01): оставить ползунок, потому что
 * жест уже привычен; если логика будет ломать голову в деле — заменим.
 * Чтобы смысл читался, над списком стоит подпись «Отмечено · N».
 *
 * Количество — та же панель, что раскрывается в обычной строке продукта.
 * Своего органа управления для этого не придумываем (замечание Vadym 10-01);
 * меняется только подпись, потому что число отвечает на другой вопрос.
 * Подтверждать ничего не надо: правки живут в составе формы сразу.
 *
 * Чего здесь нет намеренно: потребностей блюд (быстрый закуп идёт без
 * планирования), лаймовой грани слева (она означает «нужно для блюда»)
 * и подсказки «этого нет дома» — решение Vadym: не показывать, чтобы
 * приложение не подменяло решение человека.
 */
export function ListCollect({ kitchenId, open, items, onChange, onClose }: Props) {
  const { data: products = [] } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  /**
   * Состав на момент открытия экрана: по нему работает «Отмена».
   *
   * Отменяется именно этот заход, а не весь состав: человек открыл сборку,
   * натыкал лишнего и хочет вернуться к тому, что было, — а не очистить
   * список (п. 48).
   */
  const [opened, setOpened] = useState<ProductListItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setExpandedId(null);
    setConfirmClear(false);
    setOpened(items.map((i) => ({ ...i })));
    // items в зависимостях стоять не должен: он меняется на каждой отметке,
    // и снимок «как было при открытии» переписывался бы под руками (D-092)
  }, [open]);

  const picked = useMemo(() => new Map(items.map((i) => [i.productId, i.quantity])), [items]);

  const q = query.trim();
  const searching = q.length >= SEARCH_MIN_LENGTH;
  const visible = useMemo(
    () => (searching ? searchByName(products, q) : products),
    [products, q, searching],
  );

  // При поиске отделы не показываются: в найденном их всё равно один-два,
  // и заголовки только съедают место (так же, как в списке продуктов)
  const groups = useMemo(
    () => (searching ? [] : groupByCategory(visible, categories)),
    [searching, visible, categories],
  );

  /*
   * Новая позиция запоминает, было ли наличие дома на момент внесения
   * (п. 49): по этому значению снятие отметки «куплено» потом возвращает
   * наличие как было до поездки.
   */
  const fresh = (productId: string, quantity: number): ProductListItem => ({
    productId,
    quantity,
    bought: false,
    stockBefore: products.find((p) => p.id === productId)?.in_stock ?? false,
  });

  const toggle = (productId: string, next: boolean) => {
    if (next) {
      if (picked.has(productId)) return;
      onChange([...items, fresh(productId, 0)]);
    } else {
      onChange(items.filter((i) => i.productId !== productId));
      setExpandedId((id) => (id === productId ? null : id));
    }
  };

  /*
   * Количество ставится только у того, что в списке. Иначе «2 кг» повисало бы
   * у позиции, которую не берут, и при следующем включении всплывало бы
   * неизвестно откуда. Поэтому смена количества у неотмеченного продукта
   * его же и отмечает.
   */
  const setQuantity = (productId: string, quantity: number) => {
    if (picked.has(productId)) {
      onChange(items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
    } else {
      onChange([...items, fresh(productId, quantity)]);
    }
  };

  /*
   * «Очистить список» снимает всё полностью — и отметки, и количества
   * (решение Vadym 10-01: «очистить все, полностью»). Половинчатая очистка,
   * которая оставляет количества у снятых позиций, потом вернулась бы
   * сюрпризом.
   *
   * От пяти позиций сначала спрашиваем (решение Vadym 10-01). Причина: «Отменить»
   * в тосте живёт, только пока открыта сборка. Закрыл её и сохранил форму —
   * и набранное потеряно без возврата. На одну-четыре позиции вопрос был бы
   * лишним шумом, на десять — единственная защита.
   */
  const CONFIRM_FROM = 5;

  const clear = () => {
    if (items.length === 0) {
      toast.show(t('lists.collect.alreadyEmpty'));
      return;
    }
    if (items.length >= CONFIRM_FROM && !confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    const snapshot = items.map((i) => ({ ...i }));
    onChange([]);
    setExpandedId(null);
    toast.show(t('lists.collect.cleared', { count: snapshot.length }), {
      action: { label: t('common.undo'), onClick: () => onChange(snapshot) },
    });
  };

  const row = (productId: string) => {
    const product = visible.find((p) => p.id === productId);
    if (!product) return null;
    return (
      <ProductRow
        key={product.id}
        product={product}
        listQuantity={picked.get(product.id) ?? 0}
        hideNeeds
        checked={picked.has(product.id)}
        toggleLabel="берём"
        hideMenu
        showImage={false}
        expanded={expandedId === product.id}
        onToggle={(next) => toggle(product.id, next)}
        onExpand={() => setExpandedId((id) => (id === product.id ? null : product.id))}
        onQuantityChange={(next) => setQuantity(product.id, next)}
        onMenu={() => { /* меню продукта в сборке списка не нужно */ }}
      />
    );
  };

  return (
    <Modal
      open={open}
      title={t('lists.collect.title')}
      onClose={onClose}
      tall
      autoFocus={false}
      /*
       * Без кнопок внизу экран был тупиком: «не понятно что делать после
       * выбора» (Vadym, 10-01). Я убрал их заодно со ссылкой «Готово» из
       * панели количества, хотя там это было правильно (подтверждать правку
       * одного числа нечего), а для экрана целиком — нет: человек отмечает
       * десяток позиций, это работа, и у работы должен быть видимый конец.
       *
       * «Сохранить» здесь не пишем намеренно: список создаёт кнопка формы,
       * и два «Сохранить» подряд путали бы (решение Vadym 10-01).
       */
      footer={(
        <>
          <Button variant="secondary" fullWidth onClick={() => { onChange(opened); onClose(); }}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth onClick={onClose}>
            {t('lists.collect.done', { count: items.length })}
          </Button>
        </>
      )}
    >
      {/* Шапка и поиск липнут к верху: по списку из сотни позиций прокрутка
          длинная, а «Очистить» и поиск нужны с любого места. Отступы здесь
          плотные намеренно — рабочей зоны должно быть видно как можно больше
          (замечание Vadym 09-30) */}
      <div className="sticky top-0 z-[5] -mx-4 -mt-1 bg-surface px-4">
        <div className="flex items-center justify-between">
          <span className="text-micro text-text-muted">
            {t('lists.collect.picked', { count: items.length })}
          </span>
          <button
            type="button"
            onClick={clear}
            className="-mr-2 flex h-11 items-center gap-1.5 px-2 text-caption text-text-muted"
          >
            <Eraser className="h-4 w-4" />
            {t('lists.collect.clear')}
          </button>
        </div>

        {/* Вопрос стоит прямо под кнопкой, которая его вызвала, а не листом
            снизу: лист поверх открытого экрана сборки — это два слоя модалок,
            и человек теряет, к чему относится вопрос */}
        {confirmClear && (
          <div className="mb-2 rounded-sm bg-surface-2 p-3">
            <p className="mb-2.5 text-caption text-text-primary">
              {t('lists.collect.clearConfirm', { count: items.length })}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setConfirmClear(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" fullWidth onClick={clear}>
                {t('lists.collect.clear')}
              </Button>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 border-b border-line">
          <Search className="h-4 w-4 shrink-0 text-text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lists.editor.search')}
            // 16 px: на iPhone поле с меньшим кеглем увеличивает всю страницу
            // при фокусе (находка Vadym 09-30)
            className="h-11 w-full min-w-0 bg-transparent text-field text-text-primary outline-none placeholder:text-text-dim"
          />
        </label>
      </div>

      {products.length === 0 && (
        <p className="text-caption text-text-dim">{t('lists.collect.noProducts')}</p>
      )}

      {searching && (
        visible.length === 0
          ? <p className="text-caption text-text-dim">{t('products.notFound')}</p>
          : <div>{visible.map((p) => row(p.id))}</div>
      )}

      {!searching && groups.map((group) => (
        <div key={group.categoryId ?? 'none'}>
          <p className="mb-1.5 text-micro text-text-dim">{group.title}</p>
          {group.products.map((p) => row(p.id))}
        </div>
      ))}
    </Modal>
  );
}
