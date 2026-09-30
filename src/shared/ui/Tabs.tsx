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
 * `pinned` — кнопка у правого края, которая не уезжает при прокрутке:
 * «Выключить всё» должно быть на виду над списком, который оно меняет
 * (п. 44, выбор Vadym).
 *
 * Закреплённое стоит рядом с полосой прокрутки, а не поверх неё. Сначала
 * я положил кнопку сверху и зарезервировал под неё 72 px отступом внутри
 * самой полосы — из-за этого ряд «прокручивался» ровно на ширину отступа,
 * то есть на телефоне палец тянул его почти вхолостую, а первая пилюля
 * уезжала за край (замечание Vadym 09-30). Теперь полоса просто на
 * 44 px короче, и внутри неё прокручивается только настоящее содержимое.
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
    <div className="flex items-center gap-1">
      <div className={cn('no-scrollbar -my-2 flex min-w-0 flex-1 gap-2 overflow-x-auto py-2')}>
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
      {pinned && <span className="shrink-0">{pinned}</span>}
    </div>
  );
}
