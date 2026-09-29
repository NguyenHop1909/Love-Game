begin;

do $$
declare
  policy record;
begin
  for policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'rewards_penalties'
  loop
    execute format(
      'drop policy %I on public.rewards_penalties',
      policy.policyname
    );
  end loop;
end
$$;

alter table public.rewards_penalties enable row level security;

create policy ledger_read on public.rewards_penalties
for select to authenticated
using (public.love_role() is not null);

create policy ledger_insert on public.rewards_penalties
for insert to authenticated
with check (public.love_can_score(scorebook_id));

create policy ledger_update on public.rewards_penalties
for update to authenticated
using (public.love_can_score(scorebook_id))
with check (public.love_can_score(scorebook_id));

create policy ledger_delete on public.rewards_penalties
for delete to authenticated
using (public.love_can_score(scorebook_id));

commit;
