import { useEffect, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useToast } from '@/shared/ui';
import { t } from '@/shared/lib/i18n';
import { pendingCount } from '@/shared/lib/opQueue';

/**
 * Доставка новой версии на телефон (обзор 09-26, R-10).
 *
 * Приложение вообще не подключало регистрацию service worker: браузер брал
 * прежнюю сборку из кэша, и жалобы «у меня старая версия» объяснялись именно
 * этим. Теперь:
 *
 * - при готовности новой сборки показывается тост с кнопкой «Обновить»,
 *   который перезагружает приложение: молча подменять экран под руками нельзя,
 *   человек может стоять в магазине с открытым списком;
 * - при возврате в приложение (и при появлении сети) проверяем обновление сами:
 *   PWA с домашнего экрана живёт неделями и сама за обновлениями не ходит.
 */
export function useAppUpdate() {
  const toast = useToast();
  const shown = useRef(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Только что открыли и ничего не ждёт отправки — ставим сразу, молча:
        // спрашивать на пустом экране незачем, а старую версию человек
        // получил бы ещё на неделю
        if (Date.now() - startedAt.current < 5000 && pendingCount() === 0) {
          void updateSW(true);
          return;
        }
        if (shown.current) return;
        shown.current = true;
        toast.show(t('app.updateReady'), {
          key: 'app-update',
          action: {
            label: t('app.updateNow'),
            onClick: () => {
              shown.current = false;
              void updateSW(true);
            },
          },
        });
      },
      onRegisteredSW(_url, reg) {
        registration = reg;
      },
    });

    const check = () => {
      if (document.visibilityState === 'visible') void registration?.update();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, [toast]);
}
