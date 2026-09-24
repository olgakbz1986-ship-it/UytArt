import { Link } from "react-router-dom";
import { ShieldCheck, Star, Wrench, ArrowRight } from "lucide-react";
import { fmt } from "../data/seed";
import { marketProducts } from "../lib/market";
import { ProductGrid } from "../components/product";
import { Reveal } from "../components/ui";

export default function HomePage() {
  const sellerHits = marketProducts().filter((p) => p.id.startsWith("sp-")).filter((p) => p.isHit || p.rating >= 4.8);
  const featured = sellerHits.slice(0, 8);

  return (
    <div>
      {/* ---------- hero: слоган единым цветом, премиальный сериф, без CTA ---------- */}
      <section className="relative overflow-hidden bg-dark text-cream">
        <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: "radial-gradient(circle at 18% 28%, #D98E32 0, transparent 42%), radial-gradient(circle at 82% 72%, #2D5F4C 0, transparent 48%)" }} />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-20 sm:py-28 relative">
          <h1 className="font-lux text-[clamp(46px,6.2vw,80px)] leading-[1.02] text-cream fade-up" style={{ animationDelay: "60ms" }}>
            Пространство,
            <br />
            у которого есть автор
          </h1>
          <p className="text-cream/70 text-[16px] sm:text-[17px] leading-relaxed mt-7 max-w-xl fade-up" style={{ animationDelay: "120ms" }}>
            От авторского декора до техники, одежды и товаров для дома. Опишите интерьер — AI-дизайнер соберёт
            подборку, а безопасная сделка защитит оплату.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-10 text-[13px] text-cream/60 fade-up" style={{ animationDelay: "180ms" }}>
            <span className="flex items-center gap-2"><ShieldCheck size={17} className="text-success" /> Деньги — после отправки</span>
            <span className="flex items-center gap-2"><Star size={17} className="text-premium" /> Кураторский отбор</span>
            <span className="flex items-center gap-2"><Wrench size={17} className="text-accent" /> Индивидуальные заказы</span>
          </div>
        </div>
      </section>

      {/* ---------- бегущая лента доверия ---------- */}
      <section className="bg-cream border-b border-line-soft py-4 overflow-hidden">
        <div className="marquee-track flex gap-10 w-max">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex gap-10 items-center">
              {["Деньги уходят мастеру только после отправки", "СДЭК · Boxberry · Почта России", "Возврат 7 дней", "1 240 мастерских по всей России", "Чеки по 54-ФЗ", "Кураторский отбор продавцов"].map((t) => (
                <span key={t} className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-soft whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- хиты и новинки ---------- */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-14">
        <Reveal>
          <div className="flex items-end justify-between mb-7 flex-wrap gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2">Выбор покупателей</p>
              <h2 className="font-display font-bold text-[clamp(26px,3.4vw,38px)] text-ink">Хиты и новинки</h2>
            </div>
            <Link to="/catalog" className="text-sm font-bold text-accent-deep hover:text-accent flex items-center gap-1.5 transition-colors">
              Смотреть все <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
          {featured.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-12 text-center">
              <p className="text-[40px] mb-3">🏺</p>
              <p className="font-display font-bold text-[18px] text-ink mb-2">Здесь появятся первые хиты</p>
              <p className="text-[13.5px] text-ink-soft max-w-md mx-auto">Мастерские только присоединяются к Quantiform. Как только мастера выставят товары — лучшие из них будут на этой странице.</p>
              <Link to="/masters" className="inline-flex items-center gap-2 mt-6 h-11 px-6 rounded-[10px] bg-dark text-cream text-[13.5px] font-bold hover:bg-dark-deep transition-colors">Смотреть мастерские <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <ProductGrid items={featured} />
          )}
      </section>

    </div>
  );
}
