import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const tables = [
  "quizzes",
  "rewards_penalties",
  "user_inventory",
  "wheel_settings",
  "couple_entries",
  "love_members",
  "audit_logs",
];
async function fetchTable(table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from(table).select("*");
    if (!["wheel_settings", "love_members"].includes(table))
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    query =
      table === "audit_logs"
        ? query.limit(50)
        : query.range(offset, offset + 999);
    const result = await query;
    if (result.error) return result;
    rows.push(...(result.data || []));
    if (table === "audit_logs" || result.data.length < 1000)
      return { data: rows };
  }
}
export function useLoveData(userId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const version = ++generation.current;
    try {
      const results = await Promise.all(tables.map(fetchTable));
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
      if (version !== generation.current) return;
      setData(
        Object.fromEntries(
          tables.map((table, i) => [table, results[i].data || []]),
        ),
      );
      setError("");
    } catch (err) {
      if (version === generation.current)
        setError(`Chưa tải được dữ liệu: ${err.message}`);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let timer;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    };
    reload();
    const channel = supabase.channel(`love-space-${userId}`);
    tables.forEach((table) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        reload,
      ),
    );
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));
    const visible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("online", reload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      invalidate();
      clearTimeout(timer);
      supabase.removeChannel(channel);
      window.removeEventListener("online", reload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, userId, invalidate]);
  return { data, error, connected, refresh };
}
