-- PantrySync · 0009 · Списки покупок (backlog п. 45)
--
-- Выполнять в SQL Editor Supabase ПЕРЕД заливкой кода v0.17.
-- Повторный запуск безопасен.
--
-- Зачем. Все пути к покупкам шли через блюда: карусель, наборы, «Для меню».
-- Это ответ на вопрос «что готовим». Вопроса «что я обычно покупаю» не было,
-- и человек перед магазином открывал фильтр «Купить» на всю кухню.
--
-- Важно: список — это ФИЛЬТР, а не действие. Набор блюд при применении меняет
-- данные (переводит продукты в «Купить», складывает количества). Список ничего
-- не меняет: он сужает выдачу и показывает свои позиции как есть — и те, что
-- есть дома, и те, которых нет. Поэтому это отдельные таблицы, а не dish_sets.
--
-- Количества у позиций списка нет намеренно: количество живёт у продукта
-- (D-030), второе рядом сразу начало бы расходиться с первым.

begin;

-- ── Списки ────────────────────────────────────────────────
-- kind = 'regular' — постоянная заготовка («Обычная закупка»).
-- kind = 'once'    — разовый «купить сейчас»: его создают друг для друга,
--                    он показывается в приоритете и закрывается после поездки.
create table if not exists product_lists (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  kind        text not null default 'regular' check (kind in ('regular', 'once')),
  closed_at   timestamptz,          -- разовый список после поездки; история остаётся
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists product_lists_kitchen on product_lists (kitchen_id);
-- Активный разовый список ищется при каждом запуске — отдельный индекс
create index if not exists product_lists_active_once
  on product_lists (kitchen_id) where kind = 'once' and closed_at is null;

create table if not exists product_list_items (
  list_id    uuid not null references product_lists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, product_id)
);
create index if not exists product_list_items_product on product_list_items (product_id);

drop trigger if exists t_product_lists_touch on product_lists;
create trigger t_product_lists_touch before update on product_lists
  for each row execute function public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────
alter table product_lists      enable row level security;
alter table product_list_items enable row level security;

drop policy if exists lists_select on product_lists;
drop policy if exists lists_insert on product_lists;
drop policy if exists lists_update on product_lists;
drop policy if exists lists_delete on product_lists;
create policy lists_select on product_lists for select
  using (public.is_kitchen_member(kitchen_id));
create policy lists_insert on product_lists for insert
  with check (public.is_kitchen_member(kitchen_id) and created_by = auth.uid());
-- Закрыть список и переименовать может любой участник: список создаёт один
-- человек, а закрывает тот, кто вернулся из магазина
create policy lists_update on product_lists for update
  using (public.is_kitchen_member(kitchen_id))
  with check (public.is_kitchen_member(kitchen_id));
create policy lists_delete on product_lists for delete
  using (public.is_kitchen_member(kitchen_id));

-- Позиции: и список, и продукт обязаны быть из одной кухни — урок B-2,
-- где проверка кухни в строке была, а проверки самой ссылки не было
drop policy if exists list_items_select on product_list_items;
drop policy if exists list_items_insert on product_list_items;
drop policy if exists list_items_delete on product_list_items;
create policy list_items_select on product_list_items for select
  using (exists (select 1 from product_lists l
                  where l.id = list_id and public.is_kitchen_member(l.kitchen_id)));
create policy list_items_insert on product_list_items for insert
  with check (exists (select 1 from product_lists l
                       join products p on p.kitchen_id = l.kitchen_id
                      where l.id = list_id and p.id = product_id
                        and public.is_kitchen_member(l.kitchen_id)));
create policy list_items_delete on product_list_items for delete
  using (exists (select 1 from product_lists l
                  where l.id = list_id and public.is_kitchen_member(l.kitchen_id)));

-- Тот же запрет на уровне данных, мимо RLS
-- security definer: триггер обязан сверять настоящие данные, а не то, что
-- видно вызывающему через RLS. Иначе постороннему прилетала бы ошибка
-- «продукт из другой кухни» вместо отказа в правах — блокировалось в обоих
-- случаях, но сообщение вводило в заблуждение.
create or replace function public.guard_list_item_kitchen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from product_lists l
      join products p on p.kitchen_id = l.kitchen_id
     where l.id = new.list_id and p.id = new.product_id
  ) then
    raise exception 'product_from_another_kitchen';
  end if;
  return new;
end;
$$;

drop trigger if exists t_list_items_guard_kitchen on product_list_items;
create trigger t_list_items_guard_kitchen before insert or update on product_list_items
  for each row execute function public.guard_list_item_kitchen();

-- То же исправление для проверки из 0008: она тоже смотрела сквозь RLS
create or replace function public.guard_planned_kitchen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from dishes d
                  where d.id = new.dish_id and d.kitchen_id = new.kitchen_id) then
    raise exception 'dish_from_another_kitchen';
  end if;
  return new;
end;
$$;

-- ── Права ─────────────────────────────────────────────────
-- Supabase выдаёт права новым таблицам через default privileges, но полагаться
-- на это не стоит: миграция должна быть самодостаточной. Защита — в RLS выше.
grant select, insert, update, delete on table product_lists      to authenticated;
grant select, insert, delete        on table product_list_items to authenticated;

-- ── Realtime ──────────────────────────────────────────────
-- Разовый список создаёт один человек, а видеть его должен другой — без
-- перезапуска приложения. Публикация может отсутствовать (локальная база)
-- или уже содержать таблицу — обе ситуации не должны ломать прогон.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'product_lists'
    ) then
      execute 'alter publication supabase_realtime add table public.product_lists';
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'product_list_items'
    ) then
      execute 'alter publication supabase_realtime add table public.product_list_items';
    end if;
  end if;
end $$;

commit;
