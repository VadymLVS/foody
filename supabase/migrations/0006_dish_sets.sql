-- PantrySync · 0006 · Наборы блюд (backlog п. 23, D-053…D-056)
--
-- Набор = блюда + продукты без блюда (уголь, вода для пикника).
-- Наборы общие для кухни. Применённые наборы — личные, как planned_dishes.
--
-- Применить набор: его блюда добавляются к плану, продукты без блюда переходят
-- в «Купить», их количество прибавляется. Приложение запоминает, что именно
-- изменило, и при снятии набора возвращает как было (кроме уже купленного).
--
-- Выполнять один раз в SQL Editor после 0001–0005. Повторный запуск безопасен.

-- ── Таблицы ───────────────────────────────────────────────
create table if not exists dish_sets (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  library_key text,          -- готовый набор из справочника приложения
  deleted_at  timestamptz,   -- у готового набора удаление = скрыть из справочника
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dish_sets_kitchen on dish_sets (kitchen_id) where deleted_at is null;

create table if not exists dish_set_dishes (
  set_id  uuid not null references dish_sets(id) on delete cascade,
  dish_id uuid not null references dishes(id) on delete cascade,
  primary key (set_id, dish_id)
);

create table if not exists dish_set_products (
  set_id     uuid not null references dish_sets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity   numeric(10,2) check (quantity is null or (quantity > 0 and quantity <= 100000)),
  primary key (set_id, product_id)
);

-- Применённые наборы: каждый участник кухни применяет свои
create table if not exists planned_sets (
  id         uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  set_id     uuid not null references dish_sets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kitchen_id, user_id, set_id)
);

-- Что применение набора сделало с продуктом — чтобы вернуть при снятии
create table if not exists planned_set_products (
  planned_set_id uuid not null references planned_sets(id) on delete cascade,
  product_id     uuid not null references products(id) on delete cascade,
  flipped        boolean not null,            -- был «в наличии», набор перевёл в «Купить»
  prev_quantity  numeric(10,2) not null default 0,
  added_quantity numeric(10,2) not null default 0,
  primary key (planned_set_id, product_id)
);

-- Из какого набора блюдо попало в план. null — выбрано вручную
alter table planned_dishes
  add column if not exists planned_set_id uuid references planned_sets(id) on delete set null;

drop trigger if exists t_dish_sets_touch on dish_sets;
create trigger t_dish_sets_touch before update on dish_sets
  for each row execute function public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────
alter table dish_sets            enable row level security;
alter table dish_set_dishes      enable row level security;
alter table dish_set_products    enable row level security;
alter table planned_sets         enable row level security;
alter table planned_set_products enable row level security;

drop policy if exists sets_select on dish_sets;
drop policy if exists sets_insert on dish_sets;
drop policy if exists sets_update on dish_sets;
drop policy if exists sets_delete on dish_sets;
create policy sets_select on dish_sets for select using (public.is_kitchen_member(kitchen_id));
create policy sets_insert on dish_sets for insert
  with check (public.is_kitchen_member(kitchen_id) and created_by = auth.uid());
create policy sets_update on dish_sets for update
  using (public.is_kitchen_member(kitchen_id)) with check (public.is_kitchen_member(kitchen_id));
create policy sets_delete on dish_sets for delete using (public.is_kitchen_member(kitchen_id));

drop policy if exists set_dishes_select on dish_set_dishes;
drop policy if exists set_dishes_insert on dish_set_dishes;
drop policy if exists set_dishes_delete on dish_set_dishes;
create policy set_dishes_select on dish_set_dishes for select
  using (exists (select 1 from dish_sets s where s.id = set_id and public.is_kitchen_member(s.kitchen_id)));
create policy set_dishes_insert on dish_set_dishes for insert
  with check (exists (select 1 from dish_sets s where s.id = set_id and public.is_kitchen_member(s.kitchen_id))
              and exists (select 1 from dishes d join dish_sets s on s.kitchen_id = d.kitchen_id
                          where d.id = dish_id and s.id = set_id));
create policy set_dishes_delete on dish_set_dishes for delete
  using (exists (select 1 from dish_sets s where s.id = set_id and public.is_kitchen_member(s.kitchen_id)));

drop policy if exists set_products_select on dish_set_products;
drop policy if exists set_products_insert on dish_set_products;
drop policy if exists set_products_delete on dish_set_products;
create policy set_products_select on dish_set_products for select
  using (exists (select 1 from dish_sets s where s.id = set_id and public.is_kitchen_member(s.kitchen_id)));
create policy set_products_insert on dish_set_products for insert
  with check (exists (select 1 from dish_sets s where s.id = set_id and public.is_kitchen_member(s.kitchen_id))
              and exists (select 1 from products p join dish_sets s on s.kitchen_id = p.kitchen_id
                          where p.id = product_id and s.id = set_id));
create policy set_products_delete on dish_set_products for delete
  using (exists (select 1 from dish_sets s where s.id = set_id and public.is_kitchen_member(s.kitchen_id)));

-- Применённые наборы только читаются напрямую; пишут их функции ниже,
-- потому что применение меняет сразу план и продукты — одной транзакцией
drop policy if exists planned_sets_select on planned_sets;
create policy planned_sets_select on planned_sets for select using (public.is_kitchen_member(kitchen_id));

drop policy if exists planned_set_products_select on planned_set_products;
create policy planned_set_products_select on planned_set_products for select
  using (exists (select 1 from planned_sets ps where ps.id = planned_set_id and ps.user_id = auth.uid()));

-- planned_dishes: вставка «on conflict do nothing» не требует политики update,
-- но перепривязка блюда к другому набору при снятии идёт внутри функций

-- ── Функции ───────────────────────────────────────────────

-- Применить набор к своему плану. Возвращает id применения.
create or replace function public.apply_dish_set(p_set uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_kitchen uuid;
  v_ps      uuid;
  r         record;
begin
  select kitchen_id into v_kitchen from dish_sets where id = p_set and deleted_at is null;
  if v_kitchen is null or not public.is_kitchen_member(v_kitchen) then
    raise exception 'set_not_found';
  end if;

  select id into v_ps from planned_sets
   where kitchen_id = v_kitchen and user_id = auth.uid() and set_id = p_set;
  if v_ps is not null then
    return v_ps;                                   -- уже применён: ничего не удваиваем
  end if;

  insert into planned_sets (kitchen_id, user_id, set_id)
  values (v_kitchen, auth.uid(), p_set) returning id into v_ps;

  -- Блюда: уже выбранные остаются как были (вручную или от другого набора)
  insert into planned_dishes (kitchen_id, user_id, dish_id, planned_set_id)
  select v_kitchen, auth.uid(), sd.dish_id, v_ps
    from dish_set_dishes sd
    join dishes d on d.id = sd.dish_id and d.deleted_at is null
   where sd.set_id = p_set
  on conflict (kitchen_id, user_id, dish_id) do nothing;

  -- Продукты без блюда: в «Купить», количество прибавляется
  for r in
    select sp.product_id, coalesce(sp.quantity, 0) as qty, p.in_stock, p.quantity as cur
      from dish_set_products sp
      join products p on p.id = sp.product_id and p.deleted_at is null
     where sp.set_id = p_set
  loop
    if r.in_stock then
      -- Было «в наличии»: теперь «купить», количество — сколько нужно набору
      update products set in_stock = false, quantity = r.qty, updated_by = auth.uid()
       where id = r.product_id;
      insert into planned_set_products (planned_set_id, product_id, flipped, prev_quantity, added_quantity)
      values (v_ps, r.product_id, true, r.cur, r.qty);
    else
      update products set quantity = least(quantity + r.qty, 100000), updated_by = auth.uid()
       where id = r.product_id;
      insert into planned_set_products (planned_set_id, product_id, flipped, prev_quantity, added_quantity)
      values (v_ps, r.product_id, false, 0, r.qty);
    end if;
  end loop;

  return v_ps;
end $$;

-- Снять применённый набор: вернуть план и продукты как были
create or replace function public.remove_planned_set(p_planned_set uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_kitchen uuid;
  r         record;
  v_other   uuid;
begin
  select kitchen_id into v_kitchen from planned_sets
   where id = p_planned_set and user_id = auth.uid();
  if v_kitchen is null then
    raise exception 'planned_set_not_found';
  end if;

  -- Блюдо, которое есть и в другом применённом наборе, переходит к нему, а не уходит
  update planned_dishes pd
     set planned_set_id = (
       select ps.id from planned_sets ps
         join dish_set_dishes sd on sd.set_id = ps.set_id and sd.dish_id = pd.dish_id
        where ps.kitchen_id = v_kitchen and ps.user_id = auth.uid() and ps.id <> p_planned_set
        order by ps.created_at limit 1)
   where pd.planned_set_id = p_planned_set
     and exists (
       select 1 from planned_sets ps
         join dish_set_dishes sd on sd.set_id = ps.set_id and sd.dish_id = pd.dish_id
        where ps.kitchen_id = v_kitchen and ps.user_id = auth.uid() and ps.id <> p_planned_set);

  delete from planned_dishes where planned_set_id = p_planned_set;

  for r in
    select psp.*, p.in_stock
      from planned_set_products psp
      join products p on p.id = psp.product_id
     where psp.planned_set_id = p_planned_set
  loop
    -- Уже куплено — не трогаем
    continue when r.in_stock;

    update products set quantity = greatest(quantity - r.added_quantity, 0), updated_by = auth.uid()
     where id = r.product_id;

    if r.flipped then
      -- Если продукт нужен ещё одному набору, «вернуть в наличие» перейдёт к нему
      select psp2.planned_set_id into v_other
        from planned_set_products psp2
        join planned_sets ps on ps.id = psp2.planned_set_id
       where psp2.product_id = r.product_id and psp2.planned_set_id <> p_planned_set
         and ps.user_id = auth.uid()
       order by ps.created_at limit 1;

      if v_other is not null then
        update planned_set_products
           set flipped = true, prev_quantity = r.prev_quantity
         where planned_set_id = v_other and product_id = r.product_id;
      else
        update products set in_stock = true, quantity = r.prev_quantity, updated_by = auth.uid()
         where id = r.product_id;
      end if;
    end if;
  end loop;

  delete from planned_sets where id = p_planned_set;
end $$;

-- Очистить свой план: все наборы с возвратом продуктов, затем все блюда
create or replace function public.clear_plan(p_kitchen uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_kitchen_member(p_kitchen) then
    raise exception 'not_a_member';
  end if;
  for r in
    select id from planned_sets
     where kitchen_id = p_kitchen and user_id = auth.uid()
     order by created_at desc
  loop
    perform public.remove_planned_set(r.id);
  end loop;
  delete from planned_dishes where kitchen_id = p_kitchen and user_id = auth.uid();
end $$;

do $$
declare fn text;
begin
  foreach fn in array array['apply_dish_set(uuid)', 'remove_planned_set(uuid)', 'clear_plan(uuid)'] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- ── Справочник: продукты для пикника ──────────────────────
insert into product_suggestions (key, category_key, unit) values
  ('charcoal','household','pack'), ('napkins','household','pack'),
  ('disposable_tableware','household','pack')
on conflict (key) do nothing;
