import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDigitalStore } from "../lib/digital";
import { useAppStore } from "../lib/store";
import { Btn } from "../components/ui";
import type { DigitalPurchase, DigitalProduct } from "../types/digital";

export function DigitalPurchasesPage() {
  const session = useAppStore((s) => s.session);
  const purchases = useDigitalStore((s) => s.purchases);
  const products = useDigitalStore((s) => s.products);
  const [myPurchases, setMyPurchases] = useState<Array<DigitalPurchase & { product?: DigitalProduct }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.userId) {
      setLoading(false);
      return;
    }
    // Фильтруем покупки текущего пользователя
    const filtered = purchases
      .filter((p) => p.userId === session.userId)
      .map((p) => ({
        ...p,
        product: products.find((prod) => prod.id === p.productId),
      }))
      .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
    setMyPurchases(filtered);
    setLoading(false);
  }, [session?.userId, purchases, products]);

  const handleDownload = (productId: string) => {
    window.open(`/api/digital/${productId}/download`, "_blank");
  };

  const handleViewContent = (productId: string) => {
    window.open(`/api/digital/${productId}/content`, "_blank");
  };

  if (!session) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center">
        <p className="text-lg mb-4">Войдите, чтобы просмотреть покупки</p>
        <Link to="/auth"><Btn variant="primary">Войти</Btn></Link>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-[1280px] mx-auto px-4 py-16">Загрузка...</div>;
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-[28px] text-ink mb-6">Мои цифровые покупки</h1>

      {myPurchases.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-2xl p-10 text-center">
          <p className="text-[40px] mb-2">🛒</p>
          <p className="font-display font-bold text-[18px] text-ink mb-1">Пока нет покупок</p>
          <p className="text-[13px] text-ink-soft mb-5">Перейдите в каталог цифровых товаров, чтобы найти что-то интересное.</p>
          <Link to="/catalog"><Btn variant="primary">Перейти в каталог</Btn></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myPurchases.map((p) => (
            <div key={p.id} className="bg-surface border border-line-soft rounded-2xl shadow-card p-4 flex gap-4 flex-wrap sm:flex-nowrap items-start">
              <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-line-soft flex items-center justify-center text-[26px]">
                {p.product?.previewUrl ? (
                  <img src={p.product.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>📦</span>
                )}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {p.product?.type === "site" && "Сайт / шаблон"}
                    {p.product?.type === "prompt" && "Промт"}
                    {p.product?.type === "skill" && "Скилл для ИИ"}
                    {p.product?.type === "agent" && "ИИ-агент"}
                    {p.product?.type === "subscription" && "Подписка"}
                  </span>
                  <span className="text-[11px] text-ink-mute">v{p.product?.version || "1.0"}</span>
                </div>
                <Link to={`/digital/${p.productId}`} className="font-display font-bold text-[15px] text-ink hover:underline leading-snug break-words">
                  {p.product?.title || "Товар удалён"}
                </Link>
                <p className="text-[12px] text-ink-mute mt-1">
                  Куплено: {new Date(p.purchasedAt).toLocaleDateString("ru-RU")} · {p.product?.price} ₽
                </p>
              </div>
              <div className="flex gap-2 flex-wrap items-start w-full sm:w-auto">
                <Btn size="sm" variant="primary" onClick={() => handleDownload(p.productId)}>
                  Скачать
                </Btn>
                {(p.product?.type === "prompt" || p.product?.type === "agent") && (
                  <Btn size="sm" variant="outline" onClick={() => handleViewContent(p.productId)}>
                    Открыть доступ
                  </Btn>
                )}
                <Link to={`/digital/${p.productId}`}>
                  <Btn size="sm" variant="ghost">Подробнее</Btn>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
