import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isConfigured = Boolean(url && key);
export const supabase = isConfigured ? createClient(url, key) : null;

export async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export async function notifyPartner(text, recipient = "partner") {
  const { data, error } = await supabase.functions.invoke("notify-partner", {
    body: { text, recipient },
  });
  if (error || !data?.ok) return false;
  return true;
}
