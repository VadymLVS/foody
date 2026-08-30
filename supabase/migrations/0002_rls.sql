-- PantrySync · RLS. См. docs/04-security.md §3
-- Правила: RLS на каждой таблице; никаких `for all`;
-- у каждой пишущей политики есть with check.

create or replace function public.is_kitchen_member(k_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from kitchen_members
                 where kitchen_id = k_id and user_id = auth.uid());
$$;

create or replace function public.is_kitchen_owner(k_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from kitchen_members
                 where kitchen_id = k_id and user_id = auth.uid() and role = 'owner');
$$;

revoke all on function public.is_kitchen_member(uuid) from public;
revoke all on function public.is_kitchen_owner(uuid)  from public;
grant execute on function public.is_kitchen_member(uuid) to authenticated;
grant execute on function public.is_kitchen_owner(uuid)  to authenticated;

alter table profiles            enable row level security;
alter table user_settings       enable row level security;
alter table kitchens            enable row level security;
alter table kitchen_members     enable row level security;
alter table categories          enable row level security;
alter table products            enable row level security;
alter table dishes              enable row level security;
alter table dish_ingredients    enable row level security;
alter table dish_favorites      enable row level security;
alter table planned_dishes      enable row level security;
alter table product_suggestions enable row level security;

-- ── profiles ──────────────────────────────────────────────
create policy profiles_select_self on profiles for select using (id = auth.uid());

create policy profiles_select_cokitchen on profiles for select
  using (exists (select 1 from kitchen_members m1
                 join kitchen_members m2 on m1.kitchen_id = m2.kitchen_id
                 where m1.user_id = auth.uid() and m2.user_id = profiles.id));

create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ── user_settings ─────────────────────────────────────────
create policy settings_select on user_settings for select using (user_id = auth.uid());
create policy settings_insert on user_settings for insert with check (user_id = auth.uid());
create policy settings_update on user_settings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── kitchens (INSERT только через create_kitchen) ─────────
create policy kitchens_select on kitchens for select using (public.is_kitchen_member(id));
create policy kitchens_update on kitchens for update
  using (public.is_kitchen_member(id)) with check (public.is_kitchen_member(id));
create policy kitchens_delete on kitchens for delete using (public.is_kitchen_owner(id));

-- owner_id меняется только через transfer_ownership()
create or replace function public.guard_kitchen_owner()
returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id
     and current_setting('pantrysync.allow_owner_change', true) is distinct from 'on' then
    raise exception 'owner_id can only be changed via transfer_ownership()';
  end if;
  return new;
end;
$$;
create trigger t_kitchens_guard_owner before update on kitchens
  for each row execute function public.guard_kitchen_owner();

-- ── kitchen_members (INSERT/UPDATE запрещены: T-2) ────────
create policy members_select on kitchen_members for select
  using (public.is_kitchen_member(kitchen_id));
create policy members_delete on kitchen_members for delete
  using (user_id = auth.uid() or public.is_kitchen_owner(kitchen_id));

-- ── categories ────────────────────────────────────────────
create policy categories_select on categories for select
  using (kitchen_id is null or public.is_kitchen_member(kitchen_id));
create policy categories_insert on categories for insert
  with check (kitchen_id is not null and public.is_kitchen_member(kitchen_id));
create policy categories_update on categories for update
  using (kitchen_id is not null and public.is_kitchen_member(kitchen_id))
  with check (kitchen_id is not null and public.is_kitchen_member(kitchen_id));
create policy categories_delete on categories for delete
  using (kitchen_id is not null and public.is_kitchen_member(kitchen_id));

-- ── products ──────────────────────────────────────────────
create policy products_select on products for select
  using (public.is_kitchen_member(kitchen_id));
create policy products_insert on products for insert
  with check (public.is_kitchen_member(kitchen_id) and created_by = auth.uid() and deleted_at is null);
create policy products_update on products for update
  using (public.is_kitchen_member(kitchen_id))
  with check (public.is_kitchen_member(kitchen_id) and updated_by = auth.uid());
create policy products_delete on products for delete
  using (public.is_kitchen_member(kitchen_id));

-- ── dishes ────────────────────────────────────────────────
create policy dishes_select on dishes for select using (public.is_kitchen_member(kitchen_id));
create policy dishes_insert on dishes for insert
  with check (public.is_kitchen_member(kitchen_id) and created_by = auth.uid());
create policy dishes_update on dishes for update
  using (public.is_kitchen_member(kitchen_id)) with check (public.is_kitchen_member(kitchen_id));
create policy dishes_delete on dishes for delete using (public.is_kitchen_member(kitchen_id));

-- ── dish_ingredients ──────────────────────────────────────
create policy ingredients_select on dish_ingredients for select
  using (exists (select 1 from dishes d where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));
create policy ingredients_insert on dish_ingredients for insert
  with check (exists (select 1 from dishes d where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));
create policy ingredients_update on dish_ingredients for update
  using (exists (select 1 from dishes d where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)))
  with check (exists (select 1 from dishes d where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));
create policy ingredients_delete on dish_ingredients for delete
  using (exists (select 1 from dishes d where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));

-- ── dish_favorites (личное) ───────────────────────────────
create policy favorites_select on dish_favorites for select using (user_id = auth.uid());
create policy favorites_insert on dish_favorites for insert
  with check (user_id = auth.uid()
              and exists (select 1 from dishes d where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));
create policy favorites_delete on dish_favorites for delete using (user_id = auth.uid());

-- ── planned_dishes (читают все на кухне, пишет каждый своё) ─
create policy planned_select on planned_dishes for select
  using (public.is_kitchen_member(kitchen_id));
create policy planned_insert on planned_dishes for insert
  with check (public.is_kitchen_member(kitchen_id) and user_id = auth.uid());
create policy planned_delete on planned_dishes for delete using (user_id = auth.uid());

-- ── product_suggestions ───────────────────────────────────
create policy suggestions_select on product_suggestions for select
  to authenticated using (true);
