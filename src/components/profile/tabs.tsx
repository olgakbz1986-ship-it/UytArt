/* ============================================================
   Профиль покупателя — общие типы и реестр вкладок кабинета
   (ЗАДАЧА 4, п.17: модульная разбивка profile.tsx).
   ============================================================ */
import type { Package, Bot, Heart, Bell, Sparkles, BellRing, ClipboardList, MapPin, Gift, Flag, Settings } from "lucide-react";

export type Tab = "orders" | "agent" | "favorites" | "subscriptions" | "feed" | "concepts" | "prices" | "custom" | "addresses" | "bonus" | "complaints" | "settings";

export interface TabDef {
  id: Tab;
  label: string;
  icon: typeof Package | typeof Bot | typeof Heart | typeof Bell | typeof Sparkles | typeof BellRing
      | typeof ClipboardList | typeof MapPin | typeof Gift | typeof Flag | typeof Settings;
  locked?: boolean;
}
