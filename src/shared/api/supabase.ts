import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/db/types';
import { isNative } from '@/shared/lib/platform';

const url = import.meta.env.VITE_SUPABASE_URL;
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
 * Клиент создаётся всегда, даже без ключей: иначе модуль пришлось бы
 * подгружать асинхронно, а top-level await ради демо-режима — плохая цена.
 * Без ключей до этого клиента просто никто не обращается.
 */
export const supabase = createClient<Database>(
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
