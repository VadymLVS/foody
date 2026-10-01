import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';

interface Props {
  open: boolean;
  /** Элемент, от которого раскрывается панель: пилюля, кнопка, вкладка. */
  anchor: React.RefObject<HTMLElement>;
  onClose: () => void;
  children: React.ReactNode;
  /** Ширина панели; по умолчанию 260 — хватает названию списка с числом. */
  width?: number;
  label: string;
}

const GAP = 8;
/** Отступ от краёв экрана, чтобы панель не прилипала к рамке. */
const EDGE = 12;

/**
 * Панель, раскрывающаяся от своего элемента (backlog п. 52).
 *
 * Почему не лист снизу, как остальные меню. Vadym: «Когда нажимаю на табу
 * «Сладкое», должен появиться дропдаун с этой табы, а у меня открывается
 * какое-то меню… именно дропдаун, а не попап снизу, чтобы легче
 * воспринималось.» Остальные меню приложения — это списки действий, и лист
 * снизу для них уместен. Здесь переключатель: человек нажал на пилюлю и ждёт,
 * что раскроется она. Лист приходит с другого конца экрана, связи с нажатым
 * элементом нет, и его приходится читать заново.
 *
 * Прежнее возражение («до верха экрана большим пальцем не дотянуться») здесь
 * не работает: панель раскрывается от пилюли, а пилюля и так стоит в верхней
 * трети — если палец достал до неё, достанет и до того, что под ней.
 *
 * Положение считается от элемента и прижимается к краям экрана, чтобы на узком
 * телефоне панель не уезжала за рамку. Координаты берутся у visualViewport:
 * на iPhone клавиатура не уменьшает окно, а накрывает его.
 */
export function Dropdown({ open, anchor, onClose, children, width = 260, label }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; tip: number } | null>(null);

  // Положение считается до покраски: иначе панель заметно прыгает на место
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const left = Math.min(
        Math.max(EDGE, a.left + a.width / 2 - width / 2),
        Math.max(EDGE, vw - width - EDGE),
      );
      setBox({
        left,
        top: a.bottom + GAP,
        // Уголок смотрит в центр элемента, но не вылезает за углы панели
        tip: Math.min(Math.max(14, a.left + a.width / 2 - left - 6), width - 26),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Фокус внутрь панели: с клавиатуры и для чтения с экрана она должна
  // перехватывать управление так же, как модал
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
  }, [open]);

  if (!open || !box) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Подложка только ловит нажатие мимо панели: затемнять незачем —
          человек должен видеть список, от которого переключается */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        style={{ left: box.left, top: box.top, width }}
        className={cn(
          'absolute max-h-[70vh] overflow-y-auto overscroll-contain rounded-lg',
          'border border-[#242424] bg-surface shadow-modal outline-none',
        )}
      >
        <span
          aria-hidden
          style={{ left: box.tip }}
          className="absolute -top-[7px] h-3 w-3 rotate-45 border-l border-t border-[#242424] bg-surface"
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

/** Строка дропдауна: только текст, без значков (замечание Vadym 10-01). */
export function DropdownItem({
  label, note, active, tone, onClick,
}: {
  label: string;
  /** Короткая приписка справа — число позиций. */
  note?: string;
  active?: boolean;
  tone?: 'accent';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-12 w-full items-center gap-3 px-4 text-left text-body',
        active ? 'bg-accent/[0.08] text-accent' : tone === 'accent' ? 'text-accent' : 'text-text-primary',
        'active:bg-surface-2',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {note && (
        <span className={cn('shrink-0 text-caption', active ? 'text-accent/75' : 'text-text-dim')}>
          {note}
        </span>
      )}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="h-px bg-line" aria-hidden />;
}
