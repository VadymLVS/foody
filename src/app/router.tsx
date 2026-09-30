import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/shared/hooks/useSession';
import { ProductsScreen } from '@/features/products/ProductsScreen';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { FirstRunGate } from '@/features/onboarding/FirstRunGate';
import { pendingInvite } from '@/features/onboarding/pendingInvite';
import { t } from '@/shared/lib/i18n';

/*
 * Список продуктов и вход нужны сразу — они в основном файле. Остальные
 * экраны грузятся по переходу: до этого вся программа, включая справочник
 * блюд, карусель и разбор чека, лежала в одном файле на 680 КБ, и телефон
 * скачивал её целиком до первого экрана (обзор 09-26, пакет 3).
 */
const DishesScreen = lazy(() => import('@/features/dishes/DishesScreen').then((m) => ({ default: m.DishesScreen })));
const SettingsScreen = lazy(() => import('@/features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const QuickStartScreen = lazy(() => import('@/features/products/QuickStartScreen').then((m) => ({ default: m.QuickStartScreen })));
const DishQuickStartScreen = lazy(() => import('@/features/dishes/DishQuickStartScreen').then((m) => ({ default: m.DishQuickStartScreen })));
const SwipeScreen = lazy(() => import('@/features/swipe/SwipeScreen').then((m) => ({ default: m.SwipeScreen })));
const DeleteAccountScreen = lazy(() => import('@/features/settings/DeleteAccountScreen').then((m) => ({ default: m.DeleteAccountScreen })));
const KitchenManageScreen = lazy(() => import('@/features/kitchens/KitchenManageScreen').then((m) => ({ default: m.KitchenManageScreen })));
const JoinScreen = lazy(() => import('@/features/auth/JoinScreen').then((m) => ({ default: m.JoinScreen })));
const DietScreen = lazy(() => import('@/features/onboarding/DietScreen').then((m) => ({ default: m.DietScreen })));

/** Пока экран подгружается — строка, а не пустота: переход виден. */
function Loading() {
  return <p className="p-12 text-center text-caption text-text-muted">{t('common.loading')}</p>;
}

const load = (node: React.ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>;

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
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </div>
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <GuestOnly><AuthScreen /></GuestOnly> },
  // Приглашение открывается без входа: сначала видно, куда зовут
  { path: '/join/:code', element: load(<JoinScreen />) },
  {
    element: <AppShell />,
    children: [
      { path: '/products', element: <ProductsScreen /> },
      { path: '/dishes', element: <DishesScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
    ],
  },
  { path: '/today/choose', element: <RequireAuth>{load(<SwipeScreen />)}</RequireAuth> },
  { path: '/products/quick-start', element: <RequireAuth>{load(<QuickStartScreen />)}</RequireAuth> },
  { path: '/dishes/quick-start', element: <RequireAuth>{load(<DishQuickStartScreen />)}</RequireAuth> },
  { path: '/settings/diet', element: <RequireAuth>{load(<DietScreen mode="settings" />)}</RequireAuth> },
  { path: '/settings/delete-account', element: <RequireAuth>{load(<DeleteAccountScreen />)}</RequireAuth> },
  { path: '/kitchens/:id', element: <RequireAuth>{load(<KitchenManageScreen />)}</RequireAuth> },
  { path: '*', element: <Navigate to="/products" replace /> },
]);
