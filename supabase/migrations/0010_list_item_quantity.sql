-- PantrySync · 0010 · Количество у позиции списка (backlog п. 46)
--
-- Выполнять в SQL Editor Supabase ПЕРЕД заливкой кода v0.18.
-- Повторный запуск безопасен.
--
-- Что меняется по смыслу. В 0009 у позиции списка количества не было: считалось,
-- что количество живёт у продукта (D-030) и второе рядом начнёт расходиться
-- с первым. Vadym показал, почему это неверно для разового списка: список
-- составляет один человек для другого, и «помидоры» без количества — это
-- вопрос в магазине. Значит, у позиции появляется своя заявка.
--
-- Расхождения с количеством продукта при этом не возникает, потому что они
-- отвечают на разные вопросы и живут в разных местах:
--   products.quantity           — «сколько лежит дома»;
--   product_list_items.quantity — «сколько взять в эту поездку».
-- Решение Vadym (10-01): заявка живёт ТОЛЬКО в списке и количество продукта
-- не трогает. Поэтому отдельная колонка, а не запись в products.
--
-- Ноль значит «количество не указано» — ровно как у products.quantity (D-030),
-- чтобы одно и то же число читалось одинаково в обоих местах.

begin;

alter table product_list_items
  add column if not exists quantity numeric(10, 3) not null default 0
    check (quantity >= 0);

-- 0009 выдал позициям только select/insert/delete: количества не было, и менять
-- строку было нечего. Теперь правка количества — обычное действие, значит нужны
-- и право, и политика. Без политики update RLS отказал бы молча.
grant update (quantity) on table product_list_items to authenticated;

drop policy if exists list_items_update on product_list_items;
create policy list_items_update on product_list_items for update
  using (exists (select 1 from product_lists l
                  where l.id = list_id and public.is_kitchen_member(l.kitchen_id)))
  with check (exists (select 1 from product_lists l
                       where l.id = list_id and public.is_kitchen_member(l.kitchen_id)));

commit;
