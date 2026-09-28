import { test, expect } from "@playwright/test";

const adminId = "00000000-0000-0000-0000-000000000001";
const userId = "00000000-0000-0000-0000-000000000002";
async function mockApp(
  page,
  { admin = false, loggedIn = true, failed = false } = {},
) {
  const id = admin ? adminId : userId;
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: admin ? "admin@example.test" : "user@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-28T00:00:00Z",
  };
  const session = {
    access_token: "test.header.signature",
    refresh_token: "test-refresh",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
  const data = {
    love_members: [
      { user_id: adminId, role: "admin", display_name: "Công chúa" },
      { user_id: userId, role: "user", display_name: "Anh yêu" },
    ],
    quizzes: [
      {
        id: 1,
        created_at: "2026-09-28T00:00:00Z",
        status: "PENDING",
        link_kahoot: "https://kahoot.it/challenge/123",
      },
    ],
    rewards_penalties: [
      {
        id: 1,
        created_at: "2026-09-28T00:00:00Z",
        date: "2026-09-28",
        reward_amount: 20,
        penalty_amount: 0,
        reward_reason: "Một ngày vui",
      },
    ],
    user_inventory: [
      {
        id: 1,
        prize_text: "Một buổi hẹn cà phê",
        status: "Chờ hẹn",
        created_at: "2026-09-28T00:00:00Z",
      },
    ],
    wheel_settings: [
      {
        id: 1,
        spin_cost: 2,
        free_spins: 1,
        prizes: [
          { text: "Một cái ôm", color: "#fda4af" },
          { text: "Chọn phim", color: "#c4b5fd" },
          { text: "Cà phê", color: "#99f6e4" },
        ],
      },
    ],
    couple_entries: [],
    audit_logs: [],
  };
  const calls = [];
  await page.routeWebSocket("**/realtime/**", (ws) => ws.close());
  await page.route("https://local-test.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const respond = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path.includes("/auth/v1/token")) return respond(session);
    if (path.includes("/auth/v1/user")) return respond(user);
    if (path.includes("/auth/v1/logout")) return respond({});
    if (path.includes("/functions/")) return respond({ ok: false }, 503);
    if (path.includes("/rest/v1/rpc/")) {
      const name = path.split("/").at(-1);
      const body = request.postDataJSON();
      calls.push({ name, body });
      if (name === "love_redeem") {
        const cost =
          body.p_kind === "HUN_MOI" ? 10 : body.p_kind === "FREE_SPIN" ? 0 : 2;
        const gift = {
          id: data.user_inventory.length + 1,
          prize_text:
            body.p_kind === "HUN_MOI" ? "Một cái hun môi 💋" : "Chọn phim",
          status: "Chưa sử dụng",
          created_at: new Date().toISOString(),
        };
        data.user_inventory.unshift(gift);
        data.rewards_penalties.push({
          id: Date.now(),
          reward_amount: -cost,
          penalty_amount: 0,
          created_at: new Date().toISOString(),
          date: "2026-09-28",
        });
        return respond({
          prize: gift.prize_text,
          gift_id: String(gift.id),
          cost,
          index: 1,
          prizes: data.wheel_settings[0].prizes,
        });
      }
      if (name === "love_gift_action") {
        const gift = data.user_inventory.find(
          (g) => String(g.id) === body.p_id,
        );
        gift.status = {
          request: "Chờ hẹn",
          cancel: "Chưa sử dụng",
          schedule: "Đã hẹn",
          complete: "Đã sử dụng",
        }[body.p_action];
        gift.scheduled_for = body.p_date;
      }
      return respond(null);
    }
    const table = path.split("/").at(-1);
    if (table in data) {
      if (failed) return respond({ message: "Mất kết nối thử nghiệm" }, 503);
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        data[table].unshift({
          ...body,
          id: crypto.randomUUID(),
          owner_id: id,
          liked_by: [],
          done_by: [],
          created_at: new Date().toISOString(),
        });
        return respond(null, 201);
      }
      return respond(data[table]);
    }
    return respond({ message: "Unexpected request" }, 400);
  });
  await page.addInitScript(
    ({ loggedIn, session }) => {
      localStorage.setItem("is_logged_in", "true");
      localStorage.setItem("user_role", "admin");
      if (loggedIn)
        localStorage.setItem(
          "sb-local-test-auth-token",
          JSON.stringify(session),
        );
    },
    { loggedIn, session },
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  return { data, calls, errors };
}

test("legacy localStorage cannot bypass login; real auth login opens dashboard", async ({
  page,
}) => {
  await mockApp(page, { loggedIn: false });
  await expect(
    page.getByRole("heading", { name: "Góc nhỏ của tụi mình" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("user@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Vào nhà thôi" }).click();
  await expect(
    page.getByRole("heading", { name: "Chào Anh yêu" }),
  ).toBeVisible();
});

test("mobile dashboard, shared mood, gifts and ledger fit viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await mockApp(page);
  await expect(
    page.getByRole("heading", { name: "Chào Anh yêu" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-today.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "💌 Góc chung", exact: true }).click();
  await page
    .getByLabel("Hôm nay bạn thế nào?")
    .fill("Muốn cùng nhau đi dạo 🌷");
  await page
    .getByLabel("Lời nhắn", { exact: true })
    .fill("Tối nay mình gặp nhau nhé");
  await page.getByRole("button", { name: "Chia sẻ 💌", exact: true }).click();
  await expect(
    page.getByText("Muốn cùng nhau đi dạo 🌷", { exact: true }),
  ).toBeVisible();
  for (const name of ["🌱 Nhiệm vụ", "🎁 Quà", "📖 Nhật ký"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("redeeming gift saves once and notification failure does not undo success", async ({
  page,
}) => {
  const { calls, errors } = await mockApp(page);
  await page.getByRole("button", { name: "🎁 Quà", exact: true }).click();
  await page
    .getByRole("button", { name: "Hun môi 💋 · 10 phiếu", exact: true })
    .click();
  await page.getByRole("button", { name: "Đồng ý", exact: true }).click();
  await expect(
    page.getByText("Một cái hun môi 💋", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Dữ liệu đã lưu");
  expect(calls.filter((c) => c.name === "love_redeem")).toHaveLength(1);
  await page.getByRole("button", { name: "Mình muốn dùng quà" }).click();
  await expect(page.getByText("Chờ hẹn", { exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("wheel can spin twice with reduced motion and correct displayed result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { calls } = await mockApp(page);
  await page.getByRole("button", { name: "🎁 Quà", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Quay · 2 phiếu", exact: true })
      .click();
    await expect(
      page.getByText("🎉 Bạn nhận được:", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quay · 2 phiếu", exact: true }),
    ).toBeEnabled();
  }
  expect(calls.filter((c) => c.name === "love_redeem")).toHaveLength(2);
});

test("admin schedules and completes a requested gift", async ({ page }) => {
  const { errors } = await mockApp(page, { admin: true });
  await page.getByRole("button", { name: "🎁 Quà", exact: true }).click();
  await page
    .getByRole("button", { name: "Chọn ngày hẹn", exact: true })
    .click();
  await page.getByRole("button", { name: "Lưu lịch hẹn", exact: true }).click();
  await expect(page.getByText("Đã hẹn", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Đã thực hiện ✓", exact: true })
    .click();
  await page.getByRole("button", { name: "Đã thực hiện", exact: true }).click();
  await page.getByLabel("Hiển thị").selectOption("used");
  await expect(page.getByText("Đã sử dụng", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-gifts.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("load failure shows retry instead of an empty wallet", async ({
  page,
}) => {
  await mockApp(page, { failed: true });
  await expect(page.getByRole("status")).toContainText("Chưa tải được dữ liệu");
  await expect(
    page.getByRole("button", { name: "Tải lại", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Phiếu hiện có")).toHaveCount(0);
});
