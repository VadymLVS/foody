import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { auth, authErrorMessage, hasSupabaseCredentials } from '@/shared/api';

type Mode = 'welcome' | 'signup' | 'signin';

const MIN_PASSWORD = 8;

export function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const canSubmit =
    email.includes('@') && password.length >= MIN_PASSWORD && (mode === 'signin' || name.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await auth.signUp(email.trim(), password, name.trim());
      else await auth.signIn(email.trim(), password);
      navigate('/products');
    } catch (e) {
      setError(authErrorMessage(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'welcome') {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Sprout className="h-16 w-16 text-accent" />
          <h1 className="mt-4 text-title">PantrySync</h1>
          <p className="mt-2 text-caption text-text-muted">
            Продукты и блюда для всей семьи
          </p>
        </div>

        <div className="space-y-2">
          <Button fullWidth size="lg" onClick={() => setMode('signup')}>
            Создать кухню
          </Button>
          <Button variant="secondary" fullWidth size="lg" onClick={() => setMode('signin')}>
            У меня уже есть аккаунт
          </Button>
          {!hasSupabaseCredentials && (
            <p className="pt-2 text-center text-small text-text-muted">
              База не подключена — приложение работает на демо-данных
            </p>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex-1 pt-8">
        <h1 className="text-title">{mode === 'signup' ? 'Создать аккаунт' : 'Вход'}</h1>

        <div className="mt-6 space-y-3">
          {mode === 'signup' && (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как вас зовут"
              autoComplete="name"
            />
          )}
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Почта"
            type="email"
            inputMode="email"
            autoComplete="email"
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            error={passwordTooShort ? `Не короче ${MIN_PASSWORD} символов` : undefined}
          />
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>

        <Button fullWidth size="lg" className="mt-6" onClick={submit} loading={busy} disabled={!canSubmit}>
          Продолжить
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setError(null);
          }}
          className="mt-4 w-full text-caption text-accent"
        >
          {mode === 'signup' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
        </button>
      </div>

      <Button variant="ghost" fullWidth onClick={() => setMode('welcome')}>
        Назад
      </Button>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto flex min-h-screen max-w-[420px] flex-col px-6 pt-8"
      style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}
