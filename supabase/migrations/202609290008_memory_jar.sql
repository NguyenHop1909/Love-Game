begin;

create table if not exists public.couple_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  memory_date date not null default current_date,
  title text not null check (length(title) between 1 and 120),
  note text not null default '' check (length(note) <= 1000),
  image_path text not null check (length(image_path) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.couple_memories enable row level security;
grant select, insert, update, delete on public.couple_memories to authenticated;

drop policy if exists memories_read on public.couple_memories;
create policy memories_read on public.couple_memories for select to authenticated
using (public.love_role() is not null);

drop policy if exists memories_insert_own on public.couple_memories;
create policy memories_insert_own on public.couple_memories for insert to authenticated
with check (public.love_role() is not null and owner_id = auth.uid());

drop policy if exists memories_delete_own on public.couple_memories;
create policy memories_delete_own on public.couple_memories for delete to authenticated
using (public.love_role() is not null and owner_id = auth.uid());

drop policy if exists memories_update_own on public.couple_memories;
create policy memories_update_own on public.couple_memories for update to authenticated
using (public.love_role() is not null and owner_id = auth.uid())
with check (public.love_role() is not null and owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'couple-memories',
  'couple-memories',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists memory_images_read on storage.objects;
create policy memory_images_read on storage.objects for select to authenticated
using (bucket_id = 'couple-memories' and public.love_role() is not null);

drop policy if exists memory_images_insert_own on storage.objects;
create policy memory_images_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'couple-memories'
  and public.love_role() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists memory_images_delete_own on storage.objects;
create policy memory_images_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'couple-memories'
  and public.love_role() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter publication supabase_realtime add table public.couple_memories;

commit;
