import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { auth } from '@/shared/api';
import { useKitchens } from '@/shared/hooks/useKitchens';

const CONFIRM_WORD = 'УДАЛИТЬ';

/**
 * Требование App Store 5.1.1(v). Экран честно перечисляет последствия:
 * человек должен понимать, что произойдёт с общими кухнями, а не узнавать
 * об этом после нажатия.
 */
export function DeleteAccountScreen() {
  const navigate = useNavigate();
  const { data: list = [] } = useKitchens();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const owned = list.filter((k) => k.role === 'owner');
  const willBeDeleted = owned.filter((k) => k.memberCount <= 1);
  const willBeTransferred = owned.filter((k) => k.memberCount > 1);

  const remove = async () => {
    setBusy(true);
    try {
      await auth.deleteAccount();
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[420px] px-4 pb-8 pt-4">
      <button type="button" onClick={() => navigate(-1)} className="text-caption text-accent">
        Назад
      </button>

      <div className="mt-6 flex items-start gap-3 rounded-md bg-danger/10 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
        <p className="text-caption text-text-primary">
          Аккаунт и все связанные с ним данные будут удалены безвозвратно.
          Отменить это действие нельзя.
        </p>
      </div>

      <h1 className="mt-6 text-title">Удалить аккаунт</h1>

      <section className="mt-4 space-y-3 text-body">
        {willBeDeleted.length > 0 && (
          <div>
            <p className="text-caption text-text-muted">Будут удалены вместе с продуктами и блюдами:</p>
            <p className="mt-1">{willBeDeleted.map((k) => k.name).join(', ')}</p>
          </div>
        )}
        {willBeTransferred.length > 0 && (
          <div>
            <p className="text-caption text-text-muted">Останутся, владение перейдёт участникам:</p>
            <p className="mt-1">{willBeTransferred.map((k) => k.name).join(', ')}</p>
          </div>
        )}
        {owned.length === 0 && (
          <p className="text-text-muted">Вы не владеете ни одной кухней — они не пострадают.</p>
        )}
      </section>

      <div className="mt-8">
        <p className="mb-2 text-caption text-text-muted">
          Чтобы подтвердить, введите слово {CONFIRM_WORD}
        </p>
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
        />
      </div>

      <Button
        variant="danger"
        fullWidth
        size="lg"
        className="mt-6"
        disabled={confirmation.trim().toUpperCase() !== CONFIRM_WORD}
        loading={busy}
        onClick={remove}
      >
        Удалить аккаунт навсегда
      </Button>
    </div>
  );
}
