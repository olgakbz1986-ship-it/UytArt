import { PRODUCTS, CATEGORIES, type Product } from "../data/seed";
import { useSellerAccount } from "./seller";
import { isZoneMatch } from "./geo";
import { useAppStore } from "./store";

/* Преобразует активные товары продавца в формат витрины */
export function sellerMarketProducts(): Product[] {
  const items = useSellerAccount.getState().products.filter((p) => !p.archived);
  return items.map((p) => {
    const cat = CATEGORIES.find((c) => c.name === p.category);
    const firstImg = p.media?.find((m) => m.type === "image")?.url;
    const firstVid = p.media?.find((m) => m.type === "video")?.url;
    return {
      id: "sp-" + p.id,
      slug: "sp-" + p.id,
      name: p.name,
      emoji: "🛍️",
      art: ["#eae4d4", "#2d5f4c"],
      image: firstImg || firstVid || "",
      sub: p.manufacturer || "Ручная работа",
      sku: "SP-" + (p.id.replace(/\D/g, "").slice(-6) || "0001"),
      price: p.price,
      categoryId: cat ? cat.slug : p.category,
      vendorId: "vendor-seller",
      product_type: "handmade",
      is_non_returnable: false,
      rating: 0,
      reviewsCount: 0,
      stock: 99,
      views: 0,
      material: p.materials && p.materials.length ? p.materials.join(", ") : "Микс материалов",
      style: "Эко",
      color: "Медовый",
      size: p.dimensions && p.dimensions.length ? `${p.dimensions.length}×${p.dimensions.width} ${p.dimensions.unit || "см"}` : "Универсальный",
      tags: p.tags || [],
      description: p.description || "",
      createdAt: p.createdAt,
      isNew: true,
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
    return isZoneMatch(item?.deliveryZone, item?.sellerCity || "", city);
  });
}
