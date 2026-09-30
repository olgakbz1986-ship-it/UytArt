import { useState, useRef, useEffect } from "react";
import { Video, Play, Pause, Save, Download, Plus, Trash2, Clock } from "lucide-react";
import { useSellerAccount } from "../lib/seller";
import { Btn, Field } from "./ui";

interface Props { open: boolean; onClose: () => void; initialPhotos?: string[]; }

interface Frame {
  photo: string;
  duration: number; // секунды
  caption: string;
  transition: "fade" | "zoom" | "slide";
}

export function StudioVideo({ open, onClose, initialPhotos = [] }: Props) {
  const saveWork = useSellerAccount((s) => s.saveWork);
  const [frames, setFrames] = useState<Frame[]>(
    initialPhotos.slice(0, 10).map((p) => ({ photo: p, duration: 3, caption: "", transition: "fade" as const }))
  );
  const [title, setTitle] = useState("Видеообзор товара");
  const [playing, setPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const totalDuration = frames.reduce((sum, f) => sum + f.duration, 0);

  const addFrame = () => {
    if (frames.length >= 10) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setFrames([...frames, { photo: reader.result as string, duration: 3, caption: "", transition: "fade" }]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const updateFrame = (idx: number, patch: Partial<Frame>) => {
    setFrames(frames.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeFrame = (idx: number) => {
    setFrames(frames.filter((_, i) => i !== idx));
  };

  // Предпросмотр
  useEffect(() => {
    if (!playing || frames.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    let elapsed = 0;
    let frameIdx = 0;
    setCurrentFrame(0);
    timerRef.current = window.setInterval(() => {
      elapsed += 0.1;
      const currentFrameData = frames[frameIdx];
      if (!currentFrameData) {
        setPlaying(false);
        return;
      }
      if (elapsed >= currentFrameData.duration) {
        elapsed = 0;
        frameIdx = (frameIdx + 1) % frames.length;
        setCurrentFrame(frameIdx);
        if (frameIdx === 0) {
          setPlaying(false);
        }
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, frames]);

  // Запись видео через MediaRecorder + canvas
  const startRecording = async () => {
    if (!canvasRef.current || frames.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setRecording(true);
    setRecordedBlob(null);
    chunksRef.current = [];

    const stream = canvas.captureStream(30); // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecording(false);
    };

    mediaRecorder.start();

    // Анимация кадров на canvas
    let frameIdx = 0;
    let elapsed = 0;
    const renderFrame = () => {
      if (!recording && frameIdx >= frames.length) {
        mediaRecorder.stop();
        return;
      }
      const frame = frames[frameIdx];
      if (!frame) return;

      // Рисуем фото
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Cover-fit
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        
        if (frame.transition === "zoom") {
          const zoomScale = 1 + (elapsed / frame.duration) * 0.1;
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(zoomScale, zoomScale);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();
        } else if (frame.transition === "slide") {
          const slideX = (elapsed / frame.duration) * canvas.width * 0.1;
          ctx.drawImage(img, x - slideX, y, w, h);
        } else {
          ctx.globalAlpha = elapsed < 0.3 ? elapsed / 0.3 : elapsed > frame.duration - 0.3 ? (frame.duration - elapsed) / 0.3 : 1;
          ctx.drawImage(img, x, y, w, h);
          ctx.globalAlpha = 1;
        }

        // Субтитры
        if (frame.caption) {
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 24px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(frame.caption, canvas.width / 2, canvas.height - 35);
        }
      };
      img.src = frame.photo;

      elapsed += 0.1;
      if (elapsed >= frame.duration) {
        elapsed = 0;
        frameIdx++;
        if (frameIdx >= frames.length) {
          setTimeout(() => mediaRecorder.stop(), 500);
          return;
        }
      }
      if (recording) requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  };

  const downloadVideo = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = title.replace(/\s+/g, "_") + ".webm";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    saveWork({
      type: "video",
      name: "Видео: " + title,
      folder: "Видеообзоры",
      spec: "qf",
      data: { frames, title, totalDuration },
      preview: frames[0]?.photo || "",
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-lift max-w-[1100px] w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface z-10 px-6 py-4 border-b border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-dark text-cream flex items-center justify-center"><Video size={18} /></span>
            <div>
              <h2 className="font-display font-bold text-[20px] text-ink">🎬 Видеостудия</h2>
              <p className="text-[12px] text-ink-soft">30-секундное видео из фото с переходами и субтитрами</p>
            </div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-line-soft text-ink-mute hover:bg-error hover:text-white cursor-pointer" onClick={onClose}>×</button>
        </div>

        <div className="grid lg:grid-cols-[350px_1fr] gap-6 p-6">
          {/* Левая колонка: Настройки */}
          <div className="space-y-4">
            <Field label="Название видео">
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Видеообзор товара" />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-ink-mute">КАДРЫ ({frames.length}/10)</p>
                <span className="text-[11px] font-bold text-accent flex items-center gap-1"><Clock size={12} /> {totalDuration} сек</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {frames.map((frame, i) => (
                  <div key={i} className="bg-surface-soft rounded-lg p-3 border border-line-soft">
                    <div className="flex gap-2 mb-2">
                      <img src={frame.photo} alt="" className="w-16 h-16 rounded object-cover" />
                      <div className="flex-1 space-y-1">
                        <input className="field text-[11px] h-7" placeholder="Субтитры кадра" value={frame.caption} onChange={(e) => updateFrame(i, { caption: e.target.value })} />
                        <div className="flex gap-1">
                          <select className="field text-[10px] h-7 flex-1" value={frame.transition} onChange={(e) => updateFrame(i, { transition: e.target.value as any })}>
                            <option value="fade">Fade</option>
                            <option value="zoom">Zoom</option>
                            <option value="slide">Slide</option>
                          </select>
                          <input className="field text-[10px] h-7 w-16" type="number" min="1" max="10" value={frame.duration} onChange={(e) => updateFrame(i, { duration: +e.target.value })} />
                          <span className="text-[10px] text-ink-mute flex items-center">сек</span>
                        </div>
                      </div>
                      <button onClick={() => removeFrame(i)} className="w-7 h-7 rounded bg-line-soft text-ink-mute hover:bg-error hover:text-white flex items-center justify-center cursor-pointer"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                {frames.length < 10 && (
                  <button onClick={addFrame} className="w-full h-16 rounded-lg border-2 border-dashed border-line-soft text-ink-mute hover:border-accent flex items-center justify-center gap-2 cursor-pointer">
                    <Plus size={16} /> Добавить кадр
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Btn size="lg" className="flex-1" onClick={startRecording} disabled={recording || frames.length === 0}>
                {recording ? "Запись..." : <><Video size={16} className="mr-2" /> Записать видео</>}
              </Btn>
              {recordedBlob && (
                <Btn size="lg" variant="ghost" onClick={downloadVideo}>
                  <Download size={16} />
                </Btn>
              )}
            </div>
            <Btn size="lg" className="w-full" onClick={handleSave}><Save size={16} className="mr-2" /> Сохранить в мои работы</Btn>
          </div>

          {/* Правая колонка: Предпросмотр */}
          <div>
            <p className="text-[11px] font-bold text-ink-mute mb-2">ПРЕДПРОСМОТР ({frames[currentFrame]?.duration || 0}с / {totalDuration}с)</p>
            <canvas ref={canvasRef} width={540} height={960} className="w-full max-h-[600px] rounded-xl border border-line-soft bg-black" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPlaying(!playing)} disabled={frames.length === 0}
                className="flex-1 h-10 rounded-lg bg-dark text-cream font-bold hover:bg-accent-deep disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                {playing ? <><Pause size={16} /> Стоп</> : <><Play size={16} /> Предпросмотр</>}
              </button>
            </div>
            {recordedBlob && (
              <div className="mt-3 p-3 bg-success/10 rounded-lg border border-success">
                <p className="text-[12px] font-bold text-success mb-1">✅ Видео записано!</p>
                <p className="text-[11px] text-ink-soft">Размер: {(recordedBlob.size / 1024).toFixed(1)} KB · Нажмите кнопку скачивания слева</p>
              </div>
            )}
            <p className="text-[10px] text-ink-mute mt-2">* Запись через MediaRecorder API (WebM). Для MP4 используйте конвертер или подключите FFmpeg.wasm.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
