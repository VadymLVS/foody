import type { Repo } from './repo';
import { demoRepo, DEMO_KITCHEN_ID } from './demo';
import { supabaseRepo } from './supabaseRepo';
import { hasSupabaseCredentials } from './supabase';

/**
 * Выбор реализации. Нет ключей — работаем на демо-данных,
 * а не падаем с белым экраном. Тот же режим понадобится ревьюеру
 * App Store (Guideline 2.1, см. 05-store-readiness.md §4).
 */
export const repo: Repo = hasSupabaseCredentials ? supabaseRepo : demoRepo;

export { DEMO_KITCHEN_ID };
export type { Repo, NewProduct, ProductPatch, RealtimeEvent } from './repo';
export { qk } from './keys';
export { auth, authErrorMessage, type Session } from './auth';
export { kitchens, inviteUrl, formatExpiry, type KitchenSummary } from './kitchens';
export { hasSupabaseCredentials } from './supabase';
