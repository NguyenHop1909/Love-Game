begin;

create or replace function public.love_entry_edit(
  p_id uuid,
  p_title text,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.love_role() is null then
    raise exception 'Bạn chưa có quyền sử dụng góc chung.';
  end if;
  if coalesce(length(trim(p_title)), 0) not between 1 and 180
    or length(coalesce(p_note, '')) > 1000 then
    raise exception 'Nội dung chưa hợp lệ.';
  end if;

  update public.couple_entries
  set title = trim(p_title), note = trim(coalesce(p_note, ''))
  where id = p_id and owner_id = auth.uid();

  if not found then
    raise exception 'Bạn chỉ được sửa chia sẻ của mình.';
  end if;
end
$$;

revoke all on function public.love_entry_edit(uuid, text, text) from public;
grant execute on function public.love_entry_edit(uuid, text, text) to authenticated;

commit;
