import { PRODUCTS, CATEGORIES, type Product } from "../data/seed";
import { useSellerAccount, useSellerReg, sellerProfileOf, type SellerProductItem, type SellerProfile } from "./seller";
import { isZoneMatch } from "./geo";
import { useAppStore } from "./store";
import { useMemo } from "react";

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

/* Единый список: демо + реальные товары продавцов */
export function marketProducts(buyerCity?: string): Product[] {
  const st = useAppStore.getState();
  const city = buyerCity ?? st.viewerCity ?? (st.addresses.find((a) => a.isDefault)?.city || "");
  const all = [...PRODUCTS, ...sellerMarketProducts()];
  if (!city) return all;
  return all.filter((p) => {
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
  const viewerCity = useAppStore((s) => s.viewerCity);
  const addresses = useAppStore((s) => s.addresses);
  void products; void profiles; /* подписка на изменения */
  return useMemo(() => marketProducts(buyerCity), [products, profiles, viewerCity, addresses, buyerCity]);
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

