import { useMemo, useState } from "react";
import { Folder, Search, Trash2, Edit3, Upload, Sparkles } from "lucide-react";
import { useSellerAccount, WorkItem } from "../lib/seller";
import { Btn } from "./ui";

interface Props { open: boolean; onClose: () => void; onOpenWork: (id: string) => void; onPublish: (w: WorkItem) => void; }

export function StudioLibrary({ open, onClose, onOpenWork, onPublish }: Props) {
  const works = useSellerAccount((s) => s.works);
  const deleteWork = useSellerAccount((s) => s.deleteWork);
  const [q, setQ] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  const folders = useMemo(() => {
    const set = new Set(works.map((w: any) => w.folder || "По умолчанию"));
    return Array.from(set);
  }, [works]);

  const filtered = useMemo(() => works.filter((w: any) => {
    if (folderFilter && w.folder !== folderFilter) return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    return w.name.toLowerCase().includes(ql) || (w.data?.title || "").toLowerCase().includes(ql);
  }), [works, q, folderFilter]);

  const limit = 10; // упрощённо, далее по тарифу

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] top-16 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[1000px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><Folder size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">📚 Мои работы</h2>
              <p className="text-[12px] text-ink-soft">Сохранено {works.length} из {limit} · папок: {folders.length}</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input className="field pl-9" placeholder="Поиск по названию работы…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field w-auto" value={folderFilter || ""} onChange={(e) => setFolderFilter(e.target.value || null)}>
              <option value="">Все папки</option>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[48px] mb-2">📭</p>
              <p className="font-display font-bold text-[18px] text-ink mb-1">Пока пусто</p>
              <p className="text-[13px] text-ink-soft">Создайте первую карточку в «Конструкторе карточек» — она появится здесь.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((w: any) => (
                <div key={w.id} className="bg-cream rounded-xl shadow-card overflow-hidden border border-line-soft group">
                  <div className="aspect-[3/4] bg-line-soft flex items-center justify-center overflow-hidden">
                    {w.preview ? <img src={w.preview} alt={w.name} className="w-full h-full object-cover" /> : <Sparkles size={40} className="text-ink-mute" />}
                  </div>
                  <div className="p-3">
                    <p className="font-display font-bold text-[13px] text-ink truncate">{w.name}</p>
                    <p className="text-[11px] text-ink-mute flex items-center gap-1.5 mt-0.5">
                      <Folder size={10} /> {w.folder || "По умолчанию"} · {new Date(w.updatedAt).toLocaleDateString("ru-RU")}
                    </p>
                    <div className="flex gap-1.5 mt-3">
                      <button onClick={() => onOpenWork(w.id)} className="flex-1 h-8 rounded-[8px] bg-line-soft text-[11px] font-bold text-ink-soft hover:bg-line cursor-pointer flex items-center justify-center gap-1"><Edit3 size={12} /> Открыть</button>
                      <button onClick={() => onPublish(w)} className="flex-1 h-8 rounded-[8px] bg-dark text-cream text-[11px] font-bold hover:bg-accent-deep cursor-pointer flex items-center justify-center gap-1"><Upload size={12} /> Товар</button>
                      <button onClick={() => { if (confirm("Удалить работу?")) deleteWork(w.id); }} className="w-8 h-8 shrink-0 rounded-[8px] bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer flex items-center justify-center"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
