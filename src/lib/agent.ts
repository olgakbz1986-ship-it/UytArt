import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AGENT_TEMPLATES } from "./agent-kb";
import { useNotifyStore } from "./notify";

export type AgentRole = "buyer" | "self" | "ip" | "ooo";

export interface AgentTask {
  id: string;
  kind: "search" | "monitor" | "project" | "custom" | "analytics";
  title: string;
  status: "queued" | "working" | "awaiting_confirm" | "done" | "cancelled";
  startedAt: number;
  finishedAt?: number;
  steps: string[];
  result?: string;
  payload: Record<string, unknown>;
}

export interface AgentMsg {
  id: string;
  from: "user" | "agent";
  text: string;
  photo?: string;
  at: number;
}
export interface AgentSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AgentMsg[];
}

interface AgentProfile {
  style: string[];
  palette: string[];
  budget: number;
  anti: string[];
  feedbacks: unknown[];
}

interface AgentState {
  role: AgentRole;
  profile: AgentProfile;
  sessions: AgentSession[];
  sessionsSeller: AgentSession[];
  currentSessionId: string;
  currentSessionIdSeller: string;
  tasks: AgentTask[];
  journal: { id: string; action: string; at: number; resolved: "accepted" | "declined" }[];
  /* диалог */
  say: (text: string) => void;
  userSaid: (text: string, photo?: string) => void;
  saySeller: (text: string) => void;
  userSaidSeller: (text: string) => void;
  newSession: () => string;
  newSessionSeller: () => string;
  deleteSession: (id: string) => void;
  deleteSessionSeller: (id: string) => void;
  switchSession: (id: string) => void;
  switchSessionSeller: (id: string) => void;
  deleteMessage: (msgId: string) => void;
  deleteMessageSeller: (msgId: string) => void;
  exportAll: () => string;
  /* задачи */
  addTask: (t: Omit<AgentTask, "id" | "startedAt" | "steps" | "status">) => string;
  updateTask: (id: string, patch: Partial<AgentTask>) => void;
  /* память */
  learn: (signal: { type: string; payload: Record<string, unknown> }) => void;
  /* журнал */
  log: (action: string, resolved: "accepted" | "declined") => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      role: "buyer",
      profile: { style: [], palette: [], budget: 0, anti: [], feedbacks: [] },
      sessions: [],
      sessionsSeller: [],
      currentSessionId: "",
      currentSessionIdSeller: "",
      tasks: [],
      journal: [],
      say: (text) => set((s) => {
        if (!s.currentSessionId) {
          const sid = "s-" + Date.now().toString(36);
          return { sessions: [{ id: sid, title: "Новый чат", createdAt: Date.now(), updatedAt: Date.now(), messages: [{ id: "m-" + Date.now().toString(36), from: "agent", text, at: Date.now() }] }], currentSessionId: sid };
        }
        return { sessions: s.sessions.map(x => x.id === s.currentSessionId ? { ...x, updatedAt: Date.now(), messages: [...x.messages, { id: "m-" + Date.now().toString(36), from: "agent", text, at: Date.now() }] } : x) };
      }),
      userSaid: (text, photo) => set((s) => {
        const msg: AgentMsg = { id: "m-" + Date.now().toString(36), from: "user", text, photo, at: Date.now() };
        if (!s.currentSessionId) {
          const sid = "s-" + Date.now().toString(36);
          return { sessions: [{ id: sid, title: text.slice(0, 40) || "Новый чат", createdAt: Date.now(), updatedAt: Date.now(), messages: [msg] }], currentSessionId: sid };
        }
        return { sessions: s.sessions.map(x => {
          if (x.id !== s.currentSessionId) return x;
          const isFirst = x.messages.length === 0;
          return { ...x, updatedAt: Date.now(), title: isFirst && text ? text.slice(0, 40) : x.title, messages: [...x.messages, msg] };
        }) };
      }),
      saySeller: (text) => set((s) => {
        if (!s.currentSessionIdSeller) {
          const sid = "ss-" + Date.now().toString(36);
          return { sessionsSeller: [{ id: sid, title: "Новый чат", createdAt: Date.now(), updatedAt: Date.now(), messages: [{ id: "ms-" + Date.now().toString(36), from: "agent", text, at: Date.now() }] }], currentSessionIdSeller: sid };
        }
        return { sessionsSeller: s.sessionsSeller.map(x => x.id === s.currentSessionIdSeller ? { ...x, updatedAt: Date.now(), messages: [...x.messages, { id: "ms-" + Date.now().toString(36), from: "agent", text, at: Date.now() }] } : x) };
      }),
      userSaidSeller: (text) => set((s) => {
        const msg: AgentMsg = { id: "ms-" + Date.now().toString(36), from: "user", text, at: Date.now() };
        if (!s.currentSessionIdSeller) {
          const sid = "ss-" + Date.now().toString(36);
          return { sessionsSeller: [{ id: sid, title: text.slice(0, 40) || "Новый чат", createdAt: Date.now(), updatedAt: Date.now(), messages: [msg] }], currentSessionIdSeller: sid };
        }
        return { sessionsSeller: s.sessionsSeller.map(x => {
          if (x.id !== s.currentSessionIdSeller) return x;
          const isFirst = x.messages.length === 0;
          return { ...x, updatedAt: Date.now(), title: isFirst && text ? text.slice(0, 40) : x.title, messages: [...x.messages, msg] };
        }) };
      }),
      addTask: (t) => {
        const id = "t-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        set((s) => ({ tasks: [{ ...t, id, startedAt: Date.now(), status: "queued", steps: [] }, ...s.tasks] }));
        return id;
      },
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      learn: (signal) => set((s) => ({ profile: { ...s.profile, feedbacks: [signal, ...s.profile.feedbacks.slice(0, 49)] } })),
      log: (action, resolved) => set((s) => ({ journal: [{ id: "j-" + Date.now(), action, at: Date.now(), resolved }, ...s.journal.slice(0, 99)] })),
      newSession: () => { const id = "s-" + Date.now().toString(36); set((s) => ({ sessions: [{ id, title: "Новый чат", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }, ...s.sessions], currentSessionId: id })); return id; },
      newSessionSeller: () => { const id = "ss-" + Date.now().toString(36); set((s) => ({ sessionsSeller: [{ id, title: "Новый чат", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }, ...s.sessionsSeller], currentSessionIdSeller: id })); return id; },
      deleteSession: (id) => set((s) => { const rest = s.sessions.filter(x => x.id !== id); return { sessions: rest, currentSessionId: s.currentSessionId === id ? (rest[0]?.id || "") : s.currentSessionId }; }),
      deleteSessionSeller: (id) => set((s) => { const rest = s.sessionsSeller.filter(x => x.id !== id); return { sessionsSeller: rest, currentSessionIdSeller: s.currentSessionIdSeller === id ? (rest[0]?.id || "") : s.currentSessionIdSeller }; }),
      switchSession: (id) => set({ currentSessionId: id }),
      switchSessionSeller: (id) => set({ currentSessionIdSeller: id }),
      deleteMessage: (msgId) => set((s) => ({ sessions: s.sessions.map(x => x.id === s.currentSessionId ? { ...x, messages: x.messages.filter(m => m.id !== msgId) } : x) })),
      deleteMessageSeller: (msgId) => set((s) => ({ sessionsSeller: s.sessionsSeller.map(x => x.id === s.currentSessionIdSeller ? { ...x, messages: x.messages.filter(m => m.id !== msgId) } : x) })),
      exportAll: () => JSON.stringify({ buyer: get().sessions, seller: get().sessionsSeller }, null, 2),

    }),
    { name: "quantiform-agent" }
  )
);

/* Tick-воркер: задачи "работают" и приносят результат в уведомления */
export function startAgentWorker() {
  setInterval(() => {
    const tasks = useAgentStore.getState().tasks;
    for (const t of tasks) {
      if (t.status !== "working") continue;
      const elapsed = Date.now() - t.startedAt;
      const workMs = 8000; /* 8 сек — прототип, в продукте будет реально */
      if (elapsed < workMs) continue;
      const result =
        t.kind === "search" ? AGENT_TEMPLATES.photoFound((t.payload?.count as number) || 4)
        : t.kind === "custom" ? AGENT_TEMPLATES.confirmCustom
        : t.kind === "analytics" ? (t.payload?.text as string) || "Готов отчёт по нише."
        : `Задача «${t.title}» выполнена.`;
      useAgentStore.getState().updateTask(t.id, { status: t.kind === "custom" ? "awaiting_confirm" : "done", finishedAt: Date.now(), result, steps: [...t.steps, "Выполнено"] });
      if (t.kind === "custom") {
        useNotifyStore.getState().push({
          kind: "confirm",
          title: "Агент: черновик индивидуального заказа",
          text: result,
          actionLabel: "Отправить мастеру",
          actionType: "agent_custom_send",
          payload: { taskId: t.id },
        });
      } else {
        useNotifyStore.getState().push({
          kind: "report",
          title: "Агент: " + t.title,
          text: result,
        });
      }
    }
  }, 1500);
}
