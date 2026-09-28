import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;
const admin = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";
const outsider = "00000000-0000-0000-0000-000000000003";
let seq = 10;
const request = () =>
  `00000000-0000-0000-0000-${String(seq++).padStart(12, "0")}`;
async function asMember(id, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  return db.query(sql, params);
}
async function resetWallet(amount, cost = 2, free = 1) {
  await db.exec(
    "reset role; delete from public.rewards_penalties; delete from public.user_inventory; delete from public.love_operations;",
  );
  await db.query(
    "insert into public.rewards_penalties(date,reward_amount,penalty_amount) values(current_date,$1,0)",
    [amount],
  );
  await db.query(
    "update public.wheel_settings set spin_cost=$1, free_spins=$2 where id=1",
    [cost, free],
  );
}
before(async () => {
  db = new PGlite();
  // Minimal Supabase contracts; SQL and RLS execute in a real PostgreSQL engine.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    create policy legacy_open on storage.objects for all to anon,authenticated using(true) with check(true);
    insert into auth.users values('${admin}'),('${user}'),('${outsider}');
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609280001_love_space.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "insert into public.love_members values($1,'admin','Người tặng'),($2,'user','Người nhận')",
    [admin, user],
  );
});
after(async () => {
  await db?.close();
});

test("non-members and anonymous visitors cannot read or write private data", async () => {
  await resetWallet(20);
  const result = await asMember(
    outsider,
    "select * from public.rewards_penalties",
  );
  assert.equal(result.rows.length, 0);
  await assert.rejects(
    asMember(outsider, "select public.love_redeem($1,'SPIN')", [request()]),
    /Chỉ người nhận/,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select * from public.rewards_penalties"),
    /permission denied/,
  );
});
test("9 real points cannot redeem a 10-point gift", async () => {
  await resetWallet(9);
  await assert.rejects(
    asMember(user, "select public.love_redeem($1,'HUN_MOI')", [request()]),
    /Không đủ phiếu/,
  );
  const result = await asMember(user, "select * from public.user_inventory");
  assert.equal(result.rows.length, 0);
});
test("redeem is idempotent and creates one gift with one debit", async () => {
  await resetWallet(20);
  const id = request();
  const first = await asMember(
    user,
    "select public.love_redeem($1,'HUN_MOI') as result",
    [id],
  );
  const again = await asMember(
    user,
    "select public.love_redeem($1,'HUN_MOI') as result",
    [id],
  );
  assert.deepEqual(first.rows, again.rows);
  assert.equal(first.rows[0].result.balance, 10);
  assert.equal(
    (await asMember(user, "select * from public.user_inventory")).rows.length,
    1,
  );
  await assert.rejects(
    asMember(user, "select public.love_redeem($1,'HUN_SAU')", [id]),
    /Mã giao dịch/,
  );
});
test("failure to save gift rolls back debit and free spin", async () => {
  await resetWallet(20);
  await db.exec(
    "create function public.reject_test_gift() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end $$; create trigger reject_gift before insert on public.user_inventory for each row execute function public.reject_test_gift();",
  );
  await assert.rejects(
    asMember(user, "select public.love_redeem($1,'SPIN')", [request()]),
    /test failure/,
  );
  await assert.rejects(
    asMember(user, "select public.love_redeem($1,'FREE_SPIN')", [request()]),
    /test failure/,
  );
  assert.equal(
    Number(
      (
        await asMember(
          user,
          "select sum(reward_amount-penalty_amount) as balance from public.rewards_penalties",
        )
      ).rows[0].balance,
    ),
    20,
  );
  assert.equal(
    (await asMember(user, "select free_spins from public.wheel_settings"))
      .rows[0].free_spins,
    1,
  );
  await db.exec(
    "reset role; drop trigger reject_gift on public.user_inventory; drop function public.reject_test_gift();",
  );
});
test("zero-cost spin stays free; free spins cannot go below zero", async () => {
  await resetWallet(0, 0, 1);
  const free = await asMember(
    user,
    "select public.love_redeem($1,'SPIN') as result",
    [request()],
  );
  assert.equal(free.rows[0].result.cost, 0);
  await asMember(user, "select public.love_redeem($1,'FREE_SPIN')", [
    request(),
  ]);
  await assert.rejects(
    asMember(user, "select public.love_redeem($1,'FREE_SPIN')", [request()]),
    /hết lượt/,
  );
});
test("user cannot forge wallet, roles, settings, inventory or audit records", async () => {
  await resetWallet(20);
  await assert.rejects(
    asMember(
      user,
      "insert into public.rewards_penalties(date,reward_amount) values(current_date,999)",
    ),
    /row-level security/,
  );
  await assert.rejects(
    asMember(
      user,
      "update public.love_members set role='admin' where user_id=$1",
      [user],
    ),
    /permission denied/,
  );
  await assert.rejects(
    asMember(
      user,
      "insert into public.user_inventory(prize_text) values('forged')",
    ),
    /permission denied/,
  );
  assert.equal(
    (
      await asMember(
        user,
        "update public.wheel_settings set spin_cost=0 returning *",
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asMember(
      user,
      "insert into public.audit_logs(action_type) values('forged')",
    ),
    /permission denied/,
  );
});
test("gift follows request, schedule, complete and rejects unauthorized shortcuts", async () => {
  await resetWallet(20);
  const { rows } = await asMember(
    user,
    "select public.love_redeem($1,'HUN_MOI') as result",
    [request()],
  );
  const id = rows[0].result.gift_id;
  await assert.rejects(
    asMember(user, "select public.love_gift_action($1,'complete')", [id]),
    /Trạng thái/,
  );
  await asMember(user, "select public.love_gift_action($1,'request')", [id]);
  await assert.rejects(
    asMember(
      user,
      "select public.love_gift_action($1,'schedule',current_date+1)",
      [id],
    ),
    /Trạng thái/,
  );
  await asMember(
    admin,
    "select public.love_gift_action($1,'schedule',current_date+1)",
    [id],
  );
  await asMember(admin, "select public.love_gift_action($1,'complete')", [id]);
  const result = await asMember(
    user,
    "select status from public.user_inventory where id::text=$1",
    [id],
  );
  assert.equal(result.rows[0].status, "Đã sử dụng");
});
test("shared entries only let each person set their own vote", async () => {
  const result = await asMember(
    user,
    "insert into public.couple_entries(kind,title) values('date','Đi cà phê') returning id",
  );
  const id = result.rows[0].id;
  await asMember(user, "select public.love_entry_toggle($1,'like')", [id]);
  await asMember(admin, "select public.love_entry_toggle($1,'like')", [id]);
  assert.equal(
    (
      await asMember(
        user,
        "select liked_by from public.couple_entries where id=$1",
        [id],
      )
    ).rows[0].liked_by.length,
    2,
  );
  await assert.rejects(
    asMember(
      user,
      "update public.couple_entries set liked_by='{}' where id=$1",
      [id],
    ),
    /permission denied/,
  );
});
test("private proof bucket fences legacy broad storage policies", async () => {
  await asMember(
    user,
    "insert into storage.objects(bucket_id,name) values('quiz-images',$1)",
    [`${user}/proof.png`],
  );
  assert.equal(
    (
      await asMember(
        outsider,
        "select * from storage.objects where bucket_id='quiz-images'",
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asMember(
      outsider,
      "insert into storage.objects(bucket_id,name) values('quiz-images','forged.png')",
    ),
    /row-level security/,
  );
});
