const fs = require("fs");
const path = require("path");

console.log("🚀 Начинаем внедрение модуля 'Примерочная'...");

// 1. Создаём frontend-страницу Примерочной
const tryOnPage = `import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Upload, Sparkles, Share2, ShoppingCart, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { Btn } from "../components/ui";
import { useAppStore } from "../lib/store";

export function TryOnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("productId");
  const productImageUrl = searchParams.get("imageUrl") || "";
  const productName = searchParams.get("productName") || "Выбранный товар";

  const [userImage, setUserImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Если в URL есть session, загружаем результат (для функции "Поделиться")
  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid) {
      // В демо-режиме просто показываем заглушку, в проде здесь будет fetch('/api/ai/try-on/' + sid)
      setResultImage("https://placehold.co/600x800/1e3a2f/ffffff?text=Результат+AI+Примерки");
      setSessionId(sid);
    }
  }, [searchParams]);

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
      navigate(\`/try-on?session=\${mockSessionId}\`, { replace: true });
    } catch (err) {
      console.error("Ошибка генерации:", err);
      alert("Не удалось создать примерку. Попробуйте позже.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = () => {
    if (sessionId) {
      const url = \`\${window.location.origin}/#/try-on?session=\${sessionId}\`;
      navigator.clipboard.writeText(url);
      alert("Ссылка на примерку скопирована в буфер обмена!");
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10">
      <Link to={productId ? \`/product/\${productId}\` : "/catalog"} className="inline-flex items-center gap-2 text-[14px] font-bold text-ink-soft hover:text-ink mb-6 transition-colors">
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
                <Link to={\`/product/\${productId}\`}>
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
}`;

fs.writeFileSync("src/pages/TryOnPage.tsx", tryOnPage);
console.log("✅ Создан src/pages/TryOnPage.tsx");

// 2. Добавляем маршрут в App.tsx
let appSrc = fs.readFileSync("src/App.tsx", "utf8");
if (!appSrc.includes("TryOnPage")) {
  appSrc = appSrc.replace(
    'const DigitalPurchasesPage = React.lazy(() => import("./pages/DigitalPurchases").then((m) => ({ default: m.DigitalPurchasesPage })));',
    'const DigitalPurchasesPage = React.lazy(() => import("./pages/DigitalPurchases").then((m) => ({ default: m.DigitalPurchasesPage })));\nconst TryOnPage = React.lazy(() => import("./pages/TryOnPage").then((m) => ({ default: m.TryOnPage })));'
  );
  appSrc = appSrc.replace(
    '<Route path="/digital-purchases" element={<DigitalPurchasesPage />} />',
    '<Route path="/digital-purchases" element={<DigitalPurchasesPage />} />\n              <Route path="/try-on" element={<TryOnPage />} />'
  );
  fs.writeFileSync("src/App.tsx", appSrc);
  console.log("✅ Обновлён src/App.tsx (добавлен маршрут /try-on)");
}

// 3. Добавляем кнопку "Примерить" на страницу товара (ProductPage в catalog.tsx)
let catalogSrc = fs.readFileSync("src/pages/catalog.tsx", "utf8");
if (!catalogSrc.includes("try-on")) {
  // Находим кнопку "В корзину" и добавляем рядом кнопку "Примерить"
  catalogSrc = catalogSrc.replace(
    /(<Btn.*?onClick=\{\(\) => addToCart\(p\.id\)\}.*?>[\s\S]*?В корзину[\s\S]*?<\/Btn>)/,
    `$1\n              <Link to={\`/try-on?productId=\${p.id}&imageUrl=\${encodeURIComponent(p.preview || '')}&productName=\${encodeURIComponent(p.name)}\`} className="h-[52px] flex-1 px-4 rounded-[10px] border border-line bg-surface text-[14px] font-semibold hover:bg-cream transition-colors flex items-center justify-center gap-2 text-ink">\n                <Sparkles size={16} className="text-accent-deep" />\n                Примерить\n              </Link>`
  );
  // Убедимся, что Sparkles импортирован
  if (!catalogSrc.includes("Sparkles")) {
    catalogSrc = catalogSrc.replace("from \"lucide-react\";", ", Sparkles } from \"lucide-react\";");
  }
  fs.writeFileSync("src/pages/catalog.tsx", catalogSrc);
  console.log("✅ Обновлён src/pages/catalog.tsx (добавлена кнопка 'Примерить')");
}

// 4. Добавляем backend-заглушку для /api/ai/try-on в server/index.cjs
let serverSrc = fs.readFileSync("server/index.cjs", "utf8");
if (!serverSrc.includes("/api/ai/try-on")) {
  const tryOnRoute = `
/* ============================================================
   МОДУЛЬ "ПРИМЕРОЧНАЯ" (Virtual Try-On)
   Принимает фото пользователя и товара, возвращает jobId.
   В проде здесь вызов YandexART / Stable Diffusion Inpainting.
   ============================================================ */
app.post("/api/ai/try-on", guard, async (req, res) => {
  try {
    const { productId, userImage, productImageUrl } = req.body;
    if (!userImage) return res.status(400).json({ error: "userImage required" });
    
    const sessionId = "tryon-" + crypto.randomUUID();
    
    // В проде: сохраняем в БД со статусом 'processing' и отправляем в BullMQ
    // Для dev-демо: просто возвращаем sessionId, клиент будет имитировать ожидание
    
    console.log(\`[TRY-ON] Новая сессия \${sessionId} для товара \${productId}\`);
    
    res.json({ 
      ok: true, 
      sessionId, 
      status: "processing",
      message: "Задача поставлена в очередь AI-генерации" 
    });
  } catch (e) {
    console.error("[TRY-ON ERROR]", e);
    res.status(500).json({ error: "server" });
  }
});
`;
  // Вставляем перед последними middleware (например, перед обработкой 404)
  serverSrc = serverSrc.replace(
    "// Обработка 404 для всех остальных маршрутов",
    tryOnRoute + "\n// Обработка 404 для всех остальных маршрутов"
  );
  fs.writeFileSync("server/index.cjs", serverSrc);
  console.log("✅ Обновлён server/index.cjs (добавлен endpoint /api/ai/try-on)");
}

console.log("\n🎉 Патч 'Примерочная' успешно применён!");
console.log("Следующие шаги:");
console.log("1. npm run lint:fix");
console.log("2. Перезапустите сервер: node server/index.cjs");
console.log("3. Откройте любой товар и нажмите кнопку 'Примерить' рядом с 'В корзину'");
