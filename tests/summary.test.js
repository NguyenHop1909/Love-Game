import { test } from "node:test";
import assert from "node:assert/strict";
import { periodFor, summaryTotals } from "../scripts/summary.js";

test("summary distinguishes earned, spent, penalties without a fake bonus", () => {
  assert.deepEqual(
    summaryTotals([
      { reward_amount: 9 },
      { reward_amount: -2, penalty_amount: 1 },
    ]),
    { earned: 9, spent: 2, penalties: 1, net: 6 },
  );
});
test("monthly schedule only sends on actual last day, including leap years", () => {
  assert.equal(
    periodFor(new Date("2028-02-28T16:00:00Z"), true).lastDay,
    false,
  );
  assert.equal(periodFor(new Date("2028-02-29T16:00:00Z"), true).lastDay, true);
  assert.equal(
    periodFor(new Date("2026-09-29T16:00:00Z"), true).lastDay,
    false,
  );
  assert.deepEqual(periodFor(new Date("2026-09-30T16:00:00Z"), true), {
    start: "2026-09-01",
    end: "2026-09-30",
    lastDay: true,
  });
});
