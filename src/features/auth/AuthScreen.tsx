import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck, Sprout } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { auth, authErrorMessage, hasSupabaseCredentials } from '@/shared/api';
import { pendingInvite } from '@/features/onboarding/pendingInvite';
import { resetAccountState } from '@/app/providers';

type Mode = 'welcome' | 'signup' | 'signin' | 'check-email';

/** Сколько ждать перед повторной отправкой: встроенная почта Supabase отдаёт единицы писем в час. */
const RESEND_COOLDOWN_S = 60;

const MIN_PASSWORD = 8;

export function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const canSubmit =
    email.includes('@') && password.length >= MIN_PASSWORD && (mode === 'signin' || name.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await auth.signUp(email.trim(), password, name.trim());
        /*
         * Подтверждение почты включено — сессии нет (п. 53). Раньше код шёл
         * на /products как ни в чём не бывало, роутер видел пустую сессию и
         * возвращал на приветственный экран: человек заполнил форму, нажал
         * «Продолжить» и оказался там же, без слова о письме.
         *
         * Код приглашения не трогаем: после перехода по ссылке из письма
         * роутер сам отправит человека в кухню, куда его звали (п. 31).
         */
        if (needsConfirmation) {
          setMode('check-email');
          setCooldown(RESEND_COOLDOWN_S);
          return;
        }
      } else {
        await auth.signIn(email.trim(), password);
      }
      // Пришли по приглашению — сначала принять его (п. 31). Код читаем до сброса
      const code = pendingInvite.get();
      // Кэш прежнего аккаунта на этом устройстве — в сторону (найдено 09-20:
      // после входа были видны кухня, продукты и блюда другого человека)
      resetAccountState();
      if (code) pendingInvite.set(code);
      navigate(code ? `/join/${code}` : '/products');
    } catch (e) {
      setError(authErrorMessage(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'check-email') {
    const resend = async () => {
      setError(null);
      try {
        await auth.resendConfirmation(email.trim());
        setResent(true);
        setCooldown(RESEND_COOLDOWN_S);
      } catch (e) {
        setError(authErrorMessage(e instanceof Error ? e.message : ''));
      }
    };
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <MailCheck className="h-14 w-14 text-accent" />
          <h1 className="mt-4 text-title">Проверьте почту</h1>
          <p className="mt-3 text-body text-text-muted">
            Отправили письмо на <span className="text-text-primary">{email.trim()}</span>.
            Откройте ссылку из письма — и вы сразу окажетесь в приложении.
          </p>
          <p className="mt-3 text-caption text-text-dim">
            Письма нет пару минут — загляните в «Спам».
          </p>
          {resent && <p className="mt-3 text-caption text-accent">Отправили ещё раз</p>}
          {error && <p className="mt-3 text-caption text-danger">{error}</p>}
        </div>

        <div className="space-y-2">
          <Button variant="secondary" fullWidth size="lg" onClick={resend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Отправить ещё раз · ${cooldown} с` : 'Отправить ещё раз'}
          </Button>
          {/* Подтвердил на другом устройстве — входит здесь обычным образом */}
          <Button
            variant="ghost"
            fullWidth
            onClick={() => { setMode('signin'); setError(null); setPassword(''); }}
          >
            Уже подтвердил — войти
          </Button>
        </div>
      </Screen>
    );
  }

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
