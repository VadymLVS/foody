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

/** Фильтры состояния — пилюлями, чтобы не сливаться со вкладками выше. */
export function FilterPills({
  items, active, onChange,
}: { items: TabItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="no-scrollbar -my-2 flex gap-2 overflow-x-auto py-2">
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
    </div>
  );
}
