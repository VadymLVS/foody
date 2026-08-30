import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/shared/ui';
import { useSession } from '@/shared/hooks/useSession';
import { ProductsScreen } from '@/features/products/ProductsScreen';
import { DishesScreen } from '@/features/dishes/DishesScreen';
import { SwipeScreen } from '@/features/swipe/SwipeScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { DeleteAccountScreen } from '@/features/settings/DeleteAccountScreen';
import { KitchenManageScreen } from '@/features/kitchens/KitchenManageScreen';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { JoinScreen } from '@/features/auth/JoinScreen';

/** Пока сессия неизвестна — не решаем: иначе вошедший на миг увидит вход. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return null;
  if (!session) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return null;
  if (session) return <Navigate to="/products" replace />;
  return <>{children}</>;
}

function AppShell() {
  return (
    <RequireAuth>
      <div className="min-h-full">
        <Outlet />
        <BottomNav />
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
  { path: '/settings/delete-account', element: <RequireAuth><DeleteAccountScreen /></RequireAuth> },
  { path: '/kitchens/:id', element: <RequireAuth><KitchenManageScreen /></RequireAuth> },
  { path: '*', element: <Navigate to="/products" replace /> },
]);
