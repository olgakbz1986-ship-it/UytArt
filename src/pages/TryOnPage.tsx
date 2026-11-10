import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Upload, Sparkles, Share2, ShoppingCart, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { Btn } from "../components/ui";


export function TryOnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("productId");
  const productImageUrl = searchParams.get("imageUrl") || "";
  const productName = searchParams.get("productName") || "Выбранный товар";

  const [userImage, setUserImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  // Ленивая инициализация: если в URL есть session, сразу показываем результат (для функции "Поделиться")
  const initialSession = searchParams.get("session");
  const [sessionId, setSessionId] = useState<string | null>(initialSession);
  const [resultImage, setResultImage] = useState<string | null>(
    initialSession ? "https://placehold.co/600x800/1e3a2f/ffffff?text=Результат+AI+Примерки" : null
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Файл слишком большой. Максимум 5 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setUserImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!userImage) return;
    setIsGenerating(true);
    setResultImage(null);

    try {
      // Имитация запроса к AI-провайдеру (Yandex Vision / Stable Diffusion)
      // В проде здесь: const res = await fetch('/api/ai/try-on', { method: 'POST', body: JSON.stringify({ productId, userImage, productImageUrl }) })
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      const mockSessionId = "tryon-" + Date.now().toString(36);
      setSessionId(mockSessionId);
      // Заглушка результата. В проде здесь будет URL из S3/хранилища
      setResultImage("https://placehold.co/600x800/d98e32/ffffff?text=AI+Коллаж+Готов!");
      
      // Обновляем URL для возможности поделиться
      navigate(`/try-on?session=${mockSessionId}`, { replace: true });
    } catch (err) {
      console.error("Ошибка генерации:", err);
      alert("Не удалось создать примерку. Попробуйте позже.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = () => {
    if (sessionId) {
      const url = `${window.location.origin}/#/try-on?session=${sessionId}`;
      navigator.clipboard.writeText(url);
      alert("Ссылка на примерку скопирована в буфер обмена!");
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10">
      <Link to={productId ? `/product/${productId}` : "/catalog"} className="inline-flex items-center gap-2 text-[14px] font-bold text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft size={16} /> Вернуться к товару
      </Link>

      <div className="text-center mb-8">
        <h1 className="font-display font-bold text-[clamp(28px,4vw,42px)] text-ink mb-2">Виртуальная примерочная</h1>
        <p className="text-[15px] text-ink-soft max-w-2xl mx-auto">
          Загрузите своё фото или фото комнаты, и наш AI-агент гармонично впишет «{productName}» в ваше пространство.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Левая колонка: Загрузка */}
        <div className="space-y-6">
          {/* Фото товара */}
          <div className="bg-surface rounded-2xl border border-line-soft p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-3">1. Товар из каталога</p>
            <div className="aspect-square rounded-xl bg-cream/50 flex items-center justify-center overflow-hidden border border-line-soft">
              {productImageUrl ? (
                <img src={productImageUrl} alt="Товар" className="w-full h-full object-contain p-4" />
              ) : (
                <ImageIcon size={48} className="text-ink-mute" />
              )}
            </div>
          </div>

          {/* Фото пользователя */}
          <div className="bg-surface rounded-2xl border border-line-soft p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-mute mb-3">2. Ваше фото (или фото комнаты)</p>
            <label className="aspect-square rounded-xl border-2 border-dashed border-line bg-cream/30 flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group">
              {userImage ? (
                <img src={userImage} alt="Ваше фото" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <>
                  <Upload size={32} className="text-ink-mute group-hover:text-accent mb-2 transition-colors" />
                  <span className="text-[13px] font-semibold text-ink-soft group-hover:text-ink">Нажмите для загрузки</span>
                  <span className="text-[11px] text-ink-mute mt-1">JPG, PNG до 5 МБ</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <Btn 
            size="lg" 
            className="w-full" 
            disabled={!userImage || isGenerating} 
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles size={18} className="animate-pulse" /> AI создаёт примерку...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles size={18} /> Создать примерку
              </span>
            )}
          </Btn>
        </div>

        {/* Правая колонка: Результат */}
        <div className="bg-dark text-cream rounded-2xl p-6 min-h-[500px] flex flex-col">
          <p className="text-[12px] font-bold uppercase tracking-wide text-cream/60 mb-4">3. Результат AI-генерации</p>
          
          <div className="flex-1 rounded-xl bg-dark/50 border border-white/10 flex items-center justify-center overflow-hidden relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[14px] font-semibold text-accent animate-pulse">Анализируем пропорции и свет...</p>
              </div>
            )}
            
            {resultImage ? (
              <img src={resultImage} alt="Результат примерки" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center p-8">
                <Sparkles size={48} className="mx-auto text-cream/20 mb-4" />
                <p className="text-[14px] text-cream/50">Здесь появится ваш AI-коллаж</p>
              </div>
            )}
          </div>

          {resultImage && !isGenerating && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Btn variant="outline" className="border-white/20 text-cream hover:bg-white/10" onClick={handleShare}>
                <Share2 size={16} className="mr-2" /> Поделиться
              </Btn>
              {productId && (
                <Link to={`/product/${productId}`}>
                  <Btn className="w-full bg-accent text-ink hover:bg-accent-deep">
                    <ShoppingCart size={16} className="mr-2" /> В корзину
                  </Btn>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}