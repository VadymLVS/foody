import { useEffect, useMemo, useState } from 'react';
import { ListChecks, Trash2, X } from 'lucide-react';
import { Button, Input, Modal, useToast } from '@/shared/ui';
import { useProducts } from '@/shared/hooks/useProducts';
import {
  useActiveOnceList, useProductListActions, useProductLists,
} from '@/shared/hooks/useProductLists';
import { t, unitLabel } from '@/shared/lib/i18n';
import { formatNumber } from '@/shared/lib/text';
import { cn } from '@/shared/lib/cn';
import type { ProductList, ProductListItem } from '@/shared/api/repo';
import type { Product } from '@/shared/db/types';
import { ProductPicker } from './ProductPicker';
import { ListCollect } from './ListCollect';

interface Props {
  kitchenId: string;
  open: boolean;
  /** Правка существующего списка; без него — создание нового. */
  list?: ProductList | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

/**
 * Создание и правка списка покупок (backlog п. 45, 46, 47).
 *
 * Порядок полей — выбор вида, потом всё остальное (замечание Vadym 09-30).
 * Сначала форма открывалась с названием сверху и ставила в него фокус, вытаскивая
 * клавиатуру. Но первое решение человека другое: это разовая поездка или
 * постоянная заготовка. У разового списка названия нет вовсе — он один, живёт
 * до конца поездки и подписан «Купить сейчас» сам собой; название появляется
 * только у постоянного. По умолчанию выбран разовый: так чаще.
 *
 * Фокус ставится на поиск продукта, а не на название: выбор вида делается
 * пальцем, а вводить сразу хочется позицию.
 *
 * Панель во всю высоту (`tall`): короткая форма прижималась к низу экрана,
 * и рабочей зоны было почти не видно.
 *
 * Состав хранится идентификаторами с заявками, а не объектами продуктов
 * (правка 09-30, D-092). Сначала он хранился объектами и наполнялся эффектом,
 * у которого в зависимостях стоял список продуктов кухни. Любое обновление
 * этого списка — а оно случается на каждом созданном из формы продукте и на
 * каждой отметке Алины — перезапускало эффект и обнуляло форму. Теперь форма
 * наполняется ровно один раз на открытие, а имена подставляются при отрисовке.
 */
export function ListEditor({ kitchenId, open, list, onClose, onSaved }: Props) {
  const { data: products = [] } = useProducts(kitchenId);
  const { data: lists = [] } = useProductLists(kitchenId);
  const activeOnce = useActiveOnceList(lists);
  const { save, remove, close } = useProductListActions(kitchenId);
  const toast = useToast();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'regular' | 'once'>('once');
  const [items, setItems] = useState<ProductListItem[]>([]);
  /** Созданные прямо из формы: в общем списке продуктов они появятся не сразу. */
  const [fresh, setFresh] = useState<Product[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  /** Уже есть открытый разовый список: спрашиваем, закрывать ли его. */
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Форма наполняется только на открытие. Список продуктов в зависимостях
  // стоять не должен — см. пояснение в шапке файла.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setConfirmReplace(false);
    setCollectOpen(false);
    setFresh([]);
    if (list) {
      setName(list.name);
      setKind(list.kind);
      setItems(list.items.map((i) => ({ ...i })));
    } else {
      setName(t('lists.defaultName.regular'));
      setKind('once');
      setItems([]);
    }
  }, [open, list?.id]);

  /** Имя по идентификатору: из кухни, а для только что созданных — из формы. */
  const byId = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    for (const p of fresh) if (!map.has(p.id)) map.set(p.id, p);
    return map;
  }, [products, fresh]);

  const pickedIds = useMemo(() => items.map((i) => i.productId), [items]);

  /*
   * Название разового списка всегда «Купить сейчас» (решение Vadym 09-30),
   * поэтому поля для него нет и трогать его нельзя. У постоянного название
   * подставлено сразу: раньше форма открывалась с пустым, «Сохранить» из-за
   * этого был неактивен, и почему — нигде не сказано.
   */
  const finalName = kind === 'once' ? t('lists.defaultName.once') : name.trim();

  const add = (product: Product) => {
    setFresh((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
    setItems((prev) => (prev.some((i) => i.productId === product.id)
      ? prev
      : [...prev, { productId: product.id, quantity: 0 }]));
  };

  const commit = () => {
    save.mutate(
      { input: { name: finalName, kind, items }, id: list?.id },
      {
        onSuccess: (id) => {
          onSaved(id);
          onClose();
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : t('common.error'), { tone: 'danger' }),
      },
    );
  };

  /*
   * Разовый список только один за раз (решение Vadym 09-30: «Прошлый
   * закрываем, создаём новый»). Запрет с подсказкой был бы тупиком: человек
   * уже собрал состав, и ему пришлось бы всё бросить, закрыть прежний список
   * и набрать заново. Поэтому спрашиваем и закрываем сами.
   */
  const submit = () => {
    const replacing = kind === 'once' && activeOnce !== null && activeOnce.id !== list?.id;
    if (replacing && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    if (replacing && activeOnce) {
      close.mutate(activeOnce.id, {
        onSuccess: commit,
        onError: (e) => toast.show(e instanceof Error ? e.message : t('common.error'), { tone: 'danger' }),
      });
      return;
    }
    commit();
  };

  const kindButton = (value: 'regular' | 'once', label: string, hint: string) => (
    <button
      type="button"
      onClick={() => { setKind(value); setConfirmReplace(false); }}
      aria-pressed={kind === value}
      className={cn(
        'flex-1 rounded-sm border px-3 py-2 text-left',
        kind === value ? 'border-accent bg-accent/10' : 'border-line',
      )}
    >
      <span className={cn('block text-body', kind === value && 'text-accent')}>{label}</span>
      <span className="mt-0.5 block text-micro text-text-dim">{hint}</span>
    </button>
  );

  return (
    <>
      <Modal
        open={open && !collectOpen}
        title={list ? t('lists.editor.editTitle') : t('lists.editor.newTitle')}
        onClose={onClose}
        tall
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              fullWidth
              disabled={!finalName || items.length === 0}
              loading={save.isPending || close.isPending}
              onClick={submit}
            >
              {confirmReplace ? t('lists.replaceOnce.confirm') : t('common.save')}
            </Button>
          </>
        }
      >
        {/* Вид списка — первое решение, поэтому он первый */}
        <div className="flex gap-2">
          {kindButton('once', t('lists.kind.once'), t('lists.kind.onceHint'))}
          {kindButton('regular', t('lists.kind.regular'), t('lists.kind.regularHint'))}
        </div>

        {kind === 'regular' && (
          <div>
            <span className="mb-1.5 block text-micro text-text-muted">{t('lists.editor.name')}</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('lists.editor.namePlaceholder')}
            />
          </div>
        )}

        {/* Поиск стоит выше списка позиций: снизу его подсказки закрывали
            кнопки формы, и не было видно, что нашлось (замечание Vadym 09-30) */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-micro text-text-muted">{t('lists.editor.add')}</span>
            <button
              type="button"
              onClick={() => setCollectOpen(true)}
              className="flex h-8 items-center gap-1.5 text-caption text-accent"
            >
              <ListChecks className="h-4 w-4" />
              {t('lists.editor.openProducts')}
            </button>
          </div>
          <ProductPicker
            kitchenId={kitchenId}
            pickedIds={pickedIds}
            placeholder={t('lists.editor.search')}
            onPick={add}
            onError={(message) => toast.show(message, { tone: 'danger' })}
            autoFocus
          />
        </div>

        <div>
          <span className="mb-1 block text-micro text-text-muted">
            {t('lists.editor.items', { count: items.length })}
          </span>

          {items.length === 0 && (
            <p className="mb-2 text-caption text-text-dim">{t('lists.editor.empty')}</p>
          )}

          {items.map((item) => {
            const product = byId.get(item.productId);
            return (
              <div key={item.productId} className="flex h-11 items-center gap-2 border-b border-line">
                <span className="min-w-0 flex-1 truncate text-body">
                  {product?.name ?? '…'}
                  {/* Заявка показывается лаймом — как у потребностей блюд (просьба Vadym) */}
                  {item.quantity > 0 && product && (
                    <span className="ml-1.5 text-micro text-accent">
                      {formatNumber(item.quantity)} {unitLabel(product.unit)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((i) => i.productId !== item.productId))}
                  aria-label={t('lists.editor.removeItem', { name: product?.name ?? '' })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Неактивная кнопка без объяснения — тупик: говорим, чего не хватает,
            и говорим рядом с кнопками, куда человек смотрит последним */}
        {(!finalName || items.length === 0) && (
          <p className="text-caption text-text-dim">
            {!finalName ? t('lists.editor.needName') : t('lists.editor.needItems')}
          </p>
        )}

        {confirmReplace && activeOnce && (
          <p className="rounded-sm bg-surface-2 p-3 text-caption text-text-primary">
            {t('lists.replaceOnce.question', { name: activeOnce.name })}
          </p>
        )}

        {list && (
          confirmDelete ? (
            <div className="rounded-sm bg-surface-2 p-3">
              <p className="mb-3 text-caption text-text-primary">
                {t('lists.deleteConfirm', { name: list.name })}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  loading={remove.isPending}
                  onClick={() => remove.mutate(list.id, {
                    onSuccess: () => {
                      toast.show(t('lists.deleted', { name: list.name }));
                      onSaved('');
                      onClose();
                    },
                  })}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex h-11 w-full items-center justify-center gap-2 text-body text-danger"
            >
              <Trash2 className="h-4 w-4" />
              {t('lists.delete')}
            </button>
          )
        )}
      </Modal>

      <ListCollect
        kitchenId={kitchenId}
        open={open && collectOpen}
        items={items}
        onChange={setItems}
        onClose={() => setCollectOpen(false)}
      />
    </>
  );
}
