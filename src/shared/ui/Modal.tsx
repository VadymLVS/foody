import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Модал на мобильном приезжает снизу — так до кнопок дотягивается большой палец.
 * Escape закрывает, фокус уезжает внутрь, фон под модалом не скроллится.
 *
 * Эффекты разделены намеренно. Раньше фокус, блокировка прокрутки и обработчик
 * клавиш жили в одном эффекте с зависимостью от onClose, а onClose приходит
 * inline-функцией и пересоздаётся при каждой перерисовке. Из-за этого на каждое
 * нажатие клавиши эффект перезапускался и снова выставлял фокус — причём
 * querySelector отдавал первый элемент в порядке разметки, то есть кнопку
 * закрытия. Поле теряло фокус, клавиатура на телефоне закрывалась, и вводить
 * можно было по одной букве.
 */
export function Modal({ open, title, onClose, children, footer }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Обработчик клавиш живёт отдельно: он и должен видеть свежий onClose
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Прокрутка фона — только на открытие и закрытие
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Фокус выставляется ровно один раз, и только на поле ввода, не на крестик
  useEffect(() => {
    if (!open) return;
    const field = contentRef.current?.querySelector<HTMLElement>(
      'input:not([type="checkbox"]), select, textarea',
    );
    field?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[420px] rounded-t-lg bg-surface p-4 sm:rounded-lg"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div ref={contentRef} className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}
