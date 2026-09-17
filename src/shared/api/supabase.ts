import { createClient } from '@supabase/supabase-js';
import { isNative } from '@/shared/lib/platform';

/**
 * На странице Data API в Supabase показан адрес REST-эндпоинта, а не проекта —
 * он оканчивается на /rest/v1, и скопировать его целиком проще, чем заметить
 * разницу. Клиент дописывает свои пути сам, поэтому хвост надо отрезать:
 * иначе запросы уходят на .../rest/v1/auth/v1/signup и возвращают 404.
 */
const normalizeUrl = (raw: string | undefined): string | undefined =>
  raw?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/auth\/v1$/, '');

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL);
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseCredentials = Boolean(url && anonKey);

if (!hasSupabaseCredentials && import.meta.env.DEV) {
  console.info(
    'PantrySync: ключи Supabase не заданы, работаем на демо-данных. ' +
      'Скопируйте .env.example в .env, чтобы подключить базу.',
  );
}

/**
 * anon key публичен по замыслу — вся защита живёт в RLS.
 * Если RLS где-то не включён, этот ключ открывает всю базу (04-security.md §6).
 *
 * Генерик схемы намеренно не указан: пока типы базы не сгенерированы
 * через `npm run db:types`, заглушка заставляет клиент выводить `never`
 * на каждом insert и update. После генерации — вернуть createClient<Database>.
 *
 * Клиент создаётся всегда, даже без ключей: иначе модуль пришлось бы
 * подгружать асинхронно, а top-level await ради демо-режима — плохая цена.
 * Без ключей до этого клиента просто никто не обращается.
 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  {
    auth: {
      persistSession: hasSupabaseCredentials,
      autoRefreshToken: hasSupabaseCredentials,
      detectSessionInUrl: hasSupabaseCredentials && !isNative(),
      flowType: 'pkce',
    },
    realtime: { params: { eventsPerSecond: 5 } },
  },
);
