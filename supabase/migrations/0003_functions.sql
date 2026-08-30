-- PantrySync · RPC. Всё, что клиент не может сделать безопасно.
-- Каждая функция: security definer + set search_path + revoke/grant.

-- ── Создание кухни ────────────────────────────────────────
create or replace function public.create_kitchen(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare k_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if char_length(coalesce(trim(p_name), '')) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if (select count(*) from kitchen_members where user_id = auth.uid()) >= 20 then
    raise exception 'kitchen_limit_reached';
  end if;

  insert into kitchens (name, owner_id) values (trim(p_name), auth.uid())
  returning id into k_id;
  insert into kitchen_members (kitchen_id, user_id, role) values (k_id, auth.uid(), 'owner');

  -- системные категории копируются в кухню, иначе фильтры пустые
  insert into categories (kitchen_id, kind, key, sort_order)
  select k_id, kind, key, sort_order from categories where kitchen_id is null;

  return k_id;
end;
$$;

-- ── Приглашения ───────────────────────────────────────────
create or replace function public.peek_invite(p_code uuid)
returns table (kitchen_name text, owner_name text)
language sql security definer set search_path = public stable as $$
  select k.name, p.full_name
  from kitchens k join profiles p on p.id = k.owner_id
  where k.invite_code = p_code and k.invites_enabled
    and (k.invite_expires_at is null or k.invite_expires_at > now());
$$;

create or replace function public.join_kitchen(p_code uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare k_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select id into k_id from kitchens
   where invite_code = p_code and invites_enabled
     and (invite_expires_at is null or invite_expires_at > now());
  if k_id is null then raise exception 'invalid_or_expired_invite'; end if;
  if (select count(*) from kitchen_members where kitchen_id = k_id) >= 20 then
    raise exception 'member_limit_reached';
  end if;
  insert into kitchen_members (kitchen_id, user_id, role)
  values (k_id, auth.uid(), 'member') on conflict do nothing;
  return k_id;
end;
$$;

create or replace function public.regenerate_invite(p_kitchen uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_code uuid;
begin
  if not public.is_kitchen_owner(p_kitchen) then raise exception 'forbidden'; end if;
  update kitchens set invite_code = gen_random_uuid(),
                      invite_expires_at = now() + interval '7 days'
   where id = p_kitchen returning invite_code into new_code;
  return new_code;
end;
$$;

create or replace function public.transfer_ownership(p_kitchen uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_kitchen_owner(p_kitchen) then raise exception 'forbidden'; end if;
  if not exists (select 1 from kitchen_members
                 where kitchen_id = p_kitchen and user_id = p_new_owner) then
    raise exception 'not_a_member';
  end if;
  update kitchen_members set role = 'member' where kitchen_id = p_kitchen and role = 'owner';
  update kitchen_members set role = 'owner'  where kitchen_id = p_kitchen and user_id = p_new_owner;
  perform set_config('pantrysync.allow_owner_change', 'on', true);
  update kitchens set owner_id = p_new_owner where id = p_kitchen;
  perform set_config('pantrysync.allow_owner_change', 'off', true);
end;
$$;

-- ── Удаление аккаунта (App Store 5.1.1(v)) ────────────────
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare k record; heir uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  for k in select kitchen_id from kitchen_members where user_id = auth.uid() and role = 'owner'
  loop
    select user_id into heir from kitchen_members
     where kitchen_id = k.kitchen_id and user_id <> auth.uid()
     order by joined_at limit 1;
    if heir is null then delete from kitchens where id = k.kitchen_id;
    else perform public.transfer_ownership(k.kitchen_id, heir); end if;
  end loop;
  delete from kitchen_members where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- ── Колода для карусели (D-020) ───────────────────────────
-- Сначала полностью готовые, внутри — те, что давно не выбирались.
-- Блюда, где не хватает трёх и более позиций, не показываются.
create or replace function public.swipe_deck(p_kitchen uuid, p_limit int default 20)
returns table (
  dish_id uuid, name text, image_path text, library_key text,
  image_w int, image_h int,
  missing_count int, missing_names text[], last_planned timestamptz, is_favorite boolean
)
language sql security definer set search_path = public stable as $$
  with mine as (
    select d.id, d.name, d.image_path, d.library_key, d.image_w, d.image_h
    from dishes d
    where d.kitchen_id = p_kitchen and d.deleted_at is null
      and public.is_kitchen_member(p_kitchen)
      and not exists (select 1 from planned_dishes pd
                      where pd.dish_id = d.id and pd.user_id = auth.uid())
  ),
  miss as (
    select m.id,
           count(i.id) filter (
             where i.product_id is null
                or not exists (select 1 from products p
                               where p.id = i.product_id and p.in_stock and p.deleted_at is null)
           )::int as mc,
           array_remove(array_agg(i.product_name) filter (
             where i.product_id is null
                or not exists (select 1 from products p
                               where p.id = i.product_id and p.in_stock and p.deleted_at is null)
           ), null) as mn
    from mine m left join dish_ingredients i on i.dish_id = m.id
    group by m.id
  ),
  used as (
    select dish_id, max(created_at) as last_planned
    from planned_dishes where kitchen_id = p_kitchen group by dish_id
  )
  select m.id, m.name, m.image_path, m.library_key, m.image_w, m.image_h,
         coalesce(x.mc, 0), coalesce(x.mn, '{}'), u.last_planned,
         exists (select 1 from dish_favorites f where f.dish_id = m.id and f.user_id = auth.uid())
  from mine m
  join miss x on x.id = m.id
  left join used u on u.dish_id = m.id
  where coalesce(x.mc, 0) <= 2
  order by (coalesce(x.mc, 0) > 0),
           coalesce(u.last_planned, timestamptz '1970-01-01'),
           random()
  limit greatest(1, least(p_limit, 50));
$$;

-- ── Что нужно купить для плана (D-031, D-032) ─────────────
-- Складывает потребности всех участников кухни по каждому продукту.
create or replace function public.plan_needs(p_kitchen uuid)
returns table (
  product_id uuid, product_name text, unit unit_code,
  total_quantity numeric, dish_count int, dishes jsonb
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.name, p.unit,
    nullif(sum(coalesce(i.quantity, 0)), 0) as total_quantity,
    count(distinct d.id)::int as dish_count,
    jsonb_agg(distinct jsonb_build_object(
      'dish', d.name,
      'quantity', i.quantity,
      'owner', case when pd.user_id = auth.uid() then null else pr.full_name end
    )) as dishes
  from planned_dishes pd
  join dishes d           on d.id = pd.dish_id and d.deleted_at is null
  join dish_ingredients i on i.dish_id = d.id
  join products p         on p.id = i.product_id and p.deleted_at is null
  join profiles pr        on pr.id = pd.user_id
  where pd.kitchen_id = p_kitchen
    and public.is_kitchen_member(p_kitchen)
    and not p.in_stock
  group by p.id, p.name, p.unit;
$$;

-- ── Права ─────────────────────────────────────────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'create_kitchen(text)', 'peek_invite(uuid)', 'join_kitchen(uuid)',
    'regenerate_invite(uuid)', 'transfer_ownership(uuid,uuid)',
    'delete_account()', 'swipe_deck(uuid,int)', 'plan_needs(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
