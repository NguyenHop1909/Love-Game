begin;

create or replace function public.love_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_scorebook text;
begin
  entry_scorebook := case
    when tg_op = 'DELETE' then coalesce(to_jsonb(old)->>'scorebook_id', 'anh')
    else coalesce(to_jsonb(new)->>'scorebook_id', 'anh')
  end;

  insert into public.audit_logs(
    admin_name,
    action_type,
    action_details,
    scorebook_id
  )
  values (
    coalesce(
      (select display_name from public.love_members where user_id = auth.uid()),
      'Hệ thống'
    ),
    tg_op,
    jsonb_build_object(
      'table', tg_table_name,
      'before', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'after', case when tg_op <> 'DELETE' then to_jsonb(new) end
    )::text,
    entry_scorebook
  );
  return null;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'rewards_penalties',
    'user_inventory',
    'wheel_settings',
    'quizzes'
  ] loop
    execute format(
      'drop trigger if exists love_audit_change on public.%I',
      table_name
    );
    execute format(
      'create trigger love_audit_change after insert or update or delete on public.%I for each row execute function public.love_audit()',
      table_name
    );
  end loop;
end
$$;

commit;
