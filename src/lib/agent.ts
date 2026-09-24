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
  at: number;
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
  dialog: AgentMsg[];
  tasks: AgentTask[];
  journal: { id: string; action: string; at: number; resolved: "accepted" | "declined" }[];
  /* диалог */
  say: (text: string) => void;
  userSaid: (text: string) => void;
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
    (set) => ({
      role: "buyer",
      profile: { style: [], palette: [], budget: 0, anti: [], feedbacks: [] },
      dialog: [],
      tasks: [],
      journal: [],
      say: (text) => set((s) => ({ dialog: [...s.dialog, { id: "m-" + Date.now().toString(36), from: "agent", text, at: Date.now() }] })),
      userSaid: (text) => set((s) => ({ dialog: [...s.dialog, { id: "m-" + Date.now().toString(36), from: "user", text, at: Date.now() }] })),
      addTask: (t) => {
        const id = "t-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        set((s) => ({ tasks: [{ ...t, id, startedAt: Date.now(), status: "queued", steps: [] }, ...s.tasks] }));
        return id;
      },
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      learn: (signal) => set((s) => ({ profile: { ...s.profile, feedbacks: [signal, ...s.profile.feedbacks.slice(0, 49)] } })),
      log: (action, resolved) => set((s) => ({ journal: [{ id: "j-" + Date.now(), action, at: Date.now(), resolved }, ...s.journal.slice(0, 99)] })),
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
