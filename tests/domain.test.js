import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanceOf,
  localDate,
  memberRole,
  nextRotation,
  validQuizLink,
} from "../src/lib/domain.js";

test("Vietnam date stays correct before 07:00 and across year boundary", () => {
  assert.equal(localDate(new Date("2026-09-27T18:00:00Z")), "2026-09-28");
  assert.equal(localDate(new Date("2026-12-31T18:00:00Z")), "2027-01-01");
});
test("wallet uses actual ledger without an invented bonus", () => {
  assert.equal(balanceOf([{ reward_amount: 10, penalty_amount: 1 }]), 9);
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
