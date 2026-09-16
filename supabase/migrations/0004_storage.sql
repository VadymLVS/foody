-- PantrySync · Storage. См. 04-security.md §5
-- Путь файла: {kitchen_id}/{dish_id}.webp — на нём строятся политики.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', false, 3145728,
        array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

create policy dish_images_select on storage.objects for select
  using (bucket_id = 'dish-images'
         and public.is_kitchen_member(((storage.foldername(name))[1])::uuid));

create policy dish_images_insert on storage.objects for insert
  with check (bucket_id = 'dish-images'
              and public.is_kitchen_member(((storage.foldername(name))[1])::uuid));

create policy dish_images_update on storage.objects for update
  using (bucket_id = 'dish-images'
         and public.is_kitchen_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'dish-images'
              and public.is_kitchen_member(((storage.foldername(name))[1])::uuid));

create policy dish_images_delete on storage.objects for delete
  using (bucket_id = 'dish-images'
         and public.is_kitchen_member(((storage.foldername(name))[1])::uuid));
