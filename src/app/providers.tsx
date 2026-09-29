import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth } from '@/shared/api';
import { useUI } from '@/shared/store/ui';
import { clearQueue } from '@/shared/lib/opQueue';
import { pendingInvite } from '@/features/onboarding/pendingInvite';
import { ToastProvider } from '@/shared/ui';
import { useAppUpdate } from './useAppUpdate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      // Realtime и так шлёт обновления; лишний рефетч на каждый фокус
      // только мигает интерфейсом.
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Смена аккаунта в том же браузере (выход → вход другим) сбрасывает кэш
 * и выбранную кухню (п. 34). Иначе новый аккаунт на миг видел данные прежнего,
 * а выбранная кухня указывала на чужую.
 *
 * Кэш запросов — не единственное место, где лежат данные. Service worker
 * держит ответы Supabase в кэше «api» (NetworkFirst), и он переживает
 * и выход, и закрытие приложения: в подвале без сети новый аккаунт увидел бы
 * оттуда чужие продукты (обзор 09-26, B-5). Поэтому кэш ответов тоже чистим.
 */
async function clearApiCache() {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.includes('api')).map((n) => caches.delete(n)));
  } catch {
    /* приватный режим или кэш недоступен — не критично */
  }
}

/**
 * Сбросить всё, что относится к прежнему аккаунту: кэш запросов и выбранную кухню.
 * Вызывается явно при выходе и входе — не полагаемся только на событие смены сессии.
 */
export function resetAccountState() {
  queryClient.clear();
  useUI.getState().setKitchen(null);
  // Неотправленные правки прежнего аккаунта не должны уйти от имени нового
  clearQueue();
  pendingInvite.clear();
  void clearApiCache();
}

function useResetOnAccountChange() {
  const lastUser = useRef<string | null | undefined>(undefined);
  const setKitchen = useUI((s) => s.setKitchen);
  useEffect(() => auth.onChange((session) => {
    const next = session?.userId ?? null;
    if (lastUser.current !== undefined && lastUser.current !== next) {
      queryClient.clear();
      setKitchen(null);
      clearQueue();
      pendingInvite.clear();
      void clearApiCache();
    }
    lastUser.current = next;
  }), [setKitchen]);
}

/** Проверка обновления живёт внутри ToastProvider — ей нужен тост. */
function AppShell({ children }: { children: React.ReactNode }) {
  useAppUpdate();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useResetOnAccountChange();
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </QueryClientProvider>
  );
}
