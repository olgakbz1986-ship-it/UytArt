import { PRODUCTS, CATEGORIES, type Product } from "../data/seed";
import { useSellerAccount } from "./seller";

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
export function marketProducts(): Product[] {
  return [...PRODUCTS, ...sellerMarketProducts()];
}
