import { Navigate } from 'react-router-dom';
import { useKitchens } from '@/shared/hooks/useKitchens';
import { useDiet } from '@/shared/hooks/useDiet';
import { t } from '@/shared/lib/i18n';
import { FirstKitchenScreen } from './FirstKitchenScreen';
import { DietScreen } from './DietScreen';
import { pendingInvite } from './pendingInvite';

/**
 * Первый запуск (п. 34, 36). Экраны приложения рендерятся только когда
 * у человека есть кухня и он ответил, что ест (или пропустил).
 *
 * Порядок: приглашение, если открывали ссылку до входа → первая кухня → питание.
 */
export function FirstRunGate({ children }: { children: React.ReactNode }) {
  const kitchens = useKitchens();
  const diet = useDiet();

  if (kitchens.isLoading || diet.isLoading) {
    return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
  }

  const list = kitchens.data ?? [];
  if (list.length === 0) {
    // Приглашённому не нужна своя пустая кухня — сначала принять приглашение
    const code = pendingInvite.get();
    if (code) return <Navigate to={`/join/${code}`} replace />;
    return <FirstKitchenScreen />;
  }

  if (diet.data && diet.data.diet === null) return <DietScreen mode="onboarding" />;

  return <>{children}</>;
}
