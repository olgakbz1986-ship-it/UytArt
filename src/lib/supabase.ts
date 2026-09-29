import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabaseEnabled = Boolean(url && key && url.startsWith("https://"));

export const supabase = supabaseEnabled
  ? createClient(url, key)
  : null;

if (!supabaseEnabled) {
  console.warn("[supabase] ключи не найдены в .env.local — работаем в локальном режиме");
}
