begin;

alter table public.quizzes
  add column if not exists due_date date;

comment on column public.quizzes.due_date is
  'Optional completion deadline shown in the couple dashboard.';

commit;
