import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = (
  await readFile(
    new URL("../supabase/functions/notify-partner/index.ts", import.meta.url),
    "utf8",
  )
).replace(/^import .*;\s*/, "");
const compiled = stripTypeScriptTypes(source);
function handlerFor({
  authorized = true,
  member = true,
  delivery = true,
} = {}) {
  let handler;
  const calls = [];
  const Deno = {
    env: {
      get: (name) =>
        ({
          SUPABASE_URL: "https://example.test",
          SUPABASE_ANON_KEY: "test",
          TELEGRAM_BOT_TOKEN: "test-only-token",
          TELEGRAM_ADMIN_CHAT_ID: "admin-chat",
          TELEGRAM_USER_CHAT_ID: "user-chat",
        })[name],
    },
    serve: (fn) => {
      handler = fn;
    },
  };
  const createClient = () => ({
    auth: {
      getUser: async () => ({
        data: { user: authorized ? { id: "test-user" } : null },
        error: authorized ? null : new Error("Unauthorized"),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: member ? { role: "user" } : null,
            error: null,
          }),
        }),
      }),
    }),
  });
  const fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: delivery }), {
      status: delivery ? 200 : 429,
    });
  };
  new Function("Deno", "createClient", "fetch", compiled)(
    Deno,
    createClient,
    fetch,
  );
  return { handler, calls };
}
function request(body, auth = true) {
  return new Request("https://example.test/functions/v1/notify-partner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: "Bearer test" } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("notification requires verified auth and membership before sending", async () => {
  for (const config of [{ authorized: false }, { member: false }]) {
    const { handler, calls } = handlerFor(config);
    const result = await handler(request({ text: "Hello" }));
    assert.ok([401, 403].includes(result.status));
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = handlerFor();
  assert.equal((await handler(request({ text: "Hello" }, false))).status, 401);
  assert.equal(calls.length, 0);
});
test("chat recipient comes from server secrets, never caller input", async () => {
  const { handler, calls } = handlerFor();
  assert.equal(
    (await handler(request({ text: "Hello", chat_id: "attacker" }))).status,
    200,
  );
  assert.equal(calls[0].body.chat_id, "admin-chat");
  assert.equal(calls[0].body.parse_mode, undefined);
});
test("failed Telegram delivery returns failure, not a success toast", async () => {
  const { handler } = handlerFor({ delivery: false });
  const result = await handler(request({ text: "Hello" }));
  assert.equal(result.status, 502);
  assert.equal((await result.json()).ok, false);
});
test("user cannot broadcast or send oversized notifications", async () => {
  const { handler, calls } = handlerFor();
  assert.equal(
    (await handler(request({ text: "Hello", recipient: "both" }))).status,
    403,
  );
  assert.equal(
    (await handler(request({ text: "a".repeat(3501) }))).status,
    400,
  );
  assert.equal(calls.length, 0);
});
