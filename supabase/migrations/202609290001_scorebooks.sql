-- Shared app: keep the two scoring directions separate while using one database.
begin;

create table if not exists public.scorebooks (
  id text primary key check (id in ('em','anh')),
  label text not null,
  subject_name text not null,
  created_at timestamptz not null default now()
);
insert into public.scorebooks (id, label, subject_name) values
  ('em', 'Chấm điểm em', 'Công chúa'),
  ('anh', 'Chấm điểm anh', 'Anh yêu')
on conflict (id) do update set label = excluded.label, subject_name = excluded.subject_name;

alter table public.quizzes add column if not exists scorebook_id text not null default 'anh' references public.scorebooks(id);
alter table public.rewards_penalties add column if not exists scorebook_id text not null default 'anh' references public.scorebooks(id);
alter table public.user_inventory add column if not exists scorebook_id text not null default 'anh' references public.scorebooks(id);
alter table public.audit_logs add column if not exists scorebook_id text not null default 'anh' references public.scorebooks(id);

alter table public.scorebooks enable row level security;
revoke all on public.scorebooks from anon;
grant select on public.scorebooks to authenticated;
drop policy if exists scorebooks_members_read on public.scorebooks;
create policy scorebooks_members_read on public.scorebooks for select to authenticated
  using (public.love_role() is not null);

-- Historical rows already in the primary app remain in the existing ledger.
-- Imported rows from love-app-for-em must be inserted with scorebook_id = 'em'.
commit;
