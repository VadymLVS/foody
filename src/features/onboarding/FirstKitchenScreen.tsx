import { useState } from 'react';
import { Home } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { useKitchenActions } from '@/shared/hooks/useKitchens';
import { t } from '@/shared/lib/i18n';

/**
 * Первая кухня (п. 34). Регистрация создаёт только профиль; без кухни приложение
 * не работало вовсе: пустой id кухни, вечная загрузка карусели, ошибка uuid.
 */
export function FirstKitchenScreen() {
  const { create } = useKitchenActions();
  const [name, setName] = useState(t('firstKitchen.default'));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return;
    setError(null);
    create.mutate(name.trim(), {
      onError: (e) => setError(e instanceof Error ? e.message : t('firstKitchen.failed')),
    });
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[420px] flex-col justify-center px-6">
      <Home className="mx-auto h-12 w-12 text-accent" />
      <h1 className="mt-4 text-center text-title">{t('firstKitchen.title')}</h1>
      <p className="mt-2 text-center text-body text-text-muted">{t('firstKitchen.hint')}</p>

      <div className="mt-8">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('firstKitchen.placeholder')}
          aria-label={t('firstKitchen.placeholder')}
        />
      </div>
      {error && <p className="mt-2 text-caption text-danger">{error}</p>}

      <Button className="mt-4" fullWidth size="lg" onClick={submit} loading={create.isPending} disabled={!name.trim()}>
        {t('firstKitchen.create')}
      </Button>

      <p className="mt-6 text-center text-caption text-text-dim">{t('firstKitchen.invited')}</p>
    </div>
  );
}
