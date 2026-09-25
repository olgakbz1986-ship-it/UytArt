import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { useAgentStore } from "../lib/agent";
import { useNotifyStore, notifyActions } from "../lib/notify";
import { useSellerAccount } from "../lib/seller";
import { PRODUCTS } from "../data/seed";

/* РЕАЛЬНОЕ действие: применение цены к товару продавца через стор */
notifyActions["agent_price_apply"] = (payload) => {
  const id = String(payload.productId);
  const np = Number(payload.newPrice);
  useSellerAccount.setState((st: any) => ({
    products: (st.products || []).map((p: any) => (p.id === id ? { ...p, price: np } : p)),
  }));
  useNotifyStore.getState().push({ kind: "report", title: "Агент: цена применена", text: `Товар обновлён: новая цена ${np.toLocaleString("ru-RU")} ₽` });
};

export default function AgentPanelSeller() {
  const dialog = useAgentStore((s) => s.dialogSeller);
  const say = useAgentStore((s) => s.saySeller);
  const userSaid = useAgentStore((s) => s.userSaidSeller);
  const addTask = useAgentStore((s) => s.addTask);
  const updateTask = useAgentStore((s) => s.updateTask);
  const tasks = useAgentStore((s) => s.tasks);
  const myProducts = (useSellerAccount((st: any) => st.products) || []) as any[];
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dialog.length === 0) say("Здравствуйте! Я ваш агент-партнёр по продажам. Умею анализировать нишу по живым данным сервиса, рекомендовать цены и следить за спросом. С чего начнём?");
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [dialog]);

  const stats = () => {
    const mine = myProducts[0];
    if (!mine) { say("У вас пока нет активных товаров. Создайте первую карточку — и я начну вести аналитику ниши."); return null; }
    const cat = mine.category || "Прочее";
    const market = PRODUCTS.filter((p: any) => p.category === cat);
    const avg = market.length ? Math.round(market.reduce((a: number, p: any) => a + p.price, 0) / market.length) : mine.price;
    const delta = Math.round(((mine.price - avg) / avg) * 100);
    return { mine, cat, market, avg, delta };
  };

  const analyze = () => {
    const st = stats();
    if (!st) return;
    const verdict = st.delta > 10 ? `Рекомендую снизить до ${Math.round(st.avg * 1.05).toLocaleString("ru-RU")} ₽ — вернёте позицию в выдаче.` : st.delta < -10 ? `Можно поднять до ${Math.round(st.avg * 0.95).toLocaleString("ru-RU")} ₽ без потери спроса.` : "Цена в рыночном коридоре — держим.";
    say(`Ниша «${st.cat}»: ${st.market.length} предложений на сервисе. Средняя цена ${st.avg.toLocaleString("ru-RU")} ₽, ваша ${st.mine.price.toLocaleString("ru-RU")} ₽ (${st.delta > 0 ? "+" : ""}${st.delta}%). ${verdict}`);
    useNotifyStore.getState().push({ kind: "report", title: "Агент: аналитика ниши готова", text: `«${st.cat}» · средняя ${st.avg.toLocaleString("ru-RU")} ₽ · ваша позиция ${st.delta > 0 ? "+" : ""}${st.delta}%` });
  };

  const suggestPrice = () => {
    const st = stats();
    if (!st) return;
    const target = st.delta > 10 ? Math.round(st.avg * 1.05) : st.delta < -10 ? Math.round(st.avg * 0.95) : st.mine.price;
    if (target === st.mine.price) { say("Цена в рыночном коридоре — изменений не требуется."); return; }
    say(`Готов черновик: «${st.mine.name}» ${st.mine.price.toLocaleString("ru-RU")} ₽ → ${target.toLocaleString("ru-RU")} ₽. Подтвердите в уведомлениях — применю сам.`);
    useNotifyStore.getState().push({ kind: "confirm", title: "Агент: изменение цены", text: `«${st.mine.name}»: ${st.mine.price.toLocaleString("ru-RU")} ₽ → ${target.toLocaleString("ru-RU")} ₽`, actionLabel: "Применить цену", actionType: "agent_price_apply", payload: { productId: st.mine.id, newPrice: target } });
  };

  const monitor = () => {
    const st = stats();
    if (!st) return;
    const trend = st.market.length > 20 ? "up" : st.market.length > 8 ? "flat" : "down";
    const text = trend === "up" ? `Спрос в нише «${st.cat}» растёт (${st.market.length} активных предложений) — пора расширять ассортимент.` : trend === "down" ? `Ниша «${st.cat}» узкая (${st.market.length} предложений) — рассмотрите скидку или новые теги.` : `Спрос в нише «${st.cat}» стабилен (${st.market.length} предложений). Держим ритм.`;
    const id = addTask({ kind: "analytics", title: "Мониторинг спроса: " + st.cat, payload: { text } });
    updateTask(id, { status: "working", steps: ["Мониторинг запущен"] });
    say("Запустил мониторинг спроса по вашей нише — отчёт придёт в уведомления.");
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    userSaid(text);
    setInput("");
    setTimeout(() => {
      if (/цен|прайс/i.test(text)) suggestPrice();
      else if (/ниш|аналит|спрос/i.test(text)) analyze();
      else say("Могу разобрать нишу по живым данным, рекомендовать цену или запустить мониторинг спроса. Выберите кнопку ниже или уточните задачу.");
    }, 450);
  };

  const quick = [
    { label: "📊 Аналитика ниши", fn: analyze },
    { label: "💰 Рекомендация цены", fn: suggestPrice },
    { label: "📈 Мониторинг спроса", fn: monitor },
  ];

  return (
    <section className="bg-surface rounded-2xl shadow-card border border-line-soft overflow-hidden">
      <header className="px-5 py-4 bg-dark text-cream flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center"><Bot size={19} className="text-ink" /></span>
          <div>
            <p className="font-display font-bold text-[15px]">Агент-партнёр мастера</p>
            <p className="text-[11.5px] text-cream/60">Товаров под управлением: {myProducts.length}</p>
          </div>
        </div>
      </header>
      <div ref={scrollRef} className="h-[320px] overflow-auto px-5 py-4 space-y-3 bg-cream/40">
        {dialog.map((m) => (
          <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${m.from === "user" ? "bg-accent text-ink rounded-br-sm" : "bg-surface text-ink border border-line-soft rounded-bl-sm"}`}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-surface border-t border-line-soft">
        <div className="flex gap-2 mb-3 flex-wrap">
          {quick.map((q) => (
            <button key={q.label} onClick={q.fn} className="h-8 px-3 rounded-[8px] bg-line-soft text-ink-soft text-[12px] font-semibold hover:bg-line cursor-pointer">{q.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Спросите агента о нише, цене, спросе…" className="flex-1 h-11 px-4 rounded-[10px] bg-cream border border-line-soft text-[13.5px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent" />
          <button onClick={send} className="w-11 h-11 rounded-[10px] bg-dark text-cream flex items-center justify-center hover:bg-dark-deep cursor-pointer"><Send size={17} /></button>
        </div>
      </div>
    </section>
  );
}
