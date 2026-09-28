import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { ok: false });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return reply(401, { ok: false });
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) return reply(401, { ok: false });
    const { data: member, error } = await client
      .from("love_members")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (error || !member) return reply(403, { ok: false });
    const { text, recipient = "partner" } = await request.json();
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 3500 ||
      !["partner", "both"].includes(recipient)
    )
      return reply(400, { ok: false });
    if (recipient === "both" && member.role !== "admin")
      return reply(403, { ok: false });
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const adminId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
    const userId = Deno.env.get("TELEGRAM_USER_CHAT_ID");
    const recipients = [
      ...new Set(
        recipient === "both"
          ? [adminId, userId]
          : [member.role === "admin" ? userId : adminId],
      ),
    ];
    if (!token || recipients.some((id) => !id))
      return reply(503, {
        ok: false,
        error: "Notifications are not configured",
      });
    const results = await Promise.all(
      recipients.map(async (chat_id) => {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id, text }),
            signal: AbortSignal.timeout(8000),
          },
        );
        const body = await response.json();
        return response.ok && body.ok === true;
      }),
    );
    return reply(results.every(Boolean) ? 200 : 502, {
      ok: results.every(Boolean),
    });
  } catch {
    return reply(502, { ok: false, error: "Notification unavailable" });
  }
});
