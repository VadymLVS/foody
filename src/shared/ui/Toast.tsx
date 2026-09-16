import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '@/shared/lib/cn';

interface ToastData {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: 'default' | 'danger';
}

interface ToastApi {
  show: (message: string, options?: Omit<ToastData, 'id' | 'message'>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATION = 5000; // D-009: столько живёт «Отменить»

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const show = useCallback<ToastApi['show']>((message, options) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, ...options }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATION);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-center justify-between gap-4',
              'rounded-md px-4 py-3 text-white shadow-modal',
              toast.tone === 'danger' ? 'bg-danger' : 'bg-surface border border-line',
            )}
          >
            <span className="text-caption">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="shrink-0 text-body-semibold text-accent"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast должен вызываться внутри ToastProvider');
  return ctx;
}
