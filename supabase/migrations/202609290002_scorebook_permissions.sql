begin;

alter table public.love_members
  add column if not exists can_scorebook_id text references public.scorebooks(id);

-- The login names intentionally map to the partner they are allowed to score:
-- emyeu (Anh) scores Công chúa; anhyeu (Em) scores Anh yêu.
update public.love_members
set can_scorebook_id = case
  when display_name = 'Công chúa' then 'em'
  when display_name = 'Anh yêu' then 'anh'
  else can_scorebook_id
end;

create or replace function public.love_can_score(p_scorebook text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.love_members
    where user_id = auth.uid() and can_scorebook_id = p_scorebook
  )
$$;
revoke all on function public.love_can_score(text) from public;
grant execute on function public.love_can_score(text) to authenticated;

drop policy if exists admin_quizzes on public.quizzes;
create policy scorebook_quizzes on public.quizzes for all to authenticated
  using (public.love_can_score(scorebook_id))
  with check (public.love_can_score(scorebook_id));
drop policy if exists admin_ledger on public.rewards_penalties;
create policy scorebook_ledger on public.rewards_penalties for all to authenticated
  using (public.love_can_score(scorebook_id))
  with check (public.love_can_score(scorebook_id));
drop policy if exists members_read on public.user_inventory;
create policy inventory_read on public.user_inventory for select to authenticated
  using (public.love_role() is not null);

commit;
