# PantrySync — Техническая спецификация

> Версия 0.2. Полная переработка. Раздел «API / Server Actions» из v0.1 удалён — см. **D-002**.

---

## 1. Стек

| Слой | Выбор | Комментарий |
|------|-------|-------------|
| Сборка | **Vite 5** | Ожидает подтверждения, см. **D-003**. Альтернатива — Next.js 14 в режиме `output: 'export'` |
| UI | React 18 + TypeScript (strict) | |
| Роутинг | React Router v6 | Hash-роутинг в нативной сборке, browser-роутинг в вебе |
| Стили | Tailwind CSS | Дизайн-токены из `06-figma-structure.md` в `tailwind.config` |
| Компоненты | shadcn/ui | Dialog, Sheet, Select, Checkbox, Toast |
| Иконки | lucide-react | **D-012** |
| Состояние | Zustand + persist | |
| Серверное состояние | TanStack Query | Кэш, ретраи, инвалидация |
| Валидация | Zod | Одни и те же схемы для форм и для ответов Supabase |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | |
| Хостинг | Vercel | |
| PWA | `vite-plugin-pwa` | |
| Нативная обёртка | Capacitor 6 | Этап 2, см. **D-001** |

**Требование к архитектуре:** сборка должна быть чисто статической. Никаких Server Actions, API Routes, `getServerSideProps`, middleware. Всё, что нельзя сделать безопасно на клиенте, живёт в Postgres-функциях `SECURITY DEFINER`.

---

## 2. Схема базы данных

### 2.1 Таблицы

```sql
-- ─────────────────────────────────────────────
-- Профили
-- ─────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  full_name   text check (char_length(full_name) <= 100),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- Кухни
-- ─────────────────────────────────────────────
create table kitchens (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 60),
  owner_id           uuid not null references profiles(id),
  invite_code        uuid unique default gen_random_uuid(),
  invite_expires_at  timestamptz default (now() + interval '7 days'),  -- D-011
  invites_enabled    boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index on kitchens (owner_id);

-- ─────────────────────────────────────────────
-- Участники
-- ─────────────────────────────────────────────
create table kitchen_members (
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','member')),
  joined_at   timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);

create index on kitchen_members (user_id);

-- ─────────────────────────────────────────────
-- Категории (были захардкожены — теперь данные)
-- ─────────────────────────────────────────────
create table categories (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid references kitchens(id) on delete cascade,  -- null = системная
  name        text not null check (char_length(name) between 1 and 40),
  sort_order  int  not null default 100,   -- D-007: порядок как в магазине
  created_at  timestamptz not null default now()
);

create unique index on categories (coalesce(kitchen_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ─────────────────────────────────────────────
-- Продукты
-- ─────────────────────────────────────────────
create table products (
  id           uuid primary key default gen_random_uuid(),
  kitchen_id   uuid not null references kitchens(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  category_id  uuid references categories(id) on delete set null,
  unit         text not null default 'шт' check (unit in ('шт','кг','г','л','мл','упак')),
  quantity     numeric(10,2) not null default 0 check (quantity >= 0 and quantity <= 100000),
  in_stock     boolean not null default false,
  deleted_at   timestamptz,                       -- D-009: soft delete
  created_by   uuid references profiles(id) on delete set null,
  updated_by   uuid references profiles(id) on delete set null,  -- D-010: подавление эха
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on products (kitchen_id) where deleted_at is null;
create index on products (kitchen_id, in_stock) where deleted_at is null;
create unique index products_unique_name
  on products (kitchen_id, lower(name)) where deleted_at is null;

-- ─────────────────────────────────────────────
-- Блюда
-- ─────────────────────────────────────────────
create table dishes (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  image_path  text,                                 -- путь в Storage, не публичный URL
  deleted_at  timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on dishes (kitchen_id) where deleted_at is null;

-- ─────────────────────────────────────────────
-- Ингредиенты — D-005
-- ─────────────────────────────────────────────
create table dish_ingredients (
  id            uuid primary key default gen_random_uuid(),
  dish_id       uuid not null references dishes(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,   -- связь
  product_name  text not null check (char_length(product_name) <= 80), -- снапшот
  quantity      numeric(10,2) check (quantity is null or quantity >= 0),
  unit          text check (unit is null or unit in ('шт','кг','г','л','мл','упак')),
  created_at    timestamptz not null default now()
);

create index on dish_ingredients (dish_id);
create index on dish_ingredients (product_id);

-- ─────────────────────────────────────────────
-- Общий справочник для автокомплита
-- ─────────────────────────────────────────────
create table product_suggestions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_norm     text not null unique,   -- lowercase, ё→е
  category_name text,
  unit          text default 'шт'
);

create index on product_suggestions (name_norm text_pattern_ops);

-- ─────────────────────────────────────────────
-- План дня — активен в MVP-1, D-004 / D-019
-- ─────────────────────────────────────────────
create table meal_plans (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  plan_date   date not null,
  slot        text not null check (slot in ('breakfast','lunch','dinner')),
  dish_id     uuid references dishes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (kitchen_id, user_id, plan_date, slot)   -- D-019: план персональный
);

create index on meal_plans (kitchen_id, plan_date);
create index on meal_plans (dish_id, plan_date desc);   -- D-020: «давно не выбиралось»

-- ─────────────────────────────────────────────
-- Пользовательские настройки (свайп-режим)
-- ─────────────────────────────────────────────
create table user_settings (
  user_id            uuid primary key references profiles(id) on delete cascade,
  morning_prompt     boolean not null default true,
  slots_per_day      int not null default 3 check (slots_per_day between 1 and 3),
  playful_reactions  boolean not null default true,   -- D-021
  updated_at         timestamptz not null default now()
);
```

### 2.2 Триггер `updated_at`

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger t_products_touch before update on products
  for each row execute function public.touch_updated_at();
create trigger t_dishes_touch before update on dishes
  for each row execute function public.touch_updated_at();
create trigger t_kitchens_touch before update on kitchens
  for each row execute function public.touch_updated_at();
```

---

## 3. Row Level Security

> Полный разбор — в `04-security.md`. Здесь только код.

### 3.1 Вспомогательные функции — D-015

Прямая проверка членства внутри политики на `kitchen_members` вызывает бесконечную рекурсию. Обходим через `SECURITY DEFINER`.

```sql
create or replace function public.is_kitchen_member(k_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from kitchen_members
    where kitchen_id = k_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_kitchen_owner(k_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from kitchen_members
    where kitchen_id = k_id and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function public.is_kitchen_member(uuid) from public;
grant execute on function public.is_kitchen_member(uuid) to authenticated;
revoke all on function public.is_kitchen_owner(uuid) from public;
grant execute on function public.is_kitchen_owner(uuid) to authenticated;
```

### 3.2 Политики — D-016

Никаких `for all using (...)`. Каждая операция описана отдельно, у пишущих обязателен `with check`.

```sql
alter table profiles          enable row level security;
alter table kitchens          enable row level security;
alter table kitchen_members   enable row level security;
alter table categories        enable row level security;
alter table products          enable row level security;
alter table dishes            enable row level security;
alter table dish_ingredients  enable row level security;
alter table product_suggestions enable row level security;

-- ── profiles ────────────────────────────────
create policy profiles_select_self on profiles for select
  using (id = auth.uid());

-- профили сокухонников (нужны для аватарок участников)
create policy profiles_select_cokitchen on profiles for select
  using (exists (
    select 1 from kitchen_members m1
    join kitchen_members m2 on m1.kitchen_id = m2.kitchen_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  ));

create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ── kitchens ────────────────────────────────
create policy kitchens_select on kitchens for select
  using (public.is_kitchen_member(id));

create policy kitchens_update on kitchens for update
  using (public.is_kitchen_member(id))
  with check (public.is_kitchen_member(id) and owner_id = (select owner_id from kitchens k where k.id = kitchens.id));
  -- owner_id нельзя менять напрямую, только через transfer_ownership()

create policy kitchens_delete on kitchens for delete
  using (public.is_kitchen_owner(id));

-- INSERT напрямую запрещён — только через create_kitchen()

-- ── kitchen_members ─────────────────────────
create policy members_select on kitchen_members for select
  using (public.is_kitchen_member(kitchen_id));

create policy members_delete on kitchen_members for delete
  using (
    user_id = auth.uid()                         -- выйти самому
    or public.is_kitchen_owner(kitchen_id)       -- владелец удаляет других
  );

-- INSERT и UPDATE напрямую запрещены — только через join_kitchen() / transfer_ownership()
-- Это закрывает возможность самоназначения роли 'owner'.

-- ── categories ──────────────────────────────
create policy categories_select on categories for select
  using (kitchen_id is null or public.is_kitchen_member(kitchen_id));

create policy categories_insert on categories for insert
  with check (kitchen_id is not null and public.is_kitchen_member(kitchen_id));

create policy categories_update on categories for update
  using (kitchen_id is not null and public.is_kitchen_member(kitchen_id))
  with check (kitchen_id is not null and public.is_kitchen_member(kitchen_id));

create policy categories_delete on categories for delete
  using (kitchen_id is not null and public.is_kitchen_member(kitchen_id));

-- ── products ────────────────────────────────
create policy products_select on products for select
  using (public.is_kitchen_member(kitchen_id));

create policy products_insert on products for insert
  with check (
    public.is_kitchen_member(kitchen_id)
    and created_by = auth.uid()
    and deleted_at is null
  );

create policy products_update on products for update
  using (public.is_kitchen_member(kitchen_id))
  with check (
    public.is_kitchen_member(kitchen_id)
    and updated_by = auth.uid()          -- нельзя подписаться чужим id
  );

create policy products_delete on products for delete
  using (public.is_kitchen_member(kitchen_id));

-- ── dishes ──────────────────────────────────
create policy dishes_select on dishes for select
  using (public.is_kitchen_member(kitchen_id));

create policy dishes_insert on dishes for insert
  with check (public.is_kitchen_member(kitchen_id) and created_by = auth.uid());

create policy dishes_update on dishes for update
  using (public.is_kitchen_member(kitchen_id))
  with check (public.is_kitchen_member(kitchen_id));

create policy dishes_delete on dishes for delete
  using (public.is_kitchen_member(kitchen_id));

-- ── dish_ingredients ────────────────────────
create policy ingredients_select on dish_ingredients for select
  using (exists (select 1 from dishes d
                 where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));

create policy ingredients_write on dish_ingredients for insert
  with check (exists (select 1 from dishes d
                      where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));

create policy ingredients_update on dish_ingredients for update
  using (exists (select 1 from dishes d
                 where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)))
  with check (exists (select 1 from dishes d
                      where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));

create policy ingredients_delete on dish_ingredients for delete
  using (exists (select 1 from dishes d
                 where d.id = dish_id and public.is_kitchen_member(d.kitchen_id)));

-- ── meal_plans ──────────────────────────────
-- Читают все участники кухни (видно, кто что выбрал),
-- но пишет каждый только свой план — D-019
create policy plans_select on meal_plans for select
  using (public.is_kitchen_member(kitchen_id));

create policy plans_insert on meal_plans for insert
  with check (public.is_kitchen_member(kitchen_id) and user_id = auth.uid());

create policy plans_update on meal_plans for update
  using (user_id = auth.uid())
  with check (public.is_kitchen_member(kitchen_id) and user_id = auth.uid());

create policy plans_delete on meal_plans for delete
  using (user_id = auth.uid());

-- ── user_settings ───────────────────────────
create policy settings_select on user_settings for select
  using (user_id = auth.uid());
create policy settings_insert on user_settings for insert
  with check (user_id = auth.uid());
create policy settings_update on user_settings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── product_suggestions ─────────────────────
-- Общий справочник: читают все авторизованные, пишет только сервис
create policy suggestions_select on product_suggestions for select
  to authenticated using (true);
```

### 3.3 RPC-функции

```sql
-- ── Создание кухни ──────────────────────────
-- Нужна функция: обычным INSERT нельзя, т.к. на момент вставки
-- пользователь ещё не член кухни и RLS его не пропустит.
create or replace function public.create_kitchen(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  k_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if char_length(coalesce(trim(p_name), '')) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  -- защита от массового создания
  if (select count(*) from kitchen_members where user_id = auth.uid()) >= 20 then
    raise exception 'kitchen_limit_reached';
  end if;

  insert into kitchens (name, owner_id) values (trim(p_name), auth.uid())
  returning id into k_id;

  insert into kitchen_members (kitchen_id, user_id, role)
  values (k_id, auth.uid(), 'owner');

  return k_id;
end;
$$;

-- ── Вступление по коду ──────────────────────
create or replace function public.join_kitchen(p_code uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  k_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select id into k_id from kitchens
   where invite_code = p_code
     and invites_enabled = true
     and (invite_expires_at is null or invite_expires_at > now());

  if k_id is null then
    raise exception 'invalid_or_expired_invite';
  end if;

  if (select count(*) from kitchen_members where kitchen_id = k_id) >= 20 then
    raise exception 'member_limit_reached';
  end if;

  insert into kitchen_members (kitchen_id, user_id, role)
  values (k_id, auth.uid(), 'member')
  on conflict (kitchen_id, user_id) do nothing;

  return k_id;
end;
$$;

-- ── Информация о приглашении (до вступления) ─
-- Отдаёт только название кухни и имя пригласившего, ничего больше.
create or replace function public.peek_invite(p_code uuid)
returns table (kitchen_name text, owner_name text)
language sql
security definer
set search_path = public
stable
as $$
  select k.name, p.full_name
  from kitchens k
  join profiles p on p.id = k.owner_id
  where k.invite_code = p_code
    and k.invites_enabled = true
    and (k.invite_expires_at is null or k.invite_expires_at > now());
$$;

-- ── Обновление приглашения ──────────────────
create or replace function public.regenerate_invite(p_kitchen uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_code uuid;
begin
  if not public.is_kitchen_owner(p_kitchen) then
    raise exception 'forbidden';
  end if;
  update kitchens
     set invite_code = gen_random_uuid(),
         invite_expires_at = now() + interval '7 days'
   where id = p_kitchen
  returning invite_code into new_code;
  return new_code;
end;
$$;

-- ── Передача владения ───────────────────────
create or replace function public.transfer_ownership(p_kitchen uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_kitchen_owner(p_kitchen) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from kitchen_members
                 where kitchen_id = p_kitchen and user_id = p_new_owner) then
    raise exception 'not_a_member';
  end if;

  update kitchen_members set role = 'member'
   where kitchen_id = p_kitchen and role = 'owner';
  update kitchen_members set role = 'owner'
   where kitchen_id = p_kitchen and user_id = p_new_owner;
  update kitchens set owner_id = p_new_owner where id = p_kitchen;
end;
$$;

-- ── Удаление аккаунта — D-018 ───────────────
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k record;
  heir uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;

  for k in select kitchen_id from kitchen_members
            where user_id = auth.uid() and role = 'owner'
  loop
    select user_id into heir from kitchen_members
     where kitchen_id = k.kitchen_id and user_id <> auth.uid()
     order by joined_at limit 1;

    if heir is null then
      delete from kitchens where id = k.kitchen_id;   -- каскадом всё
    else
      perform public.transfer_ownership(k.kitchen_id, heir);
    end if;
  end loop;

  delete from kitchen_members where user_id = auth.uid();
  delete from auth.users where id = auth.uid();        -- каскадом снесёт profiles
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
```

**Правило:** каждая `SECURITY DEFINER`-функция обязана иметь `set search_path = public` и явный `revoke ... from public` + `grant ... to authenticated`. Без этого функция становится дырой.

---

## 4. Storage (фото блюд) — D-017

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', false, 3145728,
        array['image/jpeg','image/webp','image/png']);

-- Путь: {kitchen_id}/{dish_id}.webp
create policy dish_images_select on storage.objects for select
  using (bucket_id = 'dish-images'
         and public.is_kitchen_member((storage.foldername(name))[1]::uuid));

create policy dish_images_insert on storage.objects for insert
  with check (bucket_id = 'dish-images'
              and public.is_kitchen_member((storage.foldername(name))[1]::uuid));

create policy dish_images_delete on storage.objects for delete
  using (bucket_id = 'dish-images'
         and public.is_kitchen_member((storage.foldername(name))[1]::uuid));
```

Клиент перед загрузкой: перерисовка через `canvas` (снимает EXIF и геометки), ресайз до 1200px по длинной стороне, конвертация в WebP, качество 0.8. Показ — через `createSignedUrl(path, 3600)`.

---

## 5. Клиентская архитектура

### 5.1 Структура

```
src/
  app/
    router.tsx
    providers.tsx
  features/
    auth/          # вход, регистрация, guard, удаление аккаунта
    kitchens/      # переключение, участники, приглашения
    products/      # список, карточка, панель количества, модалы
    dishes/        # сетка, детали, планирование
    settings/
  shared/
    api/           # supabase client + типизированные обёртки
    db/            # сгенерированные типы (supabase gen types)
    ui/            # shadcn + собственные примитивы
    lib/
      voice/       # D-013: index.ts + web.ts + native.ts
      image/       # стрип EXIF, ресайз
      text/        # нормализация, поиск
    store/         # zustand-слайсы
  styles/
```

### 5.2 Состояние

```ts
// Клиентский UI-стейт (Zustand). Серверные данные — в TanStack Query.
interface UIState {
  currentKitchenId: string | null;
  search: string;
  categoryFilter: string | 'all';
  statusFilter: 'to-buy' | 'in-stock' | 'all';
  activeProductId: string | null;   // открытая панель количества
  planMode: boolean;
  selectedDishIds: string[];
  connection: 'online' | 'reconnecting' | 'offline';

  // D-010: подавление собственного эха
  pendingOps: Map<string, { field: string; value: unknown; ts: number }>;
}
```

### 5.3 Оптимистичное обновление тоггла — D-010

```ts
async function toggleProduct(id: string, next: boolean) {
  const opTs = Date.now();
  ui.pendingOps.set(id, { field: 'in_stock', value: next, ts: opTs });

  queryClient.setQueryData(['products', kitchenId], (old: Product[]) =>
    old.map(p => (p.id === id ? { ...p, in_stock: next } : p))
  );

  const { error } = await supabase
    .from('products')
    .update({ in_stock: next, updated_by: userId })
    .eq('id', id);

  ui.pendingOps.delete(id);

  if (error) {
    queryClient.setQueryData(['products', kitchenId], (old: Product[]) =>
      old.map(p => (p.id === id ? { ...p, in_stock: !next } : p))
    );
    toast.error('Не удалось сохранить. Проверьте соединение');
  }
}
```

### 5.4 Реалтайм

```ts
const channel = supabase
  .channel(`kitchen:${kitchenId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'products',
        filter: `kitchen_id=eq.${kitchenId}` },
      handleProductChange)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'dishes',
        filter: `kitchen_id=eq.${kitchenId}` },
      handleDishChange)
  .subscribe(status => {
    ui.setConnection(
      status === 'SUBSCRIBED' ? 'online'
      : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'reconnecting'
      : 'offline'
    );
  });

function handleProductChange(payload) {
  const row = payload.new ?? payload.old;
  const pending = ui.pendingOps.get(row.id);

  // Своё же эхо по операции, которая ещё в полёте — игнорируем
  if (pending && row.updated_by === userId && Date.now() - pending.ts < 5000) return;

  applyToCache(payload);

  // Если открыта панель количества у изменённого продукта — закрываем
  if (ui.activeProductId === row.id && row.updated_by !== userId) {
    ui.setActiveProduct(null);
    highlight(row.id);
  }
}
```

При переходе `reconnecting → online` — полный `invalidateQueries(['products'])`, потому что события за время разрыва потеряны.

### 5.5 Поиск и сортировка — D-007, D-008

```ts
export const norm = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export function filterProducts(products: Product[], q: string) {
  if (norm(q).length < 2) return products;
  const nq = norm(q);
  return products
    .filter(p => norm(p.name).includes(nq))
    .sort((a, b) => {
      const ap = norm(a.name).startsWith(nq) ? 0 : 1;
      const bp = norm(b.name).startsWith(nq) ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name, 'ru');
    });
}

export function groupByCategory(products: Product[], categories: Category[]) {
  const order = new Map(categories.map(c => [c.id, c.sort_order]));
  return [...products]
    .sort((a, b) =>
      (order.get(a.category_id ?? '') ?? 999) - (order.get(b.category_id ?? '') ?? 999)
      || a.name.localeCompare(b.name, 'ru'))
    .reduce(/* группировка */);
}
```

### 5.6 Готовность блюда — D-005

```ts
export function dishStatus(dish: DishWithIngredients, products: Product[]) {
  const stock = new Set(
    products.filter(p => p.in_stock && !p.deleted_at).map(p => p.id)
  );
  const missing = dish.ingredients.filter(
    ing => !ing.product_id || !stock.has(ing.product_id)
  );
  return { ready: missing.length === 0, missing, missingCount: missing.length };
}
```

Сравнение по `product_id`, не по строке. Ингредиент с `product_id = null` (продукт удалён) всегда считается отсутствующим.

### 5.7 Голосовой ввод — D-013

```ts
// shared/lib/voice/index.ts
export interface VoiceProvider {
  isAvailable(): Promise<boolean>;
  start(lang: string): Promise<string>;
  stop(): void;
}

// Выбор по платформе, а не по наличию window.webkitSpeechRecognition —
// в WKWebView объект есть, но не работает.
export const voice: VoiceProvider = Capacitor.isNativePlatform()
  ? nativeVoice   // @capacitor-community/speech-recognition
  : webVoice;     // Web Speech API, только если это Safari/Chrome, а не webview
```

Определение webview на iOS: `navigator.standalone === undefined && /iPhone|iPad/.test(ua) && !/Safari/.test(ua)`.

---

## 6. Демо-данные

- **Типовой набор продуктов** (25 позиций, все выключены) — по кнопке в пустом состоянии.
- **Примеры блюд** (5 штук с ингредиентами) — по кнопке в пустом состоянии блюд.
- `product_suggestions` — сид на ~300 популярных продуктов с категориями и единицами, заливается миграцией.

---

## 7. Что осознанно не делаем в MVP-1

| Не делаем | Почему |
|-----------|--------|
| Offline-first с очередью мутаций | Сложно, а сценарий «магазин без сети» решается тем, что список уже загружен |
| CRDT / разрешение конфликтов | Побеждает последняя запись, для семьи из 3 человек этого достаточно |
| Пагинация продуктов | 200 записей на кухню — потолок реального использования |
| Пересчёт единиц (кг ↔ г) | Пользователь сам знает, что покупает |
| Мультиязычность | См. Q-4 в журнале решений |
