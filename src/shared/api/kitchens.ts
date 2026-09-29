import { supabase, hasSupabaseCredentials } from './supabase';
import { DEMO_KITCHEN_ID } from './demo';
import type { Member, Role } from '@/shared/db/types';

export interface KitchenSummary {
  id: string;
  name: string;
  role: Role;
  memberCount: number;
  inviteExpiresAt: string | null;
  invitesEnabled: boolean;
}

/**
 * Код приглашения больше не приходит вместе с кухней: столбец закрыт
 * правами, его отдаёт RPC и только владельцу (обзор 09-26, B-3).
 */
export interface Invite {
  code: string;
  expiresAt: string | null;
}

export interface InvitePreview {
  kitchenName: string;
  ownerName: string;
}

export interface KitchensApi {
  list(): Promise<KitchenSummary[]>;
  create(name: string): Promise<string>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  listMembers(id: string): Promise<Member[]>;
  removeMember(id: string, userId: string): Promise<void>;
  leave(id: string): Promise<void>;
  invite(id: string): Promise<Invite | null>;
  peekInvite(code: string): Promise<InvitePreview | null>;
  join(code: string): Promise<string>;
  regenerateInvite(id: string): Promise<string>;
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/** Человеческая дата истечения приглашения, без библиотек. */
export function formatExpiry(iso: string | null): string {
  if (!iso) return 'Бессрочно';
  const date = new Date(iso);
  if (date.getTime() < Date.now()) return 'Срок истёк';
  return `Действует до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
}

// ── Supabase ────────────────────────────────────────────────
const supabaseKitchens: KitchensApi = {
  async list() {
    /*
     * Только свои строки членства. RLS отдаёт строки всех участников моих кухонь,
     * и без фильтра кухня с двумя участниками приходила дважды, а роль могла
     * оказаться чужой («вы владелец» у участника) — найдено 09-20.
     */
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return [];
    const { data, error } = await supabase
      .from('kitchen_members')
      .select('role, kitchens(id, name, invite_expires_at, invites_enabled)')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<{
      role: Role;
      kitchens: {
        id: string; name: string;
        invite_expires_at: string | null; invites_enabled: boolean;
      } | null;
    }>;

    const summaries = rows
      .filter((row) => row.kitchens !== null)
      .map((row) => ({
        id: row.kitchens!.id,
        name: row.kitchens!.name,
        role: row.role,
        memberCount: 0,
        inviteExpiresAt: row.kitchens!.invite_expires_at,
        invitesEnabled: row.kitchens!.invites_enabled,
      }));

    // Число участников считаем одним запросом, а не по кухне на каждую.
    const counts = await supabase
      .from('kitchen_members')
      .select('kitchen_id')
      .in('kitchen_id', summaries.map((s) => s.id));

    const tally = new Map<string, number>();
    for (const row of (counts.data ?? []) as Array<{ kitchen_id: string }>) {
      tally.set(row.kitchen_id, (tally.get(row.kitchen_id) ?? 0) + 1);
    }
    return summaries.map((s) => ({ ...s, memberCount: tally.get(s.id) ?? 1 }));
  },

  async create(name) {
    // Через RPC: прямой INSERT не пройдёт RLS — на момент вставки
    // пользователь ещё не член кухни (0003_functions.sql).
    const { data, error } = await supabase.rpc('create_kitchen', { p_name: name });
    if (error) throw new Error(error.message);
    return data as string;
  },

  async rename(id, name) {
    const { error } = await supabase.from('kitchens').update({ name }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async remove(id) {
    const { error } = await supabase.from('kitchens').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listMembers(id) {
    // RPC вместо запроса к profiles: чужую почту база больше не отдаёт (B-6)
    const { data, error } = await supabase.rpc('kitchen_people', { p_kitchen: id });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      user_id: string; role: Role; joined_at: string;
      full_name: string | null; avatar_url: string | null; email: string | null;
    }>;
    return rows.map<Member>((row) => ({
      kitchen_id: id,
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      profile: {
        id: row.user_id,
        email: row.email ?? '',
        full_name: row.full_name,
        avatar_url: row.avatar_url,
      },
    }));
  },

  async removeMember(id, userId) {
    const { error } = await supabase
      .from('kitchen_members')
      .delete()
      .eq('kitchen_id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  async leave(id) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('unauthorized');
    const { error } = await supabase
      .from('kitchen_members')
      .delete()
      .eq('kitchen_id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  async invite(id) {
    const { data, error } = await supabase.rpc('kitchen_invite', { p_kitchen: id });
    if (error) throw new Error(error.message);
    const row = (data as Array<{ invite_code: string; invite_expires_at: string | null }>)?.[0];
    return row ? { code: row.invite_code, expiresAt: row.invite_expires_at } : null;
  },

  async peekInvite(code) {
    // RPC отдаёт только название кухни и имя владельца — и только
    // по действующему коду (T-12).
    const { data, error } = await supabase.rpc('peek_invite', { p_code: code });
    if (error) throw new Error(error.message);
    const row = (data as Array<{ kitchen_name: string; owner_name: string }>)?.[0];
    return row ? { kitchenName: row.kitchen_name, ownerName: row.owner_name } : null;
  },

  async join(code) {
    const { data, error } = await supabase.rpc('join_kitchen', { p_code: code });
    if (error) throw new Error(error.message);
    return data as string;
  },

  async regenerateInvite(id) {
    const { data, error } = await supabase.rpc('regenerate_invite', { p_kitchen: id });
    if (error) throw new Error(error.message);
    return data as string;
  },
};

// ── Демо ────────────────────────────────────────────────────
/**
 * Флаг «новый пользователь» для проверки первого входа в демо (п. 34):
 * без него демо всегда подставляло кухню, и отсутствие кухни не ловилось.
 */
const DEMO_FRESH = 'pantrysync:demo:fresh-user';
const demoFresh = () => {
  try { return localStorage.getItem(DEMO_FRESH) === '1'; } catch { return false; }
};

const demoKitchens: KitchensApi = {
  async list() {
    if (demoFresh()) return [];
    return [
      {
        id: DEMO_KITCHEN_ID,
        name: 'Дом',
        role: 'owner',
        memberCount: 2,
        inviteExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        invitesEnabled: true,
      },
    ];
  },
  async create() {
    try { localStorage.removeItem(DEMO_FRESH); } catch { /* приватный режим */ }
    return DEMO_KITCHEN_ID;
  },
  async rename() {},
  async remove() {},
  async listMembers() {
    return [
      {
        kitchen_id: DEMO_KITCHEN_ID, user_id: 'demo-user', role: 'owner',
        joined_at: new Date().toISOString(),
        profile: { id: 'demo-user', email: 'you@example.com', full_name: 'Вы', avatar_url: null },
      },
      {
        kitchen_id: DEMO_KITCHEN_ID, user_id: 'demo-alina', role: 'member',
        joined_at: new Date().toISOString(),
        profile: { id: 'demo-alina', email: 'alina@example.com', full_name: 'Алина', avatar_url: null },
      },
    ];
  },
  async removeMember() {},
  async leave() {},
  async invite() {
    return { code: 'demo-invite-code', expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() };
  },
  async peekInvite() { return { kitchenName: 'Дом', ownerName: 'Вы' }; },
  async join() {
    try { localStorage.removeItem(DEMO_FRESH); } catch { /* приватный режим */ }
    return DEMO_KITCHEN_ID;
  },
  async regenerateInvite() { return 'demo-invite-code'; },
};

export const kitchens: KitchensApi = hasSupabaseCredentials ? supabaseKitchens : demoKitchens;
