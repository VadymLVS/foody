import { useEffect, useState } from 'react';
import { ShoppingBasket, Trash2, X } from 'lucide-react';
import { Button, Input, Modal, useToast } from '@/shared/ui';
import { useProducts } from '@/shared/hooks/useProducts';
import { useProductListActions } from '@/shared/hooks/useProductLists';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';
import type { ProductList } from '@/shared/api/repo';
import type { Product } from '@/shared/db/types';
import { ProductPicker } from './ProductPicker';

interface Props {
  kitchenId: string;
  open: boolean;
  /** Правка существующего списка; без него — создание нового. */
  list?: ProductList | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

/**
 * Создание и правка списка покупок (backlog п. 45).
 *
 * Два вида в одной форме: постоянная заготовка («Обычная закупка») и разовый
 * «купить сейчас» на одну поездку. Разница только в том, как список ведёт себя
 * дальше: разовый всплывает в приоритете и закрывается после покупок.
 *
 * Количества у позиции нет намеренно: количество живёт у продукта (D-030),
 * второе рядом сразу начало бы расходиться с первым.
 *
 * «Взять из «Купить»» — потому что список чаще всего и собирают, стоя над
 * этим фильтром: набрать двадцать позиций поиском по одной никто не будет.
 */
export function ListEditor({ kitchenId, open, list, onClose, onSaved }: Props) {
  const { data: products = [] } = useProducts(kitchenId);
  const { save, remove } = useProductListActions(kitchenId);
  const toast = useToast();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'regular' | 'once'>('regular');
  const [picked, setPicked] = useState<Product[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /*
   * Название подставляется по виду списка (замечание Vadym 09-30).
   * Раньше форма открывалась с пустым названием, «Сохранить» из-за этого
   * был неактивен, и почему — нигде не сказано: человек добавлял позиции
   * и не мог сохранить. Теперь имя есть сразу, а если его не меняли —
   * оно следует за переключателем вида.
   */
  const defaultName = (k: 'regular' | 'once') =>
    (k === 'once' ? t('lists.defaultName.once') : t('lists.defaultName.regular'));

  const pickKind = (next: 'regular' | 'once') => {
    setKind(next);
    if (!name.trim() || name.trim() === defaultName(kind)) setName(defaultName(next));
  };

  // Форма наполняется на открытие: при правке — из списка, при создании — пустая
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (list) {
      setName(list.name);
      setKind(list.kind);
      const byId = new Map(products.map((p) => [p.id, p]));
      setPicked(list.productIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
    } else {
      setName(defaultName('regular'));
      setKind('regular');
      setPicked([]);
    }
  }, [open, list, products]);

  const addFromToBuy = () => {
    const have = new Set(picked.map((p) => p.id));
    const toBuy = products.filter((p) => !p.in_stock && !have.has(p.id));
    if (toBuy.length === 0) {
      toast.show(t('lists.editor.nothingToBuy'));
      return;
    }
    setPicked((prev) => [...prev, ...toBuy]);
  };

  const submit = () => {
    save.mutate(
      { input: { name: name.trim(), kind, productIds: picked.map((p) => p.id) }, id: list?.id },
      {
        onSuccess: (id) => {
          onSaved(id);
          onClose();
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : t('common.error'), { tone: 'danger' }),
      },
    );
  };

  const kindButton = (value: 'regular' | 'once', label: string, hint: string) => (
    <button
      type="button"
      onClick={() => pickKind(value)}
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
    <Modal
      open={open}
      title={list ? t('lists.editor.editTitle') : t('lists.editor.newTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            fullWidth
            disabled={!name.trim() || picked.length === 0}
            loading={save.isPending}
            onClick={submit}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('lists.editor.namePlaceholder')}
      />

      <div className="flex gap-2">
        {kindButton('regular', t('lists.kind.regular'), t('lists.kind.regularHint'))}
        {kindButton('once', t('lists.kind.once'), t('lists.kind.onceHint'))}
      </div>

      {/* Поиск стоит выше списка позиций: снизу его подсказки закрывали
          кнопки формы, и не было видно, что нашлось (замечание Vadym 09-30) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-micro text-text-muted">{t('lists.editor.add')}</span>
          <button
            type="button"
            onClick={addFromToBuy}
            className="flex h-8 items-center gap-1.5 text-caption text-accent"
          >
            <ShoppingBasket className="h-4 w-4" />
            {t('lists.editor.fromToBuy')}
          </button>
        </div>
        <ProductPicker
          kitchenId={kitchenId}
          pickedIds={picked.map((p) => p.id)}
          placeholder={t('lists.editor.search')}
          onPick={(product) => setPicked((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]))}
          onError={(message) => toast.show(message, { tone: 'danger' })}
        />
      </div>

      <div>
        <span className="mb-1 block text-micro text-text-muted">
          {t('lists.editor.items', { count: picked.length })}
        </span>

        {picked.length === 0 && (
          <p className="mb-2 text-caption text-text-dim">{t('lists.editor.empty')}</p>
        )}

        {picked.map((product) => (
          <div key={product.id} className="flex h-11 items-center gap-2 border-b border-line">
            <span className="min-w-0 flex-1 truncate text-body">{product.name}</span>
            <button
              type="button"
              onClick={() => setPicked((prev) => prev.filter((p) => p.id !== product.id))}
              aria-label={t('lists.editor.removeItem', { name: product.name })}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Неактивная кнопка без объяснения — тупик: говорим, чего не хватает,
          и говорим рядом с кнопками, куда человек смотрит последним */}
      {(!name.trim() || picked.length === 0) && (
        <p className="text-caption text-text-dim">
          {!name.trim() ? t('lists.editor.needName') : t('lists.editor.needItems')}
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
  );
}
