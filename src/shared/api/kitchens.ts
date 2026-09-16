import { supabase, hasSupabaseCredentials } from './supabase';
import { DEMO_KITCHEN_ID } from './demo';
import type { Member, Role } from '@/shared/db/types';

export interface KitchenSummary {
  id: string;
  name: string;
  role: Role;
  memberCount: number;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  invitesEnabled: boolean;
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
    const { data, error } = await supabase
      .from('kitchen_members')
      .select('role, kitchens(id, name, invite_code, invite_expires_at, invites_enabled)');
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<{
      role: Role;
      kitchens: {
        id: string; name: string; invite_code: string;
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
        // Код приглашения показываем только владельцу: участнику он не нужен,
        // а лишняя копия ссылки — лишний путь утечки (T-5).
        inviteCode: row.role === 'owner' ? row.kitchens!.invite_code : null,
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
    const { data, error } = await supabase
      .from('kitchen_members')
      .select('kitchen_id, user_id, role, joined_at, profiles(id, email, full_name, avatar_url)')
      .eq('kitchen_id', id)
      .order('joined_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...(row as unknown as Member),
      profile: row.profiles as Member['profile'],
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
const demoKitchens: KitchensApi = {
  async list() {
    return [
      {
        id: DEMO_KITCHEN_ID,
        name: 'Дом',
        role: 'owner',
        memberCount: 2,
        inviteCode: 'demo-invite-code',
        inviteExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        invitesEnabled: true,
      },
    ];
  },
  async create() { return DEMO_KITCHEN_ID; },
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
        kitchen_id: DEMO_KITCHEN_ID, user_id: 'demo-arina', role: 'member',
        joined_at: new Date().toISOString(),
        profile: { id: 'demo-arina', email: 'arina@example.com', full_name: 'Арина', avatar_url: null },
      },
    ];
  },
  async removeMember() {},
  async leave() {},
  async peekInvite() { return { kitchenName: 'Дом', ownerName: 'Вы' }; },
  async join() { return DEMO_KITCHEN_ID; },
  async regenerateInvite() { return 'demo-invite-code'; },
};

export const kitchens: KitchensApi = hasSupabaseCredentials ? supabaseKitchens : demoKitchens;
