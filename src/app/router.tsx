import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/shared/hooks/useSession';
import { ProductsScreen } from '@/features/products/ProductsScreen';
import { QuickStartScreen } from '@/features/products/QuickStartScreen';
import { DishesScreen } from '@/features/dishes/DishesScreen';
import { DishQuickStartScreen } from '@/features/dishes/DishQuickStartScreen';
import { SwipeScreen } from '@/features/swipe/SwipeScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { DeleteAccountScreen } from '@/features/settings/DeleteAccountScreen';
import { KitchenManageScreen } from '@/features/kitchens/KitchenManageScreen';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { JoinScreen } from '@/features/auth/JoinScreen';
import { FirstRunGate } from '@/features/onboarding/FirstRunGate';
import { DietScreen } from '@/features/onboarding/DietScreen';
import { pendingInvite } from '@/features/onboarding/pendingInvite';

/** Пока сессия неизвестна — не решаем: иначе вошедший на миг увидит вход. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return null;
  if (!session) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  // Без кухни и без ответа про питание экраны приложения не открываются (п. 34, 36)
  return <FirstRunGate>{children}</FirstRunGate>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return null;
  if (session) {
    // Вошли со страницы приглашения — возвращаем туда, а не в список (п. 31)
    const code = pendingInvite.get();
    return <Navigate to={code ? `/join/${code}` : '/products'} replace />;
  }
  return <>{children}</>;
}

/**
 * Навигацию рисует сам экран: кнопке «+» нужно знать, что добавлять,
 * а это у каждого раздела своё. Оболочка отвечает только за доступ.
 */
function AppShell() {
  return (
    <RequireAuth>
      <div className="min-h-full">
        <Outlet />
      </div>
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <GuestOnly><AuthScreen /></GuestOnly> },
  // Приглашение открывается без входа: сначала видно, куда зовут
  { path: '/join/:code', element: <JoinScreen /> },
  {
    element: <AppShell />,
    children: [
      { path: '/products', element: <ProductsScreen /> },
      { path: '/dishes', element: <DishesScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
    ],
  },
  { path: '/today/choose', element: <RequireAuth><SwipeScreen /></RequireAuth> },
  { path: '/products/quick-start', element: <RequireAuth><QuickStartScreen /></RequireAuth> },
  { path: '/dishes/quick-start', element: <RequireAuth><DishQuickStartScreen /></RequireAuth> },
  { path: '/settings/diet', element: <RequireAuth><DietScreen mode="settings" /></RequireAuth> },
  { path: '/settings/delete-account', element: <RequireAuth><DeleteAccountScreen /></RequireAuth> },
  { path: '/kitchens/:id', element: <RequireAuth><KitchenManageScreen /></RequireAuth> },
  { path: '*', element: <Navigate to="/products" replace /> },
]);
