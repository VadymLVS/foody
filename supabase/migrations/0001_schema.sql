-- PantrySync · схема. См. docs/03-technical-specification.md
-- Порядок применения: 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008
-- Повторный запуск безопасен: файл идемпотентен (обзор 09-26, R-3).

create extension if not exists pgcrypto;

-- Единицы измерения — нейтральные коды, не слова (D-034).
-- Подписи берутся из словаря локализации.
do $$ begin
  create type unit_code as enum ('pcs','kg','g','l','ml','pack');
exception when duplicate_object then null;   -- повторный прогон
end $$;

-- ── Профили ───────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  full_name   text check (char_length(full_name) <= 100),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ── Настройки пользователя ────────────────────────────────
create table if not exists user_settings (
  user_id           uuid primary key references profiles(id) on delete cascade,
  language          text not null default 'ru' check (language in ('ru','uk','en','es')),
  show_row_images   boolean not null default true,   -- картинки в строках списка
  playful_reactions boolean not null default true,   -- реакции на серию отказов
  updated_at        timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

-- ── Кухни ─────────────────────────────────────────────────
create table if not exists kitchens (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 60),
  owner_id          uuid not null references profiles(id),
  invite_code       uuid unique default gen_random_uuid(),
  invite_expires_at timestamptz default (now() + interval '7 days'),
  invites_enabled   boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists kitchens_owner_id_idx on kitchens (owner_id);

create table if not exists kitchen_members (
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);
create index if not exists kitchen_members_user_id_idx on kitchen_members (user_id);

-- ── Категории ─────────────────────────────────────────────
-- Одна таблица на продукты и блюда: структура идентична (D-034).
-- key — ключ перевода у системных, name — подпись у пользовательских.
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  kitchen_id uuid references kitchens(id) on delete cascade,  -- null = системная
  kind       text not null check (kind in ('product','dish')),
  key        text,                                            -- 'vegetables', 'soups'
  name       text check (char_length(name) between 1 and 40), -- своё название
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  constraint category_has_label check (key is not null or name is not null)
);
create index if not exists categories_kitchen_id_kind_idx on categories (kitchen_id, kind);

-- ── Продукты ──────────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  category_id uuid references categories(id) on delete set null,
  unit        unit_code not null default 'pcs',   -- одна единица на продукт (D-030)
  quantity    numeric(10,2) not null default 0 check (quantity >= 0 and quantity <= 100000),
  in_stock    boolean not null default false,
  library_key text,                                -- снимок из public/library/products
  deleted_at  timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists products_kitchen_id_idx on products (kitchen_id) where deleted_at is null;
create index if not exists products_kitchen_id_in_stock_idx on products (kitchen_id, in_stock) where deleted_at is null;
create unique index if not exists products_unique_name on products (kitchen_id, lower(name))
  where deleted_at is null;

-- ── Блюда ─────────────────────────────────────────────────
create table if not exists dishes (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  category_id uuid references categories(id) on delete set null,
  image_path  text,          -- свой снимок в Storage
  library_key text,          -- либо снимок из public/library/dishes
  image_w     int,           -- пропорции нужны кладке до загрузки (D-023)
  image_h     int,
  deleted_at  timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dishes_kitchen_id_idx on dishes (kitchen_id) where deleted_at is null;

-- Единицы у ингредиента нет: она всегда берётся у продукта (D-030).
create table if not exists dish_ingredients (
  id           uuid primary key default gen_random_uuid(),
  dish_id      uuid not null references dishes(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null check (char_length(product_name) <= 80),
  quantity     numeric(10,2) check (quantity is null or quantity >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists dish_ingredients_dish_id_idx on dish_ingredients (dish_id);
create index if not exists dish_ingredients_product_id_idx on dish_ingredients (product_id);

-- ── Личное избранное (D-035) ──────────────────────────────
create table if not exists dish_favorites (
  dish_id    uuid not null references dishes(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dish_id, user_id)
);
create index if not exists dish_favorites_user_id_idx on dish_favorites (user_id);

-- ── Что готовим (D-028) ───────────────────────────────────
-- Без даты и без слотов. Список живёт, пока блюдо не приготовлено.
create table if not exists planned_dishes (
  id         uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  dish_id    uuid not null references dishes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kitchen_id, user_id, dish_id)
);
create index if not exists planned_dishes_kitchen_id_idx on planned_dishes (kitchen_id);
create index if not exists planned_dishes_dish_id_created_at_idx on planned_dishes (dish_id, created_at desc);

-- ── Справочник автокомплита ───────────────────────────────
create table if not exists product_suggestions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,      -- 'milk' — ключ перевода и имя файла снимка
  category_key text,
  unit         unit_code not null default 'pcs'
);

-- ── updated_at ────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists t_products_touch on products;
create trigger t_products_touch before update on products for each row execute function public.touch_updated_at();
drop trigger if exists t_dishes_touch on dishes;
create trigger t_dishes_touch   before update on dishes   for each row execute function public.touch_updated_at();
drop trigger if exists t_kitchens_touch on kitchens;
create trigger t_kitchens_touch before update on kitchens for each row execute function public.touch_updated_at();
drop trigger if exists t_settings_touch on user_settings;
create trigger t_settings_touch before update on user_settings for each row execute function public.touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
