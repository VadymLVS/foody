-- PantrySync · 0008 · Предрелизные блокеры безопасности и целостности данных
-- (обзор claude/pantrysync-review-2026-09-26.md: B-1, B-2, B-3, B-6, R-1, R-2, R-4)
--
-- Выполнять в SQL Editor Supabase ПЕРЕД заливкой кода v0.15.
-- Повторный запуск безопасен: файл идемпотентен целиком.
--
-- Что закрывает:
--   B-1  участник кухни мог подменить код приглашения и его срок обычным UPDATE
--   B-2  своё «что готовим» принимало чужое блюдо — и чужой продукт попадал в список покупок
--   B-3  код приглашения приходил в клиент всем участникам, не только владельцу
--   B-6  адреса почты соседей по кухне были видны каждому участнику
--   R-1  plan_needs удваивал количество, когда одно блюдо выбрали двое
--   R-2  повторный прогон 0005 плодил системные категории (18 → 36)
--   R-4  0007 мог быть не выполнен: его изменения повторены здесь

begin;

-- ══ R-4 · Страховка: содержимое 0007, если он не выполнялся ══
alter table dishes
  add column if not exists recipe text check (recipe is null or char_length(recipe) <= 5000);

alter table user_settings
  add column if not exists diet text
    check (diet is null or diet in ('omnivore', 'pescatarian', 'vegetarian', 'vegan'));
alter table user_settings
  add column if not exists diet_excludes text[] not null default '{}';

grant execute on function public.peek_invite(uuid) to anon;

-- ══ R-2 · Дубли категорий ═══════════════════════════════════
-- Причина: в 0005 стоит «on conflict do nothing», но уникального
-- ограничения по (kind, key) не было, и второй прогон вставлял всё заново.
-- Сначала убираем дубли (и системные, и их копии в кухнях), потом ставим
-- индексы, после которых повторный прогон 0005 действительно ничего не делает.

-- Копии в кухнях: ссылки продуктов и блюд переводим на самую раннюю категорию
with ranked as (
  select id,
         first_value(id) over w as keep_id,
         row_number()    over w as rn
    from categories
   where kitchen_id is not null and key is not null
  window w as (partition by kitchen_id, kind, key order by created_at, id)
)
update products p set category_id = r.keep_id
  from ranked r
 where p.category_id = r.id and r.rn > 1;

with ranked as (
  select id,
         first_value(id) over w as keep_id,
         row_number()    over w as rn
    from categories
   where kitchen_id is not null and key is not null
  window w as (partition by kitchen_id, kind, key order by created_at, id)
)
update dishes d set category_id = r.keep_id
  from ranked r
 where d.category_id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by kitchen_id, kind, key order by created_at, id) as rn
    from categories
   where kitchen_id is not null and key is not null
)
delete from categories c using ranked r where c.id = r.id and r.rn > 1;

-- Системные (kitchen_id is null): на них продукты не ссылаются — в кухне своя копия
with ranked as (
  select id, row_number() over (partition by kind, key order by created_at, id) as rn
    from categories
   where kitchen_id is null and key is not null
)
delete from categories c using ranked r where c.id = r.id and r.rn > 1;

create unique index if not exists categories_system_key_uniq
  on categories (kind, key) where kitchen_id is null and key is not null;
create unique index if not exists categories_kitchen_key_uniq
  on categories (kitchen_id, kind, key) where kitchen_id is not null and key is not null;

-- ══ B-1 · Код приглашения не меняется обычным UPDATE ════════
-- Участник кухни может переименовать её (кухня общая), но не трогать
-- приглашение. Раньше он мог поставить свой код и срок «на сто лет».
--
-- Два рубежа: права на столбцы (проверяются до RLS) и триггер —
-- чтобы дыра не вернулась, если права когда-нибудь выдадут заново.
revoke update on table kitchens from authenticated;
revoke update on table kitchens from anon;
grant  update (name) on table kitchens to authenticated;

create or replace function public.guard_kitchen_invite()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('pantrysync.allow_invite_change', true), 'off') = 'on' then
    return new;
  end if;
  if new.invite_code       is distinct from old.invite_code
  or new.invite_expires_at is distinct from old.invite_expires_at
  or new.invites_enabled   is distinct from old.invites_enabled then
    raise exception 'invite settings can only be changed via regenerate_invite()';
  end if;
  return new;
end;
$$;

drop trigger if exists t_kitchens_guard_invite on kitchens;
create trigger t_kitchens_guard_invite before update on kitchens
  for each row execute function public.guard_kitchen_invite();

-- Единственный законный путь смены кода — RPC владельца
create or replace function public.regenerate_invite(p_kitchen uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_code uuid;
begin
  if not public.is_kitchen_owner(p_kitchen) then raise exception 'forbidden'; end if;
  perform set_config('pantrysync.allow_invite_change', 'on', true);
  update kitchens set invite_code = gen_random_uuid(),
                      invite_expires_at = now() + interval '7 days'
   where id = p_kitchen returning invite_code into new_code;
  perform set_config('pantrysync.allow_invite_change', 'off', true);
  return new_code;
end;
$$;

-- ══ B-3 · Код приглашения не уходит в клиент ════════════════
-- Столбец invite_code больше не читается из таблицы: его отдаёт RPC,
-- и только владельцу. Участнику код не нужен, а лишняя копия ссылки —
-- лишний путь утечки.
revoke select on table kitchens from authenticated;
revoke select on table kitchens from anon;
grant  select (id, name, owner_id, invites_enabled, invite_expires_at, created_at, updated_at)
  on table kitchens to authenticated;

create or replace function public.kitchen_invite(p_kitchen uuid)
returns table (invite_code uuid, invite_expires_at timestamptz, invites_enabled boolean)
language sql security definer set search_path = public stable as $$
  select k.invite_code, k.invite_expires_at, k.invites_enabled
    from kitchens k
   where k.id = p_kitchen and public.is_kitchen_owner(p_kitchen);
$$;

-- ══ B-6 · Почта соседей по кухне ════════════════════════════
-- Раньше политика отдавала участникам весь профиль друг друга, включая почту:
-- по утёкшей ссылке-приглашению можно было собрать адреса. Теперь профиль
-- читает только сам человек, а список участников отдаёт функция — без почты.
drop policy if exists profiles_select_cokitchen on profiles;

create or replace function public.kitchen_people(p_kitchen uuid)
returns table (
  user_id uuid, role text, joined_at timestamptz,
  full_name text, avatar_url text, email text
)
language sql security definer set search_path = public stable as $$
  select m.user_id, m.role, m.joined_at,
         p.full_name, p.avatar_url,
         -- своя почта видна, чужая — нет
         case when m.user_id = auth.uid() then p.email end
    from kitchen_members m
    join profiles p on p.id = m.user_id
   where m.kitchen_id = p_kitchen and public.is_kitchen_member(p_kitchen)
   order by m.joined_at;
$$;

-- ══ B-2 · Чужое блюдо не попадает в свой план ═══════════════
-- Было: with check проверял только членство в кухне из самой строки,
-- а dish_id не сверялся с ней. Вставив чужой dish_id со своей кухней,
-- человек видел чужие продукты в «Купить» через plan_needs.
drop policy if exists planned_insert on planned_dishes;
create policy planned_insert on planned_dishes for insert
  with check (
    public.is_kitchen_member(kitchen_id)
    and user_id = auth.uid()
    and exists (select 1 from dishes d
                 where d.id = dish_id and d.kitchen_id = planned_dishes.kitchen_id)
  );

-- Тот же запрет на уровне данных: функции (apply_dish_set) идут в обход RLS
create or replace function public.guard_planned_kitchen()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from dishes d
                  where d.id = new.dish_id and d.kitchen_id = new.kitchen_id) then
    raise exception 'dish_from_another_kitchen';
  end if;
  return new;
end;
$$;

drop trigger if exists t_planned_guard_kitchen on planned_dishes;
create trigger t_planned_guard_kitchen before insert or update on planned_dishes
  for each row execute function public.guard_planned_kitchen();

-- ══ R-1 · Количество не удваивается ════════════════════════
-- Было: строка на каждую пару (выбор человека × ингредиент). Одно блюдо,
-- выбранное двумя, давало 0.5 + 0.5 = 1 кг при dish_count = 1 — список
-- покупок просил вдвое больше. Теперь блюдо участвует один раз,
-- а «чьё это» собирается отдельно.
--
-- Заодно закреплена кухня: блюда и продукты берутся только из p_kitchen.
create or replace function public.plan_needs(p_kitchen uuid)
returns table (
  product_id uuid, product_name text, unit unit_code,
  total_quantity numeric, dish_count int, dishes jsonb
)
language sql security definer set search_path = public stable as $$
  with plan as (
    select pd.dish_id,
           bool_or(pd.user_id = auth.uid())                                as mine,
           min(pr.full_name) filter (where pd.user_id <> auth.uid())       as other_name
      from planned_dishes pd
      join profiles pr on pr.id = pd.user_id
     where pd.kitchen_id = p_kitchen
     group by pd.dish_id
  )
  select
    p.id, p.name, p.unit,
    nullif(sum(coalesce(i.quantity, 0)), 0) as total_quantity,
    count(distinct d.id)::int               as dish_count,
    jsonb_agg(distinct jsonb_build_object(
      'dish', d.name,
      'quantity', i.quantity,
      'owner', case when pl.mine then null else pl.other_name end
    )) as dishes
  from plan pl
  join dishes d           on d.id = pl.dish_id and d.deleted_at is null
                         and d.kitchen_id = p_kitchen
  join dish_ingredients i on i.dish_id = d.id
  join products p         on p.id = i.product_id and p.deleted_at is null
                         and p.kitchen_id = p_kitchen
  where public.is_kitchen_member(p_kitchen)
    and not p.in_stock
  group by p.id, p.name, p.unit;
$$;

-- ══ Права на новые функции ═════════════════════════════════
do $$
declare fn text;
begin
  foreach fn in array array['kitchen_invite(uuid)', 'kitchen_people(uuid)'] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

commit;
