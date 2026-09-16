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
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-selected={active === item.id}
            role="tab"
            className={cn(
              'shrink-0 whitespace-nowrap border-b-[1.5px] pb-1.5 text-body transition-colors',
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
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={active === item.id}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-micro transition-colors',
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
