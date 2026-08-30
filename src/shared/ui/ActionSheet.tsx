import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface SheetAction {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  open: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/** Контекстное меню продукта. Пункты высотой 52px — попасть пальцем на ходу. */
export function ActionSheet({ open, title, actions, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="menu"
        aria-label={title ?? 'Действия'}
        className="relative w-full max-w-[420px] rounded-t-lg bg-surface pb-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto my-3 h-1 w-9 rounded-full bg-line" />
        {title && (
          <p className="px-4 pb-2 text-caption text-text-muted">{title}</p>
        )}
        {actions.map(({ label, Icon, onClick, danger }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClick();
              onClose();
            }}
            className={cn(
              'flex h-[52px] w-full items-center gap-3 px-4 text-body active:bg-surface-2',
              danger ? 'text-danger' : 'text-text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
