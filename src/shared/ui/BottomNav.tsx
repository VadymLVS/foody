import { NavLink, useNavigate } from 'react-router-dom';
import { Refrigerator, UtensilsCrossed, Settings, Plus } from 'lucide-react';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';

const tabs = [
  { to: '/products', key: 'nav.list' as const, Icon: Refrigerator },
  { to: '/dishes', key: 'nav.dishes' as const, Icon: UtensilsCrossed },
  { to: '/settings', key: 'nav.settings' as const, Icon: Settings },
];

/**
 * Два островка (D-033). Кнопка добавления отделена, чтобы при частом
 * переключении вкладок не попадать в неё случайно. Лайм отдан активной
 * вкладке: акцент принадлежит частому действию, а не редкому.
 */
export function BottomNav({ onAdd }: { onAdd?: () => void }) {
  const navigate = useNavigate();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-1 pb-3 pt-2"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-5 rounded-full bg-surface px-4 py-2.5">
        {tabs.map(({ to, key, Icon }) => (
          <NavLink key={to} to={to} aria-label={t(key)}>
            {({ isActive }) => (
              <span className={cn('flex items-center gap-1.5', isActive ? 'text-accent' : 'text-text-dim')}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                {isActive && <span className="text-caption">{t(key)}</span>}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <button
        type="button"
        aria-label={t('nav.add')}
        onClick={() => (onAdd ? onAdd() : navigate('/products'))}
        className="flex h-[38px] w-11 items-center justify-center rounded-full bg-surface text-white transition active:scale-95"
      >
        <Plus className="h-[18px] w-[18px]" />
      </button>
    </nav>
  );
}
