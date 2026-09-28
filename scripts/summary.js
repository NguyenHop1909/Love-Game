import { pathToFileURL } from "node:url";
import { localDate } from "../src/lib/domain.js";

export function summaryTotals(rows) {
  return rows.reduce(
    (sum, row) => {
      const reward = Number(row.reward_amount) || 0;
      sum.earned += Math.max(0, reward);
      sum.spent += Math.max(0, -reward);
      sum.penalties += Number(row.penalty_amount) || 0;
      sum.net = sum.earned - sum.spent - sum.penalties;
      return sum;
    },
    { earned: 0, spent: 0, penalties: 0, net: 0 },
  );
}

export function periodFor(now, monthly) {
  const today = localDate(now);
  const [year, month, day] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: monthly ? `${today.slice(0, 7)}-01` : today,
    end: today,
    lastDay: day === lastDay,
  };
}

async function main() {
  const monthly =
    process.env.SUMMARY_PERIOD === "month" ||
    process.env.CRON_SCHEDULE === "0 16 28-31 * *";
  const period = periodFor(new Date(), monthly);
  if (monthly && process.env.CRON_SCHEDULE && !period.lastDay) {
    console.log("Not the last day of the month; skipped.");
    return;
  }
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_ADMIN_CHAT_ID,
    TELEGRAM_USER_CHAT_ID,
  } = process.env;
  if (
    ![
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_CHAT_ID,
      TELEGRAM_USER_CHAT_ID,
    ].every(Boolean)
  )
    throw new Error("Missing server-side summary secrets. See README.");
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL("/rest/v1/rewards_penalties", SUPABASE_URL);
    url.searchParams.set("select", "reward_amount,penalty_amount");
    url.searchParams.set(
      "and",
      `(date.gte.${period.start},date.lte.${period.end})`,
    );
    url.searchParams.set("order", "id.asc");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", "1000");
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`Database summary request failed (${response.status}).`);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  const totals = summaryTotals(rows);
  const text = `💌 Tổng kết ${monthly ? "tháng" : "ngày"} ${period.start} → ${period.end}\n🎁 Thưởng: +${totals.earned}\n🎟️ Đã đổi: ${totals.spent}\n🌱 Phạt: ${totals.penalties}\nThay đổi số dư trong kỳ: ${totals.net} phiếu.`;
  for (const chat_id of new Set([
    TELEGRAM_ADMIN_CHAT_ID,
    TELEGRAM_USER_CHAT_ID,
  ])) {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const body = await response.json();
    if (!response.ok || !body.ok)
      throw new Error("Telegram summary could not be delivered.");
  }
  console.log("Summary delivered.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
