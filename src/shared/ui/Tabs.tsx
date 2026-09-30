import { cn } from '@/shared/lib/cn';

export interface TabItem { id: string; label: string }

/**
 * Вкладки подчёркиванием. Ряд скроллится, справа — затухание:
 * без него люди не догадываются, что есть продолжение.
 */
export function Tabs({
  items, active, onChange,
}: { items: TabItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="relative">
      {/* py/-my дают место невидимой зоне касания внутри полосы прокрутки:
          без них ::before вылезал бы за контейнер и добавлял вертикальный скролл */}
      <div className="no-scrollbar -my-[9px] flex gap-4 overflow-x-auto px-0.5 py-[9px]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-selected={active === item.id}
            role="tab"
            className={cn(
              'shrink-0 whitespace-nowrap border-b-[1.5px] pb-1.5 text-body transition-colors',
              // Вид прежний, палец попадает в 45 px: правило 44 px (D-014).
              // Зона расширена невидимо — внешне вкладка не изменилась (U-4)
              'relative before:absolute before:-inset-y-[9px] before:inset-x-0 before:content-[""]',
              active === item.id
                ? 'border-white text-text-primary'
                : 'border-transparent text-text-dim',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <span className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-r from-transparent to-bg" />
    </div>
  );
}

/**
 * Фильтры состояния — пилюлями, чтобы не сливаться со вкладками выше.
 *
 * `after` — то, что едет вместе с пилюлями (выбор списка покупок, п. 45).
 * `pinned` — то, что закреплено у правого края поверх ряда и не уезжает
 * при прокрутке: «Выключить всё» должно быть на виду над списком, который
 * оно меняет (п. 44, выбор Vadym). Под закреплённым — затухание, как
 * справа у вкладок категорий, иначе пилюли уезжают под кнопку резко.
 */
export function FilterPills({
  items, active, onChange, after, pinned,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  after?: React.ReactNode;
  pinned?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Отступ справа равен закреплённой зоне вместе с затуханием: без него
          последняя пилюля не доезжает до конца и остаётся под кнопкой */}
      <div className={cn('no-scrollbar -my-2 flex gap-2 overflow-x-auto py-2', pinned && 'pr-[72px]')}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={active === item.id}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-micro transition-colors',
            'relative before:absolute before:-inset-y-2 before:inset-x-0 before:content-[""]',
            active === item.id
              ? 'bg-[#E8E8E8] text-black'
              : 'border border-[#242424] text-[#8A8A8A]',
          )}
        >
          {item.label}
        </button>
      ))}
      {after}
      </div>
      {pinned && (
        <>
          <span className="pointer-events-none absolute inset-y-0 right-12 w-6 bg-gradient-to-r from-transparent to-bg" />
          <span className="absolute inset-y-0 right-0 flex items-center bg-bg pl-1">{pinned}</span>
        </>
      )}
    </div>
  );
}
