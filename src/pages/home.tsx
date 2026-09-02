import { Link } from "react-router-dom";
import { ShieldCheck, Star, Wrench, ArrowRight, Sparkles } from "lucide-react";
import { GROUPS, GROUP_IMG, PRODUCTS, REVIEWS, VENDORS } from "../data/seed";
import { ProductGrid } from "../components/product";
import { GroupImg, Reveal, Rating } from "../components/ui";

export default function HomePage() {
  const featured = PRODUCTS.filter((p) => p.isHit || p.rating >= 4.8).slice(0, 8);
  const customMade = PRODUCTS.filter((p) => p.product_type === "custom_made").slice(0, 4);

  return (
    <div>
      {/* ---------- hero: слоган единым цветом, премиальный сериф ---------- */}
      <section className="relative overflow-hidden bg-dark text-cream">
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{ backgroundImage: "radial-gradient(circle at 18% 28%, #D98E32 0, transparent 42%), radial-gradient(circle at 82% 72%, #2D5F4C 0, transparent 48%)" }}
        />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-20 sm:py-28 relative">
          <h1 className="font-lux text-[clamp(46px,6.2vw,80px)] leading-[1.02] text-cream fade-up" style={{ animationDelay: "60ms" }}>
            Пространство,
            <br />
            у которого есть автор
          </h1>
          <p className="text-cream/70 text-[16px] sm:text-[17px] leading-relaxed mt-7 max-w-xl fade-up" style={{ animationDelay: "120ms" }}>
            AI-маркетплейс авторского декора и товаров для дома. Опишите интерьер — AI-дизайнер соберёт
            подборку от проверенных мастеров со всей России, а безопасная сделка защитит оплату.
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
              {["Деньги уходят мастеру только после отправки", "СДЭК · Boxberry · Почта России", "Возврат 7 дней", "1240 мастерских по всей России", "Чеки по 54-ФЗ", "Кураторский отбор продавцов"].map((t) => (
                <span key={t} className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-soft whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- AI-подбор (киллер-фича) ---------- */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-14">
        <Reveal>
          <div className="rounded-3xl overflow-hidden bg-ai text-cream relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 85% 15%, #D98E32 0, transparent 45%)" }} />
            <div className="grid md:grid-cols-[1.2fr_1fr] relative">
              <div className="p-8 sm:p-12">
                <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-accent mb-4"><Sparkles size={14} /> AI-дизайнер · YandexGPT</p>
                <h2 className="font-display font-bold text-[clamp(24px,3vw,34px)] leading-tight">Загрузите фото комнаты — получите готовый образ</h2>
                <p className="text-cream/70 text-[14.5px] leading-relaxed mt-4 max-w-md">
                  AI сохранит геометрию и освещение, расставит «горячие точки» и подберёт реальные товары из каталога.
                  Понравившийся концепт сохранится в личном кабинете.
                </p>
                <Link to="/ai-assistant" className="inline-flex items-center gap-2 mt-7 h-12 px-6 rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors">
                  Попробовать AI-подбор <ArrowRight size={17} />
                </Link>
              </div>
              <div className="p-6 sm:p-8 flex items-center justify-center">
                <span className="text-[120px] float-y">🛋️</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- группы каталога ---------- */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-14">
        <Reveal>
          <div className="flex items-end justify-between mb-7 flex-wrap gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2">Большой маркетплейс</p>
              <h2 className="font-display font-bold text-[clamp(26px,3.4vw,38px)] text-ink">Группы каталога</h2>
            </div>
            <Link to="/catalog" className="text-sm font-bold text-accent-deep hover:text-accent flex items-center gap-1.5 transition-colors">
              Все товары <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {GROUPS.map((g, i) => (
            <Reveal key={g.id} delay={(i % 4) * 60}>
              <Link to={`/catalog?group=${g.id}`}
                className="group relative rounded-2xl overflow-hidden shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 block bg-surface">
                <div className="aspect-[4/3]">
                  <GroupImg src={GROUP_IMG[g.id]} emoji={g.emoji} alt={g.name} pos={i} />
                </div>
                <div className="p-4">
                  <span className="block font-bold text-[15px] text-ink leading-tight group-hover:text-accent-deep transition-colors">{g.name}</span>
                  <span className="block text-[11.5px] text-ink-mute mt-1 leading-snug line-clamp-2">{g.desc}</span>
                </div>
                <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-cream/85 backdrop-blur-sm flex items-center justify-center text-accent-deep opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <ArrowRight size={16} />
                </span>
              </Link>
            </Reveal>
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
        <ProductGrid items={featured} />
      </section>

      {/* ---------- индивидуальное изготовление ---------- */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-14">
        <Reveal>
          <div className="rounded-3xl overflow-hidden bg-dark text-cream relative">
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 85% 15%, #D98E32 0, transparent 45%)" }} />
            <div className="grid md:grid-cols-2 relative">
              <div className="p-8 sm:p-12">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent mb-4">Custom-made</p>
                <h2 className="font-display font-bold text-[clamp(24px,3vw,34px)] leading-tight">Вещь, которую сделают только для вас</h2>
                <p className="text-cream/70 text-[14.5px] leading-relaxed mt-4 max-w-md">
                  Мебель и зеркала по индивидуальным параметрам: мастер согласует эскиз, а оплата пройдёт через безопасную сделку.
                  Такие изделия существуют в единственном экземпляре и возврату не подлежат.
                </p>
                <Link to="/market" className="inline-flex items-center gap-2 mt-7 h-12 px-6 rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors">
                  Разместить заказ <ArrowRight size={17} />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 p-6 sm:p-8">
                {customMade.map((p, i) => (
                  <Link key={p.id} to={`/product/${p.slug}`} className={`group rounded-2xl overflow-hidden shadow-lift ${i % 2 ? "translate-y-4" : ""}`}>
                    <div className="aspect-square flex items-center justify-center text-[46px]" style={{ background: `linear-gradient(135deg, ${p.art[0]}, ${p.art[1]})` }}>
                      {p.emoji}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- отзывы ---------- */}
      <section className="bg-cream border-t border-line-soft py-14">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <Reveal>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2">Слово покупателям</p>
            <h2 className="font-display font-bold text-[clamp(26px,3.4vw,38px)] text-ink mb-8">Почему нам доверяют</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            {REVIEWS.slice(0, 3).map((r, i) => (
              <Reveal key={r.name} delay={i * 80}>
                <figure className="bg-surface rounded-2xl shadow-card p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(r.rating)].map((_, j) => <Star key={j} size={15} className="text-accent fill-accent" />)}
                  </div>
                  <blockquote className="font-quote text-[19px] leading-[1.45] text-ink flex-1">«{r.text}»</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-dark text-accent flex items-center justify-center font-display font-bold text-[15px]">{r.name[0]}</span>
                    <span>
                      <span className="block text-[13.5px] font-bold text-ink">{r.name}</span>
                      <span className="block text-[12px] text-ink-mute">{r.city} · проверенная покупка</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- мастера ---------- */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-14">
        <Reveal>
          <div className="flex items-end justify-between mb-7 flex-wrap gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2">Лица платформы</p>
              <h2 className="font-display font-bold text-[clamp(26px,3.4vw,38px)] text-ink">Мастера со всей России</h2>
            </div>
            <Link to="/masters" className="text-sm font-bold text-accent-deep hover:text-accent flex items-center gap-1.5 transition-colors">
              Все мастерские <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {VENDORS.slice(0, 4).map((v, i) => (
            <Reveal key={v.id} delay={(i % 4) * 60}>
              <Link to={`/shop/${v.slug}`} className="group bg-surface rounded-2xl shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 p-5 block">
                <span className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[24px] text-cream mb-3.5" style={{ background: v.avatarColor }}>{v.emoji}</span>
                <span className="block font-bold text-[14.5px] text-ink group-hover:text-accent-deep transition-colors">{v.name}</span>
                <span className="block text-[12px] text-ink-mute mt-1">{v.city} · с {v.since} года</span>
                <span className="block mt-2"><Rating value={v.rating} size={11} /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
