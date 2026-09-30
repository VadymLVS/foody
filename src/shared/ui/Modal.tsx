import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Во всю видимую высоту, а не по содержимому (замечание Vadym 09-30: «подвинь
   * панель повыше, а то не видно рабочей зоны»). Короткая форма прижималась
   * к низу экрана, и сверху оставалась бесполезная чернота.
   */
  tall?: boolean;
  /**
   * Куда ставить фокус при открытии. По умолчанию — первое поле ввода.
   * `false` — никуда: в форме списка первым делом выбирают вид, и прыжок
   * в название с выездом клавиатуры мешал (замечание Vadym 09-30).
   * Точку можно задать и разметкой: атрибут `data-autofocus` на элементе.
   */
  autoFocus?: boolean;
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
 *
 * Высота (обзор 09-26, R-7). Раньше высоты не было вовсе: длинная форма —
 * создание блюда с составом — вырастала за экран, а кнопка «Сохранить» жила
 * в конце разметки, и до неё нельзя было домотать. Теперь содержимое
 * прокручивается внутри, заголовок и кнопки закреплены.
 *
 * Клавиатура на iPhone не уменьшает окно, она накрывает его: `fixed` считается
 * от всей страницы, и низ модала оказывается под клавиатурой. Поэтому размер
 * и сдвиг берём у visualViewport — тогда кнопки всегда над клавиатурой.
 */
export function Modal({ open, title, onClose, children, footer, tall, autoFocus = true }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);

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
    if (!open || !autoFocus) return;
    const root = contentRef.current;
    const field = root?.querySelector<HTMLElement>('[data-autofocus]')
      ?? root?.querySelector<HTMLElement>('input:not([type="checkbox"]), select, textarea');
    field?.focus();
  }, [open, autoFocus]);

  // Видимая часть окна: меняется, когда открывается клавиатура
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-0 z-50 flex items-end justify-center sm:items-center"
      style={viewport ? { top: viewport.top, height: viewport.height, bottom: 'auto' } : undefined}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex w-full max-w-[420px] flex-col rounded-t-lg bg-surface sm:rounded-lg',
          tall ? 'h-full' : 'max-h-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4">
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

        <div
          ref={contentRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4"
          style={footer ? undefined : { paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>

        {footer && (
          <div
            className="flex shrink-0 gap-2 px-4 pt-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
