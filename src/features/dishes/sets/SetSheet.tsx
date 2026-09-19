import { Pencil, Trash2 } from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import { formatNumber } from '@/shared/lib/text';
import { t, unitLabel } from '@/shared/lib/i18n';
import type { SetView } from './SetsList';

interface Props {
  view: SetView | null;
  busy: boolean;
  onClose: () => void;
  onApply: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Состав набора и что с ним сделать (D-053).
 * Главное действие одно: «Готовим этот набор» или, если он уже в плане, «Снять набор».
 */
export function SetSheet({ view, busy, onClose, onApply, onRemove, onEdit, onDelete }: Props) {
  if (!view) return null;

  return (
    <Modal
      open
      title={view.name}
      onClose={onClose}
      footer={
        view.isPlanned ? (
          <Button variant="secondary" size="lg" fullWidth loading={busy} onClick={onRemove}>
            {t('sets.remove')}
          </Button>
        ) : (
          <Button size="lg" fullWidth loading={busy} onClick={onApply}>
            {t('sets.apply')}
          </Button>
        )
      }
    >
      {view.dishNames.length > 0 && (
        <section>
          <h3 className="mb-1 text-micro text-text-muted">{t('sets.dishes')}</h3>
          <ul>
            {view.dishNames.map((name) => (
              <li key={name} className="flex h-10 items-center border-b border-line text-body">{name}</li>
            ))}
          </ul>
        </section>
      )}

      {view.products.length > 0 && (
        <section>
          <h3 className="text-micro text-text-muted">{t('sets.products')}</h3>
          <p className="mb-1 text-micro text-text-dim">{t('sets.productsHint')}</p>
          <ul>
            {view.products.map((p) => (
              <li key={p.name} className="flex h-10 items-center justify-between border-b border-line text-body">
                {p.name}
                {p.quantity != null && (
                  <span className="text-caption text-text-muted">
                    {formatNumber(p.quantity)} {p.unit ? unitLabel(p.unit) : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-sm text-body text-text-muted active:bg-surface-2"
        >
          <Pencil className="h-4 w-4" />
          {t('sets.edit')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-sm text-body text-danger active:bg-surface-2"
        >
          <Trash2 className="h-4 w-4" />
          {t('sets.delete')}
        </button>
      </div>
    </Modal>
  );
}
