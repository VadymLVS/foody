import { supabase, hasSupabaseCredentials } from './supabase';

export interface Session {
  userId: string;
  email: string;
  fullName: string;
}

export interface AuthApi {
  getSession(): Promise<Session | null>;
  onChange(callback: (session: Session | null) => void): () => void;
  signUp(email: string, password: string, fullName: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** App Store 5.1.1(v) — удаление аккаунта обязано быть внутри приложения (D-018). */
  deleteAccount(): Promise<void>;
}

/** Единые сообщения об ошибках: коды Supabase показывать пользователю нельзя. */
export function authErrorMessage(raw: string): string {
  const normalized = raw.toLowerCase();
  if (normalized.includes('invalid login')) return 'Неверная почта или пароль';
  if (normalized.includes('already registered')) return 'Такой аккаунт уже есть — войдите';
  if (normalized.includes('password')) return 'Пароль должен быть не короче 8 символов';
  if (normalized.includes('email')) return 'Проверьте адрес почты';
  return 'Что-то пошло не так. Попробуйте ещё раз';
}

// ── Supabase ────────────────────────────────────────────────
const supabaseAuth: AuthApi = {
  async getSession() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return {
      userId: user.id,
      email: user.email ?? '',
      fullName: (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? '',
    };
  },

  onChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      callback(
        user
          ? {
              userId: user.id,
              email: user.email ?? '',
              fullName: (user.user_metadata?.full_name as string) ?? '',
            }
          : null,
      );
    });
    return () => data.subscription.unsubscribe();
  },

  async signUp(email, password, fullName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw new Error(error.message);
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    // scope: 'local' — выходим только с этого устройства.
    // «Выйти везде» будет отдельной кнопкой в настройках.
    await supabase.auth.signOut({ scope: 'local' });
  },

  async deleteAccount() {
    // Вся логика в RPC: передача владения кухнями или их удаление,
    // затем удаление auth.users каскадом (0003_functions.sql).
    const { error } = await supabase.rpc('delete_account');
    if (error) throw new Error(error.message);
    await supabase.auth.signOut({ scope: 'local' });
  },
};

// ── Демо ────────────────────────────────────────────────────
const DEMO_SESSION_KEY = 'pantrysync:demo:session';
const listeners = new Set<(session: Session | null) => void>();

function readDemoSession(): Session | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeDemoSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* приватный режим — живём без сохранения */
  }
  listeners.forEach((fn) => fn(session));
}

const demoAuth: AuthApi = {
  async getSession() {
    return readDemoSession();
  },

  onChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  async signUp(email, _password, fullName) {
    writeDemoSession({ userId: 'demo-user', email, fullName: fullName || email.split('@')[0]! });
  },

  async signIn(email) {
    // Демо не проверяет пароль: база не подключена, проверять нечем.
    // Это единственное место, где демо ведёт себя принципиально иначе.
    writeDemoSession({ userId: 'demo-user', email, fullName: email.split('@')[0]! });
  },

  async signOut() {
    writeDemoSession(null);
  },

  async deleteAccount() {
    writeDemoSession(null);
  },
};

export const auth: AuthApi = hasSupabaseCredentials ? supabaseAuth : demoAuth;
