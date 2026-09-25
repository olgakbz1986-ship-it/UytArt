import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, Paperclip, X, Plus, Search, Trash2, Download, MessageSquare } from "lucide-react";
import { ProductImg } from "./ui";
import { PRODUCTS } from "../data/seed";
import { Link } from "react-router-dom";
import { useNotifyStore, notifyActions } from "../lib/notify";
import { useMarketStore } from "../pages/extras";
import { useAgentStore } from "../lib/agent";
import { AGENT_TEMPLATES } from "../lib/agent-kb";
import { useAppStore } from "../lib/store";

notifyActions["agent_custom_send"] = (payload) => {
  const oid = String(payload.orderId);
  useMarketStore.setState((st: any) => ({ orders: st.orders.map((o: any) => (o.id === oid ? { ...o, status: "moderation", agentDraft: false } : o)) }));
  useNotifyStore.getState().push({ kind: "report", title: "Агент: заказ отправлен мастерам", text: "Черновик переведён в статус «на модерации»." });
};

export default function AgentPanel() {
  const sessions = useAgentStore((s) => s.sessions);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const newSession = useAgentStore((s) => s.newSession);
  const deleteSession = useAgentStore((s) => s.deleteSession);
  const switchSession = useAgentStore((s) => s.switchSession);
  const deleteMessage = useAgentStore((s) => s.deleteMessage);
  const exportAll = useAgentStore((s) => s.exportAll);
  const [searchQ, setSearchQ] = useState("");
  const [sidebarQ, setSidebarQ] = useState("");
  const current = sessions.find(s => s.id === currentSessionId);
  const dialog = current?.messages || [];
  const say = useAgentStore((s) => s.say);
  const userSaid = useAgentStore((s) => s.userSaid);
  const addTask = useAgentStore((s) => s.addTask);
  const updateTask = useAgentStore((s) => s.updateTask);
  const tasks = useAgentStore((s) => s.tasks);
  const session = useAppStore((s) => s.session);
  const [input, setInput] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setPhoto(String(r.result)); setPhotoName(f.name); };
    r.readAsDataURL(f);
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  /* приветствие один раз */
  useEffect(() => {
    if (sessions.length === 0) { newSession(); return; }
    if (!currentSessionId && sessions[0]) switchSession(sessions[0].id);
  }, [sessions.length]);
  useEffect(() => {
    if (current && current.messages.length === 0) say(AGENT_TEMPLATES.greet(session?.name || ""));
  }, [current?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [current?.messages.length]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const attached = photo;
    userSaid(text, attached || undefined);
    setInput("");
    if (attached) { setPhoto(null); setPhotoName(""); }
    setTimeout(() => {
      const low = text.toLowerCase();
      if (attached || /фото|хочу вот это|похож|найди|вот эт|подбери/i.test(text)) {
        if (!attached) { say("Прикрепите фото скрепкой рядом с полем ввода — и я начну визуальный поиск по всему сервису."); return; }
        say(AGENT_TEMPLATES.photoAck);
        const found = PRODUCTS.slice(0, 4);
        setTimeout(() => {
          say(`Нашёл ${found.length} похожих позиций. Если нужно точь-в-точь, могу оформить индивидуальный заказ.`);
        }, 8500);
        const id = addTask({ kind: "search", title: "Визуальный поиск", payload: { query: text, count: 4, products: found.map((p: any) => p.id), photo } });
        updateTask(id, { status: "working", steps: ["Принято к исполнению"] });
      } else if (/ремонт|интерьер|проект/i.test(text)) {
        say("Понял, это проект. Уточняю стиль, бюджет и объём — соберу концепт и корзину.");
      } else if (/возврат|доставка|оплат/i.test(text)) {
        say("Безопасная сделка: деньги замораживаются до получения. Возврат в течение 7 дней. Индивидуальные заказы возврату не подлежат.");
      } else {
        say("Понял задачу. Чем могу помочь дальше — искать, сравнить или собрать проект?");
      }
    }, 450);
  };

  const quick = [
    { label: "🖼️ Хочу вот это", text: "Хочу вот это" },
    { label: "🏠 Собери проект ремонта", text: "Собери проект ремонта" },
    { label: "📋 Правила возврата", text: "Как работает возврат?" },
  ];

  const working = tasks.filter((t) => t.status === "working").length;
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <section className="bg-surface rounded-2xl shadow-card border border-line-soft overflow-hidden">
      <header className="px-5 py-4 bg-dark text-cream flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center">
            <Bot size={19} className="text-ink" />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]">Агент Quantiform</p>
            <p className="text-[11.5px] text-cream/60">{working > 0 ? `В работе: ${working}` : `Выполнено задач: ${done}`}</p>
          </div>
        </div>
        <Sparkles size={16} className="text-accent" />
      </header>

      <div className="flex" style={{height: "380px"}}>
        {/* Сайдбар: список сессий */}
        <aside className="w-[220px] shrink-0 border-r border-line-soft bg-cream/30 flex flex-col">
          <div className="p-3 border-b border-line-soft flex gap-2">
            <button onClick={newSession} className="flex-1 h-9 rounded-[8px] bg-dark text-cream text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-dark-deep cursor-pointer"><Plus size={14} /> Новый чат</button>
          </div>
          <div className="px-3 pt-2 pb-1">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input value={sidebarQ} onChange={(e) => setSidebarQ(e.target.value)} placeholder="Поиск…" className="w-full h-8 pl-8 pr-2 rounded-[8px] bg-surface border border-line-soft text-[11.5px]" />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-2 py-1 space-y-1">
            {sessions.filter(s => !sidebarQ || s.title.toLowerCase().includes(sidebarQ.toLowerCase())).map(s => (
              <div key={s.id} className={`group flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] cursor-pointer text-[12px] ${s.id === currentSessionId ? "bg-accent-soft text-ink" : "text-ink-soft hover:bg-line-soft"}`} onClick={() => switchSession(s.id)}>
                <MessageSquare size={13} className="shrink-0" />
                <span className="flex-1 truncate">{s.title}</span>
                <button onClick={(e) => { e.stopPropagation(); if (confirm("Удалить чат «" + s.title + "»?")) deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 text-ink-mute hover:text-error cursor-pointer"><Trash2 size={12} /></button>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-[11px] text-ink-mute text-center py-4">Нет чатов</p>}
          </div>
          <div className="p-2 border-t border-line-soft">
            <button onClick={() => { const blob = new Blob([exportAll()], {type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "agent-export-" + new Date().toISOString().slice(0,10) + ".json"; a.click(); URL.revokeObjectURL(url); }} className="w-full h-8 rounded-[8px] bg-line-soft text-ink-soft text-[11.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-line cursor-pointer"><Download size={12} /> Экспорт всех диалогов</button>
          </div>
        </aside>

        {/* Контент: поиск + сообщения */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 border-b border-line-soft bg-surface flex items-center gap-2">
            <Search size={13} className="text-ink-mute" />
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Поиск в текущем чате…" className="flex-1 h-7 bg-transparent text-[12px] outline-none placeholder:text-ink-mute" />
            {searchQ && <button onClick={() => setSearchQ("")} className="text-ink-mute hover:text-error cursor-pointer"><X size={13} /></button>}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-4 space-y-3 bg-cream/40">
            {dialog.filter(m => !searchQ || m.text.toLowerCase().includes(searchQ.toLowerCase())).map((m) => {
              const hit = searchQ && m.text.toLowerCase().includes(searchQ.toLowerCase());
              return (
                <div key={m.id} className={`group flex ${m.from === "user" ? "justify-end" : "justify-start"} items-start gap-1.5`}>
                  {m.from === "agent" && <div className={`flex-1 max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug bg-surface text-ink border ${hit ? "border-accent" : "border-line-soft"} rounded-bl-sm`}>{m.photo && <img src={m.photo} alt="" className="block w-20 h-20 object-cover rounded-[10px] mb-1.5" />}{m.text}</div>}
                  {m.from === "user" && (
                    <>
                      <button onClick={() => deleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 mt-1 text-ink-mute hover:text-error cursor-pointer"><Trash2 size={12} /></button>
                      <div className={`flex-1 max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug bg-accent text-ink ${hit ? "ring-2 ring-accent-deep" : ""} rounded-br-sm`}>{m.photo && <img src={m.photo} alt="" className="block w-20 h-20 object-cover rounded-[10px] mb-1.5" />}{m.text}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tasks.some(t => t.kind === "search" && t.status === "done") && (
        <div className="px-5 py-4 bg-cream/30 border-t border-line-soft">
          <p className="text-[12.5px] font-bold text-ink mb-3">Найденные товары:</p>
          <div className="grid grid-cols-2 gap-3">
            {PRODUCTS.slice(0, 4).map((p: any) => (
              <Link key={p.id} to={`/product/${p.slug}`} className="block bg-surface rounded-xl p-2.5 border border-line-soft hover:border-accent transition-colors">
                <ProductImg p={p} className="w-full h-24 rounded-lg mb-2" />
                <p className="text-[11.5px] font-semibold text-ink leading-tight">{p.name}</p>
                <p className="text-[12px] font-bold text-accent mt-1">{p.price.toLocaleString("ru-RU")} ₽</p>
              </Link>
            ))}
          </div>
          <button onClick={() => {
            const found = PRODUCTS.slice(0, 4);
            const budget = found.reduce((a: number, p: any) => a + p.price, 0);
            useMarketStore.getState().addOrder({
              title: "Индивидуальный заказ по фото: " + (found[0]?.name || "похожее изделие"),
              type: (found[0] as any)?.category || "Декор",
              desc: "Черновик агента: состав из " + found.length + " позиций-референсов, фото покупателя прикреплено.",
              material: "по согласованию с мастером",
              budget,
              term: "по согласованию",
              region: "Москва",
              refName: found[0]?.name,
              agentPhoto: photo || undefined,
              agentItems: found.map((p: any) => p.id),
              agentDraft: true,
            });
            useMarketStore.setState((st: any) => ({ orders: st.orders.map((o: any, i: number) => (i === 0 ? { ...o, status: "draft" } : o)) }));
            const orderId = (useMarketStore.getState() as any).orders[0]?.id;
            const tid = addTask({ kind: "custom", title: "Индивидуальный заказ", payload: { orderId } });
            updateTask(tid, { status: "awaiting_confirm", steps: ["Черновик создан на бирже"] });
            say("Черновик создан на бирже — откройте вкладку «Индивидуальные заказы», проверьте состав и фото. Подтверждение отправки мастерам придёт в колокольчик.");
            useNotifyStore.getState().push({ kind: "confirm", title: "Агент: черновик индивидуального заказа", text: "Проверьте черновик во вкладке «Индивидуальные заказы» и подтвердите отправку мастерам.", actionLabel: "Отправить мастерам", actionType: "agent_custom_send", payload: { orderId } });
          }} className="w-full mt-3 h-10 rounded-[10px] bg-accent text-ink text-[13px] font-bold hover:bg-accent-deep cursor-pointer">
            Оформить индивидуальный заказ
          </button>
        </div>
      )}

      <div className="px-5 py-3 bg-surface border-t border-line-soft">
        <div className="flex gap-2 mb-3 flex-wrap">
          {quick.map((q) => (
            <button key={q.label} onClick={() => setInput(q.text)} className="h-8 px-3 rounded-[8px] bg-line-soft text-ink-soft text-[12px] font-semibold hover:bg-line cursor-pointer">{q.label}</button>
          ))}
        </div>
        {photo && (
          <div className="flex items-center gap-2 mb-2 bg-cream border border-line-soft rounded-[10px] p-2">
            <img src={photo} alt="" className="w-9 h-9 rounded-[8px] object-cover" />
            <span className="text-[11.5px] text-ink-soft flex-1 truncate">{photoName || "фото прикреплено"}</span>
            <button onClick={() => { setPhoto(null); setPhotoName(""); }} className="text-ink-mute hover:text-error cursor-pointer"><X size={14} /></button>
          </div>
        )}
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Напишите агенту…" className="flex-1 h-11 px-4 rounded-[10px] bg-cream border border-line-soft text-[13.5px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent" />
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
          <button onClick={() => fileRef.current?.click()} aria-label="Прикрепить фото" className="w-11 h-11 rounded-[10px] bg-line-soft text-ink-soft flex items-center justify-center hover:bg-line cursor-pointer"><Paperclip size={17} /></button>
          <button onClick={send} className="w-11 h-11 rounded-[10px] bg-dark text-cream flex items-center justify-center hover:bg-dark-deep cursor-pointer"><Send size={17} /></button>
        </div>
      </div>
    </section>
  );
}
