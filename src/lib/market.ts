import { PRODUCTS, CATEGORIES, type Product } from "../data/seed";
import { useSellerAccount, useSellerReg, sellerProfileOf, type SellerProductItem, type SellerProfile } from "./seller";
import { isZoneMatch } from "./geo";
import { useAppStore } from "./store";
import { useMemo, useEffect } from "react";
import { useDigitalStore } from "./digital";
import type { DigitalProduct, DigitalProductType } from "../types/digital";

/* ============================================================
   АДАПТЕР ЦИФРОВЫХ ТОВАРОВ (digital → витрина)
   Единственное место преобразования DigitalProduct в формат
   витрины Product. При изменении структуры цифровых продуктов
   правки вносятся только здесь. Префикс id "dp-" — аналог "sp-".
   ============================================================ */

/* Карта соответствия типов цифровых товаров категориям витрины.
   Единственный источник истины маппинга (используются slug подкатегорий
   из CATEGORIES: sites_templates / prompts / ai_agents / subscriptions). */
export const DIGITAL_TYPE_TO_CATEGORY: Record<DigitalProductType, { categoryId: string; sub: string }> = {
  site:         { categoryId: "sites_templates", sub: "сайты-экосистемы" },
  prompt:       { categoryId: "prompts",         sub: "библиотеки-промтов" },
  skill:        { categoryId: "ai_agents",       sub: "скиллы-для-голосовых-ассистентов" },
  agent:        { categoryId: "ai_agents",       sub: "готовые-ии-агенты" },
  subscription: { categoryId: "subscriptions",   sub: "подписка-на-ии-агентов-и-скиллы" },
};

/* Палитра градиентов-заглушек для карточек без превью */
const DIGITAL_ARTS: [string, string][] = [
  ["#4c3a8f", "#6f54c9"], ["#2d5f7c", "#4a8fb0"], ["#7c4a2d", "#b0764a"],
  ["#2f6b4f", "#4aa37a"], ["#8f3a5e", "#c95488"],
];

/** Преобразует опубликованный цифровой товар в формат витрины. */
export function digitalToMarketProduct(d: DigitalProduct): Product {
  const map = DIGITAL_TYPE_TO_CATEGORY[d.type];
  const cat = map ? CATEGORIES.find((c) => c.slug === map.categoryId) : undefined;
  const art = DIGITAL_ARTS[Math.abs(d.id.split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0)) % DIGITAL_ARTS.length];
  return {
    id: "dp-" + d.id,
    slug: "dp-" + d.id,
    name: d.title,
    emoji: cat?.emoji || "🤖",
    art,
    image: d.previewUrl || "",
    sub: map?.sub || "",
    sku: "DP-" + (d.id.replace(/\D/g, "").slice(-6) || "0001"),
    price: d.price,
    categoryId: cat ? cat.slug : "prompts",
    vendorId: "vendor-seller",
    product_type: "ready_made",
    is_non_returnable: true,
    rating: d.stats?.rating || 0,
    reviewsCount: d.stats?.salesCount || 0,
    stock: d.status === "published" ? 99 : 0, /* цифровой товар всегда «в наличии», пока опубликован */
    views: d.stats?.downloads || 0,
    material: "Цифровой товар",
    style: "Digital",
    color: "—",
    size: "—",
    tags: [d.type, d.licenseType],
    description: d.description || "",
    createdAt: d.createdAt,
    isNew: true,
    shopName: cat?.name || "Цифровые товары",
    /* специфичные атрибуты цифрового товара — опциональные маркеры Product */
    digitalType: d.type,
    digitalId: d.id,
    digitalVersion: d.version,
    digitalSalesCount: d.stats?.salesCount || 0,
    testDriveLimit: d.testDriveLimit || 0,
  };
}

/* Опубликованные цифровые товары в формате витрины (архив исключается) */
export function digitalMarketProducts(): Product[] {
  return useDigitalStore.getState().products
    .filter((d) => d.status === "published")
    .map(digitalToMarketProduct);
}

/* Загрузка публичного каталога цифровых товаров с сервера.
   Единая точка синхронизации для витрины: ответ /api/digital/products
   содержит только published-товары всех продавцов платформы без секретных
   полей (systemPrompt/agentConfig/fileUrl проецируются на сервере).
   mergeFromServer идемпотентен и не перезаписывает локальные объекты. */
let digitalCatalogLoading = false;
export function ensureDigitalCatalog(): void {
  if (digitalCatalogLoading) return;
  digitalCatalogLoading = true;
  fetch("/api/digital/products", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && Array.isArray(d.products)) useDigitalStore.getState().mergeFromServer({ products: d.products });
    })
    .catch(() => { /* офлайн-режим: витрина работает на persist-сторе */ })
    .finally(() => { digitalCatalogLoading = false; });
}

/* Профиль продавца для товара: реестр по ownerId (Проблема №3 —
   карточка товара = зеркало актуального профиля, без снимков). */
function profileForItem(item: SellerProductItem): SellerProfile | null {
  const st = useSellerReg.getState();
  if (item.ownerId && st.profilesByAccount[item.ownerId]) return st.profilesByAccount[item.ownerId];
  /* legacy fallback: реквизиты, записанные прямо в товар */
  if (item.shopName) {
    return {
      accountId: item.ownerId || "", status: "active", legalType: (item.legalType as any) || null,
      shopName: item.shopName, contactName: "", email: "", phone: "", city: item.sellerCity || "",
      inn: item.inn || "", ogrn: "", legalName: "", legalAddress: "", slug: "",
      production_region: "", commissionRate: 15, submittedAt: "", isMaster: false,
      acceptsCustomOrders: false, masterName: "", yearsExperience: "", businessStory: "",
      achievements: "", categories: [], productionGallery: [], videoTourUrl: "",
      shopLogo: item.avatar,
    } as SellerProfile;
  }
  return null;
}

/* Преобразует активные товары продавцов в формат витрины.
   Реквизиты магазина резолвятся из профиля «на лету». */
export function sellerMarketProducts(): Product[] {
  const items = useSellerAccount.getState().products.filter((p) => !p.archived && !p.isDraft);
  return items.map((p) => {
    const cat = CATEGORIES.find((c) => c.name === p.category);
    const firstImg = p.media?.find((m) => m.type === "image")?.url;
    const firstVid = p.media?.find((m) => m.type === "video")?.url;
    const prof = profileForItem(p);
    return {
      id: "sp-" + p.id,
      slug: "sp-" + p.id,
      name: p.name,
      emoji: "🛍️",
      art: ["#eae4d4", "#2d5f4c"],
      image: firstImg || firstVid || "",
      media: p.media,
      sub: p.manufacturer || prof?.shopName || "Ручная работа",
      sku: "SP-" + (p.id.replace(/\D/g, "").slice(-6) || "0001"),
      price: p.price,
      categoryId: cat ? cat.slug : p.category,
      vendorId: "vendor-seller",
      product_type: "handmade",
      is_non_returnable: false,
      rating: 0,
      reviewsCount: 0,
      stock: 99,
      views: p.views || 0,
      material: p.materials && p.materials.length ? p.materials.join(", ") : "Микс материалов",
      style: "Эко",
      color: "Медовый",
      size: p.dimensions && p.dimensions.length ? `${p.dimensions.length}×${p.dimensions.width} ${p.dimensions.unit || "см"}` : "Универсальный",
      tags: p.tags || [],
      description: p.description || "",
      createdAt: p.createdAt,
      isNew: true,
      ownerId: p.ownerId,
      shopName: prof?.shopName || p.shopName,
      sellerCity: prof?.city || p.sellerCity,
      legalType: prof?.legalType || p.legalType,
      inn: prof?.inn || p.inn,
      avatar: prof?.shopLogo || prof?.masterAvatar || p.avatar,
      contactName: prof?.contactName,
      masterName: prof?.masterName,
      businessStory: prof?.businessStory,
      isMaster: prof?.isMaster,
      acceptsCustomOrders: prof?.acceptsCustomOrders,
      ai_assets: p.ai_assets,
      ai_status: p.ai_status,
      deliveryZone: p.deliveryZone,
    } as unknown as Product;
  });
}

/* Единый список: демо + реальные товары продавцов + цифровые товары */
export function marketProducts(buyerCity?: string): Product[] {
  const st = useAppStore.getState();
  const city = buyerCity ?? st.viewerCity ?? (st.addresses.find((a) => a.isDefault)?.city || "");
  const all = [...PRODUCTS, ...sellerMarketProducts(), ...digitalMarketProducts()];
  if (!city) return all;
  return all.filter((p) => {
    /* цифровые товары не имеют географических ограничений — выдача мгновенная */
    if (p.id.startsWith("dp-")) return true;
    if (!p.id.startsWith("sp-")) return true;
    const item = useSellerAccount.getState().products.find((x) => x.id === p.id.slice(3));
    // Если зоны доставки нет или она "по всей России", показываем всем
    if (!item?.deliveryZone || item.deliveryZone.mode === "nationwide") return true;
    return isZoneMatch(item.deliveryZone, item.sellerCity || "", city);
  });
}

/* ============================================================
   РЕАКТИВНЫЕ ХУКИ (Проблема №2)
   Подписка на сторы гарантирует: изменил товар или профиль →
   каталог, поиск, рекомендации и страница товара обновляются
   мгновенно. Один товар = одно состояние во всём приложении.
   ============================================================ */
export function useMarketProducts(buyerCity?: string): Product[] {
  const products = useSellerAccount((s) => s.products);
  const profiles = useSellerReg((s) => s.profilesByAccount);
  const digital = useDigitalStore((s) => s.products); /* цифровые товары: подписка на стор */
  const viewerCity = useAppStore((s) => s.viewerCity);
  const addresses = useAppStore((s) => s.addresses);
  void products; void profiles; void digital; /* подписка на изменения */
  /* витрина — единый источник данных: подтягиваем публичные цифровые
     товары с сервера (только published, без секретных полей) */
  useEffect(() => { ensureDigitalCatalog(); }, []);
  return useMemo(() => marketProducts(buyerCity), [products, profiles, digital, viewerCity, addresses, buyerCity]);
}

export function useSellerMarketProducts(): Product[] {
  const products = useSellerAccount((s) => s.products);
  const profiles = useSellerReg((s) => s.profilesByAccount);
  void products; void profiles;
  return useMemo(() => sellerMarketProducts(), [products, profiles]);
}

/* Товар витрины по id ("sp-..." или demo-slug) — реактивно */
export function useMarketProduct(idOrSlug: string | undefined | null): Product | undefined {
  const list = useMarketProducts();
  return useMemo(() => list.find((x) => x.id === idOrSlug || x.slug === idOrSlug), [list, idOrSlug]);
}

export { sellerProfileOf };

