import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanceOf,
  formatAuditLog,
  localDate,
  memberRole,
  nextRotation,
  validQuizLink,
} from "../src/lib/domain.js";

test("Vietnam date stays correct before 07:00 and across year boundary", () => {
  assert.equal(localDate(new Date("2026-09-27T18:00:00Z")), "2026-09-28");
  assert.equal(localDate(new Date("2026-12-31T18:00:00Z")), "2027-01-01");
});
test("wallet applies the couple rule: exactly 9 raw points unlocks as 10", () => {
  assert.equal(balanceOf([{ reward_amount: 10, penalty_amount: 1 }]), 10);
  assert.equal(balanceOf([{ reward_amount: 9 }]), 10);
  assert.equal(balanceOf([{ reward_amount: 10 }, { reward_amount: -10 }]), 0);
});
test("every repeated spin lands the selected segment beneath the pointer", () => {
  let previous = 0;
  for (const count of [1, 2, 3, 7, 20])
    for (let n = 0; n < 40; n++) {
      const index = n % count;
      const next = nextRotation(previous, index, count);
      const center = (next + ((index + 0.5) * 360) / count) % 360;
      assert.ok(Math.min(center, 360 - center) < 1e-7);
      assert.ok(next - previous >= 2160 - 1e-7);
      previous = next;
    }
});
test("quiz links reject executable URLs and lookalike hosts", () => {
  for (const link of [
    "javascript:alert(1)",
    "https://kahoot.it.evil.com",
    "http://kahoot.it",
    "bad",
  ])
    assert.equal(validQuizLink(link), false);
  assert.equal(validQuizLink("https://create.kahoot.it/details/abc"), true);
});
test("unknown roles never receive a privileged screen", () => {
  assert.equal(memberRole({ role: "owner" }), null);
  assert.equal(memberRole(null), null);
  assert.equal(memberRole({ role: "admin" }), "admin");
});

test("audit JSON is presented as a readable Vietnamese sentence", () => {
  const action_details = JSON.stringify({
    table: "rewards_penalties",
    before: { reward_amount: 100, penalty_amount: 0, reward_reason: "test" },
    after: { reward_amount: 10000, penalty_amount: 0, reward_reason: "test" },
  });
  assert.equal(
    formatAuditLog({ action_type: "UPDATE", action_details }),
    "Đã chỉnh sửa điểm: 100 phiếu thưởng · Lý do: test → 10.000 phiếu thưởng · Lý do: test",
  );
  assert.equal(
    formatAuditLog({ action_type: "DELETE", action_details }),
    "Đã xóa 100 phiếu thưởng · Lý do: test",
  );
});

test("legacy human-readable audit text remains unchanged", () => {
  assert.equal(
    formatAuditLog({ action_type: "DELETE", action_details: "Em yêu đã xóa 6 phiếu thưởng" }),
    "Em yêu đã xóa 6 phiếu thưởng",
  );
});
