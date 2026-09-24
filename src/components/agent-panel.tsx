import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { useAgentStore } from "../lib/agent";
import { AGENT_TEMPLATES } from "../lib/agent-kb";
import { useAppStore } from "../lib/store";

export default function AgentPanel() {
  const dialog = useAgentStore((s) => s.dialog);
  const say = useAgentStore((s) => s.say);
  const userSaid = useAgentStore((s) => s.userSaid);
  const addTask = useAgentStore((s) => s.addTask);
  const updateTask = useAgentStore((s) => s.updateTask);
  const tasks = useAgentStore((s) => s.tasks);
  const session = useAppStore((s) => s.session);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  /* приветствие один раз */
  useEffect(() => {
    if (dialog.length === 0) say(AGENT_TEMPLATES.greet(session?.name || ""));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [dialog]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    userSaid(text);
    setInput("");
    setTimeout(() => {
      const low = text.toLowerCase();
      if (/фото|хочу вот это|похож/i.test(text)) {
        say(AGENT_TEMPLATES.photoAck);
        const id = addTask({ kind: "search", title: "Визуальный поиск", payload: { query: text, count: 4 } });
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
    { label: "🖼️ Хочу вот это (фото)", text: "Хочу вот это" },
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

      <div ref={scrollRef} className="h-[340px] overflow-auto px-5 py-4 space-y-3 bg-cream/40">
        {dialog.map((m) => (
          <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${
              m.from === "user" ? "bg-accent text-ink rounded-br-sm" : "bg-surface text-ink border border-line-soft rounded-bl-sm"
            }`}>{m.text}</div>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 bg-surface border-t border-line-soft">
        <div className="flex gap-2 mb-3 flex-wrap">
          {quick.map((q) => (
            <button key={q.label} onClick={() => { setInput(q.text); }} className="h-8 px-3 rounded-[8px] bg-line-soft text-ink-soft text-[12px] font-semibold hover:bg-line cursor-pointer">{q.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Напишите агенту…" className="flex-1 h-11 px-4 rounded-[10px] bg-cream border border-line-soft text-[13.5px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent" />
          <button onClick={send} className="w-11 h-11 rounded-[10px] bg-dark text-cream flex items-center justify-center hover:bg-dark-deep cursor-pointer"><Send size={17} /></button>
        </div>
      </div>
    </section>
  );
}
