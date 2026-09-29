begin;

alter table public.wheel_settings
  add column if not exists last_free_spin_date date;

insert into public.wheel_settings (id, prizes, spin_cost, free_spins)
select 2, prizes, spin_cost, 0 from public.wheel_settings where id = 1
on conflict (id) do nothing;

create or replace function public.love_redeem(
  p_request_id uuid,
  p_kind text,
  p_scorebook text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  saved public.love_operations;
  cfg public.wheel_settings;
  amount bigint;
  cost integer;
  prize text;
  idx integer;
  result jsonb;
  gift_id text;
  settings_id integer := case when p_scorebook = 'anh' then 1 else 2 end;
  allowed_scorebook text;
begin
  select case when can_scorebook_id = 'em' then 'anh' else 'em' end
    into allowed_scorebook
  from public.love_members where user_id = auth.uid();
  if allowed_scorebook is null or p_scorebook is distinct from allowed_scorebook then
    raise exception 'Bạn chỉ được dùng vòng quay của mình.';
  end if;
  if p_request_id is null or p_kind not in ('HUN_MOI','HUN_SAU','SPIN','FREE_SPIN') then
    raise exception 'Yêu cầu không hợp lệ.';
  end if;
  perform pg_advisory_xact_lock(20260928);
  select * into saved from public.love_operations where request_id = p_request_id;
  if found then
    if saved.user_id <> auth.uid() or saved.kind <> p_kind then
      raise exception 'Mã giao dịch đã được sử dụng.';
    end if;
    return saved.result;
  end if;
  select * into cfg from public.wheel_settings where id = settings_id for update;
  if not found then raise exception 'Chưa có cấu hình vòng quay.'; end if;
  if p_kind in ('SPIN','FREE_SPIN') then
    if jsonb_array_length(cfg.prizes::jsonb) < 1 then raise exception 'Vòng quay chưa có quà.'; end if;
    if p_kind = 'FREE_SPIN'
      and cfg.last_free_spin_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
    then raise exception 'Bạn đã dùng lượt miễn phí hôm nay.'; end if;
    idx := floor(random() * jsonb_array_length(cfg.prizes::jsonb));
    prize := cfg.prizes::jsonb->idx->>'text';
    cost := case when p_kind = 'FREE_SPIN' then 0 else cfg.spin_cost end;
  else
    cost := case when p_kind = 'HUN_MOI' then 10 else 50 end;
    prize := case when p_kind = 'HUN_MOI' then 'Một cái hun môi 💋' else 'Một cái hun sâu 💕' end;
  end if;
  select coalesce(sum(coalesce(reward_amount,0)-coalesce(penalty_amount,0)),0)
    into amount from public.rewards_penalties where scorebook_id = p_scorebook;
  if amount = 9 then amount := 10; end if;
  if cost > 0 and amount < cost then raise exception 'Không đủ phiếu để đổi quà.'; end if;
  if p_kind = 'FREE_SPIN' then
    update public.wheel_settings
    set last_free_spin_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
    where id = settings_id;
  end if;
  if cost > 0 then
    insert into public.rewards_penalties(date,reward_amount,penalty_amount,reward_reason,scorebook_id)
    values ((now() at time zone 'Asia/Ho_Chi_Minh')::date,-cost,0,'Đổi quà: '||prize,p_scorebook);
  end if;
  insert into public.user_inventory(prize_text,status,scorebook_id)
    values (prize,'Chưa sử dụng',p_scorebook) returning id::text into gift_id;
  result := jsonb_build_object('gift_id',gift_id,'prize',prize,'index',idx,'prizes',cfg.prizes,'cost',cost,'balance',amount-cost);
  insert into public.love_operations(request_id,user_id,kind,result)
    values(p_request_id,auth.uid(),p_kind,result);
  return result;
end $$;

revoke all on function public.love_redeem(uuid,text,text) from public;
grant execute on function public.love_redeem(uuid,text,text) to authenticated;

drop policy if exists admin_wheel on public.wheel_settings;
drop policy if exists scorebook_wheel_update on public.wheel_settings;
create policy scorebook_wheel_update on public.wheel_settings
for update to authenticated
using (public.love_can_score(case when id = 1 then 'anh' else 'em' end))
with check (public.love_can_score(case when id = 1 then 'anh' else 'em' end));

commit;
