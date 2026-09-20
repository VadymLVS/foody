import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button, EmptyState } from '@/shared/ui';
import { kitchens, qk } from '@/shared/api';
import { useSession } from '@/shared/hooks/useSession';
import { useUI } from '@/shared/store/ui';
import { t } from '@/shared/lib/i18n';
import { pendingInvite } from '@/features/onboarding/pendingInvite';

export function JoinScreen() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const setKitchen = useUI((s) => s.setKitchen);
  const queryClient = useQueryClient();

  const [preview, setPreview] = useState<{ kitchenName: string; ownerName: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void kitchens
      .peekInvite(code)
      .then((result) => {
        if (alive) setPreview(result);
      })
      .catch(() => {
        if (alive) setPreview(null);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const kitchenId = await kitchens.join(code);
      pendingInvite.clear();
      setKitchen(kitchenId);
      // Список кухонь уже закэширован без новой — обновляем, иначе экран «Первая кухня»
      await queryClient.invalidateQueries({ queryKey: qk.kitchens });
      navigate('/products');
    } catch {
      setError('Приглашение больше не действует. Попросите новую ссылку.');
    } finally {
      setJoining(false);
    }
  };

  if (checking || loading) {
    return <p className="p-12 text-center text-caption text-text-muted">Проверяем приглашение…</p>;
  }

  // Истёкший или отозванный код неотличим от несуществующего — и это правильно:
  // по чужой ссылке не должно быть видно, существовала ли такая кухня (T-12).
  // Без аккаунта предпросмотр мог не пройти (до миграции 0007 он был только
  // для вошедших) — тогда не пугаем «не действует», а предлагаем войти (п. 30).
  if (!preview && session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] items-center px-6">
        <EmptyState
          title="Приглашение не действует"
          description="Срок ссылки истёк или её отозвали. Попросите новую."
          action={<Button onClick={() => navigate('/')}>На главную</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
      <div className="text-center">
        <Users className="mx-auto h-14 w-14 text-accent" />
        <h1 className="mt-4 text-title">{preview ? 'Вас пригласили' : t('join.invitedGeneric')}</h1>
        {preview && (
          <p className="mt-2 text-body text-text-muted">
            {preview.ownerName} зовёт вас в кухню «{preview.kitchenName}»
          </p>
        )}
      </div>

      {error && <p className="mt-4 text-center text-caption text-danger">{error}</p>}

      <div className="mt-8 space-y-2">
        {session ? (
          <Button fullWidth size="lg" onClick={join} loading={joining}>
            Присоединиться
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                // Код переживёт регистрацию: после входа вернёмся сюда (п. 31)
                pendingInvite.set(code);
                navigate('/');
              }}
            >
              {t('join.signInToJoin')}
            </Button>
            <p className="text-center text-caption text-text-muted">{t('join.afterSignIn')}</p>
          </>
        )}
      </div>
    </div>
  );
}
