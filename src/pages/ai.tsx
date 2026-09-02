import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Send, Camera, ScanLine, ShoppingBag, Palette, Crown, Bookmark, RefreshCw } from "lucide-react";
import { PRODUCTS, fmt, aiPickProducts, catBySlug, Product } from "../data/seed";
import { useAppStore } from "../lib/store";
import { useSubStore, selectAiLeft, fmtLimit, buyerLimits } from "../lib/subscriptions";
import { Badge, Btn, GroupImg, ProductImg } from "../components/ui";

type Mode = "chat" | "room" | "photo";

const HOTSPOTS: { top: string; left: string; q: string; label: string }[] = [
  { top: "22%", left: "18%", q: "керамика ваза", label: "Декор" },
  { top: "55%", left: "74%", q: "текстиль плед", label: "Текстиль" },
  { top: "70%", left: "30%", q: "свечи", label: "Свечи" },
  { top: "34%", left: "54%", q: "светильник", label: "Свет" },
];

const STYLES = ["Сканди", "Лофт", "Джапанди", "Неоклассика"];

export default function AiPage() {
  const addToCart = useAppStore((s) => s.addToCart);
  const buyerPlan = useSubStore((s) => s.buyerPlan);
  const aiLeft = useSubStore(selectAiLeft);
  const consumeAiGen = useSubStore((s) => s.consumeAiGen);
  const addConcept = useSubStore((s) => s.addConcept);
  const lim = buyerLimits(buyerPlan);

  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [results, setResults] = useState<Product[]>([]);

  const [roomImg, setRoomImg] = useState<string | null>(null);
  const [roomStyle, setRoomStyle] = useState(STYLES[0]);
  const [scanning, setScanning] = useState(false);
  const [spotsReady, setSpotsReady] = useState(false);
  const [spotOpen, setSpotOpen] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const [photoImg, setPhotoImg] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  const blocked = aiLeft <= 0;
  const UpgradeNote = () => (
    <p className="flex items-start gap-2 text-[12.5px] text-ink bg-accent-soft border border-accent/40 rounded-[10px] px-3.5 py-2.5">
      <Crown size={14} className="text-accent-deep shrink-0 mt-0.5" />
      <span>Лимит AI-генераций на тарифе «{buyerPlan === "free" ? "Базовый" : buyerPlan}» исчерпан. <Link to="/plans" className="font-bold text-accent-deep underline">Улучшить тариф</Link> — до безлимита.</span>
    </p>
  );

  /* ---------- чат ---------- */
  const send = () => {
    const q = input.trim();
    if (!q || thinking) return;
    if (!consumeAiGen()) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const r = aiPickProducts(q);
      setResults(r);
      setMessages((m) => [...m, { role: "ai", text: `Подобрал ${r.length} предметов по запросу «${q}» — с учётом региональной логики. Каждый можно добавить в корзину.` }]);
      setThinking(false);
    }, 1100);
  };

  /* ---------- фото комнаты ---------- */
  const onRoomFile = (f: File | undefined) => {
    if (!f) return;
    setRoomImg(URL.createObjectURL(f));
    setSpotsReady(false);
    setSpotOpen(null);
    setSaved(false);
  };
  const analyzeRoom = () => {
    if (scanning || spotsReady || !roomImg) return;
    if (!consumeAiGen()) return;
    setScanning(true);
    setTimeout(() => { setScanning(false); setSpotsReady(true); }, 1500);
  };
  const regenerate = () => {
    if (!consumeAiGen()) return;
    setSpotsReady(false);
    setScanning(true);
    setTimeout(() => { setScanning(false); setSpotsReady(true); setSaved(false); }, 1200);
  };

  /* ---------- поиск по фото ---------- */
  const onPhotoFile = (f: File | undefined) => {
    if (!f) return;
    if (!consumeAiGen()) return;
    setPhotoImg(URL.createObjectURL(f));
    setSearching(true);
    setResults([]);
    setTimeout(() => {
      setResults([...PRODUCTS].sort(() => 0.5 - Math.random()).slice(0, 6));
      setSearching(false);
    }, 1400);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-deep mb-2 flex items-center gap-2"><Sparkles size={14} /> YandexGPT · Yandex Vision</p>
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink">AI-дизайнер интерьера</h1>
        </div>
        <Badge tone={blocked ? "error" : "ai"}>
          <Sparkles size={11} /> Генераций в этом месяце: {fmtLimit(aiLeft)} из {fmtLimit(lim.aiGens)}
        </Badge>
      </div>

      {/* переключатель режимов */}
      <div className="inline-flex bg-line-soft rounded-[12px] p-1.5 mb-7">
        {([["chat", "Диалог", Palette], ["room", "Фото комнаты", ScanLine], ["photo", "Поиск по фото", Camera]] as const).map(([id, label, Ic]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`flex items-center gap-2 h-11 px-4 sm:px-5 rounded-[10px] text-[13px] font-bold transition-all duration-200 cursor-pointer ${mode === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
            <Ic size={15} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {blocked && <div className="mb-6"><UpgradeNote /></div>}

      {/* ================= диалог ================= */}
      {mode === "chat" && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="bg-surface rounded-2xl shadow-card flex flex-col" style={{ height: "min(620px, calc(100vh - 230px))" }}>
            <div ref={listRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <span className="w-16 h-16 rounded-2xl bg-ai-soft text-ai flex items-center justify-center mb-5 float-y"><Sparkles size={30} /></span>
                  <p className="font-display font-bold text-[19px] text-ink mb-2">Опишите интерьер мечты</p>
                  <p className="text-[13.5px] text-ink-soft max-w-sm mb-6">Например: «уютная гостиная в сканди, бюджет 15 000 ₽» — и я соберу подборку реальных товаров.</p>
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
                  disabled={blocked}
                />
                <button onClick={send} aria-label="Отправить" disabled={!input.trim() || thinking || blocked}
                  className="w-[46px] h-[46px] shrink-0 rounded-[10px] bg-accent text-ink flex items-center justify-center hover:bg-accent-deep transition-colors cursor-pointer disabled:opacity-40">
                  <Send size={17} />
                </button>
              </div>
            </div>
          </div>

          <aside className="bg-surface rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-mute">Рекомендации · {results.length}</p>
              {results.length > 0 && (
                <Btn size="sm" variant="outline" onClick={() => results.forEach((p) => addToCart(p.id))}>Всё в корзину</Btn>
              )}
            </div>
            {results.length === 0 ? (
              <p className="text-[13px] text-ink-soft py-8 text-center">Здесь появятся подобранные товары с ценами.</p>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {results.map((p, i) => (
                  <div key={p.id} className="flex gap-3 p-2 rounded-xl border border-line-soft hover:border-ai/50 transition-colors fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <Link to={`/product/${p.slug}`} className="w-[64px] h-[56px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>
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

      {/* ================= фото комнаты ================= */}
      {mode === "room" && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="bg-surface rounded-2xl shadow-card p-6">
            {!roomImg ? (
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line rounded-2xl px-6 py-20 text-center cursor-pointer hover:border-ai hover:bg-ai-soft/40 transition-colors">
                <ScanLine size={34} className="text-ai" />
                <span className="font-bold text-[15px] text-ink">Загрузите фото своей комнаты</span>
                <span className="text-[13px] text-ink-soft max-w-sm">AI сохранит геометрию и освещение, а затем расставит «горячие точки» с реальными товарами, которые сюда подойдут.</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onRoomFile(e.target.files?.[0])} />
              </label>
            ) : (
              <div>
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={roomImg} alt="Ваша комната" className="w-full max-h-[520px] object-cover" />
                  {scanning && (
                    <div className="absolute inset-0 bg-dark/40 flex flex-col items-center justify-center gap-3 text-cream">
                      <ScanLine size={34} className="animate-pulse" />
                      <p className="font-bold text-[14px]">Генерируем дизайн «{roomStyle}», сохраняя геометрию…</p>
                    </div>
                  )}
                  {spotsReady && HOTSPOTS.map((h, i) => (
                    <button key={i} onClick={() => setSpotOpen(spotOpen === i ? null : i)} aria-label={`Подбор: ${h.label}`}
                      className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                      style={{ top: h.top, left: h.left }}>
                      <span className={`absolute inset-0 rounded-full pulse-ring ${spotOpen === i ? "bg-accent-deep" : "bg-accent"} transition-colors`} />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-ink">{i + 1}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2.5 mt-4 flex-wrap items-center">
                  {!spotsReady ? (
                    <Btn onClick={analyzeRoom} disabled={scanning || blocked}><ScanLine size={16} /> {scanning ? "Генерируем…" : "Сгенерировать дизайн"}</Btn>
                  ) : (
                    <>
                      <Btn variant="outline" onClick={regenerate} disabled={blocked}><RefreshCw size={15} /> Перегенерировать</Btn>
                      <Btn variant="outline" onClick={() => { setSaved(false); setRoomStyle(STYLES[(STYLES.indexOf(roomStyle) + 1) % STYLES.length]); }}><Palette size={15} /> Другой стиль: {STYLES[(STYLES.indexOf(roomStyle) + 1) % STYLES.length]}</Btn>
                      <Btn onClick={() => { addConcept({ style: roomStyle, roomName: "Моя комната", image: roomImg }); setSaved(true); }} disabled={saved}>
                        <Bookmark size={15} /> {saved ? "Сохранено ✓" : "В «Мои концепты»"}
                      </Btn>
                    </>
                  )}
                  <label className="inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] h-[46px] px-5 text-sm border border-line bg-surface hover:bg-cream transition-colors cursor-pointer ml-auto">
                    <Camera size={16} /> Другое фото
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onRoomFile(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <aside className="bg-surface rounded-2xl shadow-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-mute mb-3">
              {spotOpen === null ? `Стиль: ${roomStyle}` : HOTSPOTS[spotOpen].label}
            </p>
            {!spotsReady ? (
              <p className="text-[13px] text-ink-soft py-8 text-center">Загрузите фото и запустите генерацию — здесь появятся точки с товарами.</p>
            ) : spotOpen === null ? (
              <div className="space-y-2">
                {HOTSPOTS.map((h, i) => (
                  <button key={i} onClick={() => setSpotOpen(i)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-line-soft hover:border-ai/50 transition-colors cursor-pointer text-left">
                    <span className="w-7 h-7 rounded-full bg-accent text-ink text-[11px] font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span>
                      <span className="block text-[13px] font-bold text-ink">{h.label}</span>
                      <span className="block text-[11.5px] text-ink-mute">нажмите, чтобы увидеть товары</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {aiPickProducts(HOTSPOTS[spotOpen].q, 3).map((p) => (
                  <div key={p.id} className="flex gap-3 p-2 rounded-xl border border-line-soft">
                    <Link to={`/product/${p.slug}`} className="w-[64px] h-[56px] rounded-[10px] overflow-hidden shrink-0 group"><ProductImg p={p} /></Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-ink line-clamp-2 leading-snug">{p.name}</p>
                      <p className="font-display font-bold text-[13px] text-ink mt-1">{fmt(p.price)}</p>
                    </div>
                    <button onClick={() => addToCart(p.id)} aria-label="В корзину" className="w-9 h-9 self-center rounded-full bg-dark text-cream flex items-center justify-center hover:bg-accent hover:text-ink transition-colors cursor-pointer shrink-0">
                      <ShoppingBag size={14} />
                    </button>
                  </div>
                ))}
                <Btn size="sm" className="w-full" onClick={() => aiPickProducts(HOTSPOTS[spotOpen].q, 3).forEach((p) => addToCart(p.id))}>
                  Купить весь образ целиком
                </Btn>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ================= поиск по фото ================= */}
      {mode === "photo" && (
        <div>
          <div className="bg-surface rounded-2xl shadow-card p-6 mb-6">
            {!photoImg ? (
              <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line rounded-2xl px-6 py-16 text-center transition-colors ${blocked ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-ai hover:bg-ai-soft/40"}`}>
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
                    <Camera size={16} /> Другое фото
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
                  <div className="relative aspect-square group">
                    <GroupImg src={p.image} emoji={p.emoji} alt={p.name} pos={i} />
                    <Badge tone="success" className="absolute top-2 left-2">{96 - i * 4}% сходство</Badge>
                  </div>
                  <div className="p-3">
                    <p className="text-[12px] font-semibold text-ink line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-[11px] text-ink-mute mt-0.5">{catBySlug(p.categoryId)?.name}</p>
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
        AI-подбор — экспериментальный сервис. Распознавание фото доступно при согласии на AI-профилирование.
      </p>
    </div>
  );
}
