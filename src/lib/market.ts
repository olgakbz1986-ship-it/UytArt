import { PRODUCTS, CATEGORIES, type Product } from "../data/seed";
import { useSellerAccount, useSellerReg, sellerProfileOf, type SellerProductItem, type SellerProfile, type DeliveryZone, type ProductMedia } from "./seller";
import { isZoneMatch } from "./geo";
import { useAppStore } from "./store";
import { useMemo, useEffect, useState } from "react";
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
      if (d && Array.isArray(d.products)) {
        /* витринная синхронизация: серверный published-снимок актуальнее
           локального persist-кэша, а приватные поля (systemPrompt/agentConfig/
           fileUrl) на клиенте у витринных чужих товаров быть не должно —
           поэтому серверные данные записываются с приоритетом поверх кэша */
        useDigitalStore.getState().mergeFromServer({ products: d.products }, true);
      }
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

/* Публичная лента продавца (витрина + кабинет + подписки).
   ИСПРАВЛЕНИЕ: раньше витрина читала товары ТОЛЬКО из локального
   persist-стора текущего браузера ("uyutart-seller-account-v3"),
   который по природе своей приватен и синхронизируется с сервером
   лишь частично. Из-за этого покупатель, зашедший со своего аккаунта
   (другой браузер/профиль), физически не видел товар, опубликованный
   продавцом: GET /api/products возвращал его с сервера, но в ленту
   он не попадал — список строился из чужого локального кэша.

   Новый контракт: единый публичный источник — серверный GET /api/products
   (все published-товары всех продавцов, уже прошедшие гео-фильтр),
   плюс локальные товары текущего аккаунта (мгновенная реакция на
   публикацию без ожидания ответа сервера и работа офлайн). Дубликаты
   по id разрешаются в пользу ЛОКАЛЬНОЙ записи: она всегда свежее
   (только что отредактированная карточка владельца важнее снимка). */

let publicProductsCache: any[] | null = null;   /* null = ещё ни разу не загружали */
let publicProductsLoading = false;
const publicProductsListeners = new Set<() => void>();

/** Загружает публичные товары с сервера в витринный кэш. Идемпотентна,
    повторяющиеся вызовы во время загрузки игнорируются. */
export function ensurePublicProducts(): void {
  if (publicProductsLoading) return;
  publicProductsLoading = true;
  const st = useAppStore.getState();
  const city = st.viewerCity || (st.addresses.find((a) => a.isDefault)?.city || "");
  fetch("/api/products" + (city ? "?city=" + encodeURIComponent(city) : ""), { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.ok && Array.isArray(d.products)) {
        publicProductsCache = d.products;
        publicProductsListeners.forEach((f) => f());
      }
    })
    .catch(() => { /* офлайн-режим: витрина живёт на локальном сторе */ })
    .finally(() => { publicProductsLoading = false; });
}

/** Подписка витрины на обновление публичного кэша (для реактивных хуков). */
function subscribePublicProducts(cb: () => void): () => void {
  publicProductsListeners.add(cb);
  return () => { publicProductsListeners.delete(cb); };
}

/** Мгновенное обновление публичного кэша после успешной публикации/
    правки товара (POST /api/products → ok). Вызывается из ProductEditor,
    чтобы товар появился у всех покупателей без перезагрузки страницы. */
export function publicProductsUpsert(item: any): void {
  if (!item || !item.id) return;
  const list = (publicProductsCache || []).filter((x) => String(x.id) !== String(item.id));
  publicProductsCache = [{ ...item }, ...list];
  publicProductsListeners.forEach((f) => f());
}

/** Единый мерженный список товаров продавцов для витрины. */
function mergedSellerItems(): SellerProductItem[] {
  const local = useSellerAccount.getState().products;
  const byId = new Map<string, SellerProductItem>();
  for (const p of publicProductsCache || []) {
    if (!p || !p.id) continue;
    byId.set(String(p.id), p as SellerProductItem);
  }
  /* локальные записи поверх серверных: владелец видит свою правку сразу,
     а серверный снимок не «откатывает» её до следующей перезагрузки */
  for (const p of local) byId.set(String(p.id), p);
  return [...byId.values()];
}

/* ИСПРАВЛЕНИЕ «невидимого товара» (сквозной аудит публикации):
   1) ГЕО-КОНТРАКТ. Товары, сохранённые в persist-стор до появления
      формы географии, могут не иметь поля deliveryZone. Раньше такой
      товар считался «без ограничений», но если у продавца при этом
      указан город (sellerCity/город профиля), покупатель из другого
      города на клиентском geo-дубле фильтрации получал false и товар
      исчезал из ленты — при том что сервер его отдавал. Теперь запись
      без явной зоны нормализуется в контракт формы:
      доставка по всей РФ включена → nationwide; иначе → город продавца.
   2) ДЕМОН-ФИЛЬТР. Каталог скрывает черновики и товары без медиа
      (публикация требует фото). Но legacy/серверные записи исторически
      используют поле preview (dataURL) вместо media[] — их надо
      учитывать, иначе легальный опубликованный товар вырезается как
      «без фото». */
function effectiveDeliveryZone(item: any): DeliveryZone | undefined {
  if (item?.deliveryZone) return item.deliveryZone as DeliveryZone;
  const city = String(item?.sellerCity || "").trim();
  if (!city || city === "Россия") return { mode: "nationwide" };
  return { mode: "cities", cities: [city] };
}

function isPubliclyVisibleItem(item: any): boolean {
  if (!item || item.archived) return false;
  if ((item as any).isDraft) return false;
  const hasMedia =
    (Array.isArray(item.media) && item.media.length > 0) ||
    !!item.preview ||
    !!item.image;
  return hasMedia;
}

export function sellerMarketProducts(): Product[] {
  const items = mergedSellerItems().filter(isPubliclyVisibleItem);
  return items.map((p) => {
    const cat = CATEGORIES.find((c) => c.name === p.category);
    const firstImg = p.media?.find((m) => m.type === "image")?.url;
    const firstVid = p.media?.find((m) => m.type === "video")?.url;
    const prof = profileForItem(p);
    /* ИСПРАВЛЕНИЕ «битого превью»: persist-стор продавца приватен для
       браузера владельца (dataURL фото не уезжает в чужие браузеры), а
       серверный GET /api/products отдаёт запись без медиа. Поэтому при
       сборке витринной карточки подтягиваем превью из любого доступного
       источника: media[] → preview → image → локальный persist-кэш того
       же id. Иначе покупатель получал товар с пустой картинкой, и
       демон-фильтр каталога вырезал его как «товар без фото». */
    const localMirror = useSellerAccount.getState().products.find((x) => String(x.id) === String(p.id)) as any;
    const firstImgAny =
      firstImg || firstVid ||
      (p as any).preview || (p as any).image ||
      localMirror?.media?.find((m: ProductMedia) => m.type === "image")?.url ||
      localMirror?.preview || "";
    return {
      id: "sp-" + p.id,
      slug: "sp-" + p.id,
      name: p.name,
      emoji: "🛍️",
      art: ["#eae4d4", "#2d5f4c"],
      image: firstImgAny,
      media: (Array.isArray(p.media) && p.media.length ? p.media : localMirror?.media) || undefined,
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
      deliveryZone: effectiveDeliveryZone(p),
    } as unknown as Product;
  });
}

/* Единый список: демо + реальные товары продавцов + цифровые товары */
export function marketProducts(buyerCity?: string): Product[] {
  const st = useAppStore.getState();
  const city = buyerCity ?? st.viewerCity ?? (st.addresses.find((a) => a.isDefault)?.city || "");
  const all = [...PRODUCTS, ...sellerMarketProducts(), ...digitalMarketProducts()];
  if (!city) return all;
  /* ИСПРАВЛЕНИЕ: источник данных для клиентского geo-дубля фильтра —
     тот же мерженный список (сервер + локальные правки), а не только
     приватный persist-стор. Иначе товар чужого продавца, приехавший с
     сервера, не находил свою зону доставки и отсекался на клиенте. */
  const zoneById = new Map<string, SellerProductItem>();
  for (const it of mergedSellerItems()) zoneById.set(String(it.id), it);
  return all.filter((p) => {
    /* цифровые товары не имеют географических ограничений — выдача мгновенная */
    if (p.id.startsWith("dp-")) return true;
    if (!p.id.startsWith("sp-")) return true;
    const item = zoneById.get(p.id.slice(3));
    // Единый нормализованный гео-контракт: явная зона товара, иначе —
    // производная от города продавца (см. effectiveDeliveryZone).
    const zone = effectiveDeliveryZone(item ?? p);
    // Если зоны доставки нет или она "по всей России", показываем всем
    if (!zone || zone.mode === "nationwide") return true;
    return isZoneMatch(zone, item?.sellerCity || (p as any).sellerCity || "", city);
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
  /* ИСПРАВЛЕНИЕ «невидимого товара»: витрина обязана читать ПУБЛИЧНЫЕ
     товары всех продавцов с сервера, а не только persist-кэш текущего
     браузера. Кэш обновляется при монтировании ленты и при каждом
     изменении города просмотра (серверный гео-фильтр зависит от city). */
  const [publicRev, setPublicRev] = useState(0);
  useEffect(() => {
    const bump = () => setPublicRev((n) => n + 1);
    const unsub = subscribePublicProducts(bump);
    ensurePublicProducts();
    return unsub;
  }, [viewerCity]);
  return useMemo(() => marketProducts(buyerCity), [products, profiles, digital, viewerCity, addresses, buyerCity, publicRev]);
}

export function useSellerMarketProducts(): Product[] {
  const products = useSellerAccount((s) => s.products);
  const profiles = useSellerReg((s) => s.profilesByAccount);
  void products; void profiles;
  const [publicRev, setPublicRev] = useState(0);
  useEffect(() => {
    const bump = () => setPublicRev((n) => n + 1);
    const unsub = subscribePublicProducts(bump);
    ensurePublicProducts();
    return unsub;
  }, []);
  return useMemo(() => sellerMarketProducts(), [products, profiles, publicRev]);
}

/* Товар витрины по id ("sp-..." или demo-slug) — реактивно */
export function useMarketProduct(idOrSlug: string | undefined | null): Product | undefined {
  const list = useMarketProducts();
  return useMemo(() => list.find((x) => x.id === idOrSlug || x.slug === idOrSlug), [list, idOrSlug]);
}

export { sellerProfileOf };

