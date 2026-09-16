import { useEffect, useState } from 'react';
import { auth, type Session } from '@/shared/api';

/**
 * Сессия как единственный источник правды об авторизации.
 * `loading` нужен, чтобы не мигнуть экраном входа тому, кто уже вошёл.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    void auth.getSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
    });

    const unsubscribe = auth.onChange((s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { session, loading };
}
