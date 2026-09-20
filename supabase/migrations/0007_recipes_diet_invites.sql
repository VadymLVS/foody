-- PantrySync · 0007 · Рецепты, питание, приглашение без аккаунта (backlog п. 30, 33, 36)
--
-- Выполнять один раз в SQL Editor после 0006. Повторный запуск безопасен.

-- ── п. 33 · Текст «Как готовить» ──────────────────────────
alter table dishes
  add column if not exists recipe text check (recipe is null or char_length(recipe) <= 5000);

-- ── п. 36 · Питание — у каждого человека своё ─────────────
-- diet: null — ещё не отвечал (экран «Что вы едите?» покажется один раз).
-- diet_excludes: группы продуктов, которые человек не ест или не переносит
-- (pork, beef, poultry, fish, seafood, mushrooms, dairy, gluten, nuts, eggs).
alter table user_settings
  add column if not exists diet text
    check (diet is null or diet in ('omnivore', 'pescatarian', 'vegetarian', 'vegan'));
alter table user_settings
  add column if not exists diet_excludes text[] not null default '{}';

-- ── п. 30 · Приглашение видно и без аккаунта ──────────────
-- Функция отдаёт только название кухни и имя владельца по действующему коду.
-- Без этого человек без аккаунта видел «Приглашение не действует».
grant execute on function public.peek_invite(uuid) to anon;
