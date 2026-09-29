import { cn } from '@/shared/lib/cn';

/**
 * Значки переключателя «Блюда | Наборы» (п. 37, D-064).
 *
 * Цветные эмодзи вместо линейных значков — переключатель не замечали.
 * У «Наборов» два блюда в квадрате: суп крупно, салат меньше — поверх,
 * справа внизу, с тонкой обводкой цветом фона, чтобы блюда не сливались.
 * Эмодзи системные: на iPhone — Apple, картинок в приложении нет.
 *
 * Композиция задаётся боксами, а не кеглем (правка 09-29). Раньше стояли
 * те же числа — 17 и 12 с отступом 2 — но размером шрифта, а видимая часть
 * эмодзи шире своего кегля и стоит по базовой линии. Салат из-за этого
 * наезжал на кастрюлю и почти её закрывал, причём по-разному в разных
 * шрифтах. Теперь у каждого блюда свой бокс, глиф центрируется внутри,
 * и положение от шрифта не зависит: вариант A, выбор Vadym.
 */
export function SectionIcon({ kind, active, ring }: { kind: 'dishes' | 'sets'; active: boolean; ring: string }) {
  const emoji = 'font-emoji absolute flex items-center justify-center leading-none';
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-block h-6 w-6 shrink-0 transition-[filter,opacity] duration-200',
        !active && 'opacity-60 grayscale-[0.7]',
      )}
    >
      {kind === 'dishes' ? (
        <span className={cn(emoji, 'inset-0 text-[19px]')}>🍝</span>
      ) : (
        <>
          {/* Первый план: кастрюля в боксе 18×18 от левого верхнего угла */}
          <span className={cn(emoji, 'left-0 top-0 h-[18px] w-[18px] text-[15px]')}>🍲</span>
          {/* Второй план: салат в боксе 12×12, в 2 px от правого нижнего угла */}
          <span
            className={cn(emoji, 'bottom-[2px] right-[2px] h-[12px] w-[12px] text-[10px]')}
            style={{
              // Обводка цветом подложки: у активного пункта подложка светлее
              filter: `drop-shadow(1.2px 0 0 ${ring}) drop-shadow(-1.2px 0 0 ${ring}) drop-shadow(0 1.2px 0 ${ring}) drop-shadow(0 -1.2px 0 ${ring})`,
            }}
          >
            🥗
          </span>
        </>
      )}
    </span>
  );
}
