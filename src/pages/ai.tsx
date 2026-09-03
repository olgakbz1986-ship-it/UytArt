import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Send, Camera, ScanLine, ShoppingBag, Palette, Upload, X } from "lucide-react";
import { Product, PRODUCTS, aiPickProducts, fmt, fmtDate } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useSubStore, buyerLimits, selectAiLeft, fmtLimit } from "../lib/subscriptions";
import { Badge, Btn, ProductImg } from "../components/ui";

type Mode = "chat" | "room" | "photo";

const HOTSPOTS: { top: string; left: string; cat: string }[] = [
  { top: "20%", left: "16%", cat: "Керамика" },
  { top: "52%", left: "72%", cat: "Текстиль" },
  { top: "68%", left: "28%", cat: "Свечи" },
  { top: "32%", left: "52%", cat: "Освещение" },
];

export default function AiPage() {
  const addToCart = useAppStore((s) => s.addToCart);
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const consumeAiGen = useSubStore((s) => s.consumeAiGen);
  const aiGensLeft = useSubStore(selectAiLeft);
  const addConcept = useSubStore((s) => s.addConcept);
  const lim = buyerLimits(buyerPlan);

  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [roomImg, setRoomImg] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [spotsReady, setSpotsReady] = useState(false);
  const [spotOpen, setSpotOpen] = useState<number | null>(null);
  const [spotProducts, setSpotProducts] = useState<Product[]>([]);
  const [photoImg, setPhotoImg] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  const tryConsume = () => {
    const ok = consumeAiGen();
    setLimitHit(!ok);
    return ok;
  };

  /* ---------- чат ---------- */
  const send = () => {
    const q = input.trim();
    if (!q || thinking) return;
    if (!tryConsume()) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const r = aiPickProducts(q);
      setResults(r);
      setMessages((m) => [...m, { role: "ai", text: `Подобрал ${r.length} предметов по запросу «${q}». Смотрите справа — каждый можно добавить в корзину.` }]);
      setThinking(false);
    }, 1100);
  };

  /* ---------- фото комнаты ---------- */
  const onRoomFile = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setRoomImg(f.name);
    setRoomUrl(url);
    setSpotsReady(false);
    setSpotOpen(null);
  };
  const analyzeRoom = () => {
    if (scanning || spotsReady || !roomUrl) return;
    if (!tryConsume()) return;
    setScanning(true);
    setTimeout(() => { setScanning(false); setSpotsReady(true); }, 1600);
  };
  const openSpot = (i: number) => {
    if (spotOpen === i) { setSpotOpen(null); return; }
    setSpotOpen(i);
    setSpotProducts(aiPickProducts(HOTSPOTS[i].cat, 4));
  };
  const saveConcept = () => {
    if (!roomImg) return;
    addConcept({ style: "Мой интерьер", roomName: roomImg, image: roomUrl || undefined });
  };

  /* ---------- поиск по фото ---------- */
  const onPhotoFile = (f: File | undefined) => {
    if (!f) return;
    setPhotoImg(URL.createObjectURL(f));
    setSearching(true);
    setResults([]);
    setTimeout(() => {
      const shuffled = [...PRODUCTS].sort(() => 0.5 - Math.random()).slice(0, 6);
      setResults(shuffled);
      setSearching(false);
    }, 1500);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2 flex items-center gap-2"><Sparkles size={14} /> YandexGPT · Yandex Vision</p>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink">AI-дизайнер интерьера</h1>
        </div>
        <Badge tone="ai">Осталось генераций: {fmtLimit(aiGensLeft)}{Number.isFinite(lim.aiGens) ? ` из ${lim.aiGens}` : ""}</Badge>
      </div>

      {limitHit && (
        <div className="flex items-center gap-2.5 bg-premium-soft border border-premium/40 rounded-[10px] px-4 py-3 mb-6 fade-up">
          <Sparkles size={16} className="text-[#a07c50] shrink-0" />
          <p className="text-[13px] text-ink flex-1">Лимит AI-генераций на этот месяц исчерпан. <Link to="/plans" className="font-bold text-accent-deep underline">Улучшить тариф</Link></p>
        </div>
      )}

      <div className="inline-flex bg-line-soft rounded-[12px] p-1.5 mb-7">
        {([["chat", "Диалог"], ["room", "Фото комнаты"], ["photo", "Поиск по фото"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`h-11 px-6 rounded-[10px] text-sm font-bold transition-all duration-200 cursor-pointer ${mode === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ДИАЛОГ */}
      {mode === "chat" && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="bg-surface rounded-2xl shadow-card flex flex-col" style={{ height: "min(620px, calc(100vh - 260px))" }}>
            <div ref={listRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <span className="w-16 h-16 rounded-2xl bg-ai-soft text-ai flex items-center justify-center mb-5"><Sparkles size={30} /></span>
                  <p className="font-display font-bold text-[19px] text-ink mb-2">Опишите интерьер мечты</p>
                  <p className="text-[13.5px] text-ink-soft max-w-sm mb-6">Например: «уютная гостиная в скандинавском стиле, бюджет 15 000 ₽» — и я соберу подборку реальных товаров.</p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {["Гостиная в сканди", "Спальня джапанди", "Кабинет в лофте", "Кухня прованс"].map((t) => (
                      <button key={t} onClick={() => setInput(t)} className="px-3.5 py-2 rounded-full border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ai hover:text-ai hover:bg-ai-soft transition-all duration-200 cursor-pointer">{t}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} fade-up`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${m.role === "user" ? "bg-dark text-cream rounded-br-[6px]" : "bg-ai-soft text-ink rounded-bl-[6px]"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-2 bg-ai-soft rounded-2xl rounded-bl-[6px] px-4 py-3 w-fit">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-ai" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-ai" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-ai" />
                  <span className="text-[12px] text-ink-mute ml-1">подбираю из {PRODUCTS.length.toLocaleString("ru-RU")} товаров…</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-line-soft">
              <div className="flex items-center gap-2">
                <input
                  className="field flex-1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Опишите комнату, стиль, бюджет…"
                  aria-label="Запрос к AI-дизайнеру"
                />
                <button onClick={send} aria-label="Отправить" disabled={!input.trim() || thinking}
                  className="w-[46px] h-[46px] shrink-0 rounded-[10px] bg-accent text-ink flex items-center justify-center hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer disabled:opacity-40">
                  <Send size={17} />
                </button>
              </div>
            </div>
          </div>

          <aside className="bg-surface rounded-2xl shadow-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-mute mb-3">Рекомендации · {results.length}</p>
            {results.length === 0 ? (
              <p className="text-[13px] text-ink-soft py-8 text-center">Здесь появятся подобранные товары с ценами.</p>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {results.map((p, i) => (
                  <div key={p.id} className="flex gap-3 p-2 rounded-xl border border-line-soft hover:border-ai/50 transition-colors fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="w-[64px] h-[56px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-ink line-clamp-2 leading-snug">{p.name}</p>
                      <p className="font-display font-bold text-[13px] text-ink mt-1">{fmt(p.price)}</p>
                    </div>
                    <button onClick={() => addToCart(p.id)} aria-label="В корзину" className="w-9 h-9 self-center rounded-full bg-dark text-cream flex items-center justify-center hover:bg-accent hover:text-ink transition-colors cursor-pointer shrink-0">
                      <ShoppingBag size={14} />
                    </button>
                  </div>
                ))}
                <Btn className="w-full mt-2" size="sm" onClick={() => results.forEach((p) => addToCart(p.id))}>Добавить весь набор</Btn>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ФОТО КОМНАТЫ */}
      {mode === "room" && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            {!roomUrl ? (
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line rounded-2xl px-6 py-20 text-center cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
                <ScanLine size={34} className="text-ai" />
                <span className="font-bold text-[15px] text-ink">Загрузите фото своей комнаты</span>
                <span className="text-[13px] text-ink-soft max-w-sm">AI сохранит геометрию и освещение, а затем расставит «горячие точки» с реальными товарами, которые сюда подойдут.</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onRoomFile(e.target.files?.[0])} />
              </label>
            ) : (
              <div>
                <div className="relative rounded-2xl overflow-hidden bg-dark">
                  <img src={roomUrl} alt="Ваша комната" className="w-full max-h-[520px] object-cover" />
                  {scanning && (
                    <div className="absolute inset-0 bg-dark/50 flex flex-col items-center justify-center gap-3 text-cream">
                      <ScanLine size={34} className="animate-pulse" />
                      <p className="font-bold text-[14px]">Анализируем пространство…</p>
                    </div>
                  )}
                  {spotsReady && HOTSPOTS.map((h, i) => (
                    <button key={i} onClick={() => openSpot(i)} aria-label={`Подбор: ${h.cat}`}
                      className={`absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-[12px] font-extrabold cursor-pointer transition-all ${spotOpen === i ? "bg-accent text-ink scale-110" : "bg-accent/90 text-ink hover:bg-accent"}`}
                      style={{ top: h.top, left: h.left }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 mt-4 flex-wrap">
                  {!spotsReady && <Btn onClick={analyzeRoom} disabled={scanning}><ScanLine size={16} /> {scanning ? "Анализируем…" : "Расставить горячие точки"}</Btn>}
                  {spotsReady && <Btn variant="outline" onClick={saveConcept}><Palette size={16} /> Сохранить концепт</Btn>}
                  <label className="inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] h-[46px] px-5 text-sm border border-line bg-surface hover:bg-cream transition-colors cursor-pointer">
                    <Upload size={16} /> Другое фото
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onRoomFile(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <aside className="bg-surface rounded-2xl shadow-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-mute mb-3">
              {spotOpen === null ? "Горячие точки" : HOTSPOTS[spotOpen].cat}
            </p>
            {!spotsReady ? (
              <p className="text-[13px] text-ink-soft py-8 text-center">Загрузите фото и запустите анализ — здесь появятся точки с товарами.</p>
            ) : spotOpen === null ? (
              <div className="space-y-2">
                {HOTSPOTS.map((h, i) => (
                  <button key={i} onClick={() => openSpot(i)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-line-soft hover:border-ai/50 transition-colors cursor-pointer text-left">
                    <span className="w-7 h-7 rounded-full bg-accent text-ink text-[11px] font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span>
                      <span className="block text-[13px] font-bold text-ink">{h.cat}</span>
                      <span className="block text-[11.5px] text-ink-mute">нажмите, чтобы увидеть товары</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {spotProducts.map((p) => (
                  <div key={p.id} className="flex gap-3 p-2 rounded-xl border border-line-soft">
                    <span className="w-[64px] h-[56px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-ink line-clamp-2 leading-snug">{p.name}</p>
                      <p className="font-display font-bold text-[13px] text-ink mt-1">{fmt(p.price)}</p>
                    </div>
                    <button onClick={() => addToCart(p.id)} aria-label="В корзину" className="w-9 h-9 self-center rounded-full bg-dark text-cream flex items-center justify-center hover:bg-accent hover:text-ink transition-colors cursor-pointer shrink-0">
                      <ShoppingBag size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ПОИСК ПО ФОТО */}
      {mode === "photo" && (
        <div>
          <div className="bg-surface rounded-2xl shadow-card p-6 mb-6">
            {!photoImg ? (
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line rounded-2xl px-6 py-16 text-center cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
                <Camera size={34} className="text-ai" />
                <span className="font-bold text-[15px] text-ink">Загрузите фото понравившегося предмета</span>
                <span className="text-[13px] text-ink-soft max-w-sm">Скриншот из интернета или фото из магазина — AI найдёт максимально похожие товары у наших мастеров.</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoFile(e.target.files?.[0])} />
              </label>
            ) : (
              <div className="flex items-start gap-5 flex-wrap">
                <img src={photoImg} alt="Искомый предмет" className="w-[140px] h-[140px] object-cover rounded-2xl" />
                <div className="flex-1 min-w-[220px]">
                  <p className="font-bold text-[15px] text-ink mb-1">{searching ? "Ищем похожие товары…" : "Похожие товары найдены"}</p>
                  <p className="text-[13px] text-ink-soft mb-4">{searching ? "Сравниваем форму, материал и стиль по Yandex Vision." : "Слева — что вы искали, ниже — что предлагают мастера."}</p>
                  <label className="inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] h-11 px-5 text-sm border border-line bg-surface hover:bg-cream transition-colors cursor-pointer">
                    <Upload size={16} /> Другое фото
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoFile(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
            )}
          </div>
          {searching && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-[4/5] skeleton" />)}
            </div>
          )}
          {!searching && results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {results.map((p, i) => (
                <div key={p.id} className="bg-surface rounded-2xl shadow-card overflow-hidden fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="relative aspect-[4/4.6] group">
                    <ProductImg p={p} variant={i % 5} />
                    <Badge tone="success" className="absolute top-2 left-2">{96 - i * 4}% сходство</Badge>
                  </div>
                  <div className="p-3">
                    <p className="text-[12px] font-semibold text-ink line-clamp-2 leading-snug">{p.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-display font-bold text-[13px] text-ink">{fmt(p.price)}</span>
                      <button onClick={() => addToCart(p.id)} aria-label="В корзину" className="w-8 h-8 rounded-full bg-dark text-cream flex items-center justify-center hover:bg-accent hover:text-ink transition-colors cursor-pointer">
                        <ShoppingBag size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 text-[12px] text-ink-mute mt-8">
        <Sparkles size={13} className="text-ai" />
        AI-подбор — экспериментальный сервис и не является профессиональной рекомендацией. {fmtDate(new Date().toISOString())}
      </p>
    </div>
  );
}
