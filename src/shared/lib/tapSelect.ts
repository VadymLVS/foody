import { useCallback, useRef } from 'react';

/**
 * Нажатие подсказки при открытой клавиатуре (backlog п. 43).
 *
 * Симптом (Vadym, 09-26): в форме с открытой клавиатурой предлагаемый продукт
 * не нажимался — приходилось сначала закрыть клавиатуру. В браузере на
 * настольной машине это не воспроизводится.
 *
 * Причина: выбор висел на `onClick`. На iPhone касание вне поля ввода сначала
 * снимает фокус, клавиатура уезжает, страница пересчитывает высоту — и к
 * моменту `click` под пальцем уже другой элемент, поэтому события по кнопке
 * не случается вовсе.
 *
 * Лечение: решение принимается на `touchend`, до перестройки страницы, и там же
 * `preventDefault()` — он же отменяет эмулированный `click`, поэтому обработчик
 * не срабатывает дважды. `touchstart` НЕ отменяем: иначе список подсказок
 * перестал бы прокручиваться пальцем, начатым со строки. Сдвиг больше 10 px
 * считается прокруткой, а не выбором — так же, как в строке продукта.
 *
 * Мышь и клавиатура идут прежним путём через `onClick`; `onMouseDown` с
 * `preventDefault` оставляет фокус в поле, чтобы можно было продолжать печатать.
 */
export function useTapSelect() {
  const start = useRef<{ x: number; y: number } | null>(null);

  return useCallback((onSelect: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const from = start.current;
      start.current = null;
      const touch = e.changedTouches[0];
      if (!from || !touch) return;
      const moved = Math.abs(touch.clientX - from.x) > 10
        || Math.abs(touch.clientY - from.y) > 10;
      if (moved) return;
      e.preventDefault();
      onSelect();
    },
    onTouchCancel: () => { start.current = null; },
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); },
    onClick: () => { onSelect(); },
  }), []);
}
