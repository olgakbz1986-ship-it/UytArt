import { useEffect, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAppStore } from "../lib/store";
import type { DigitalProduct, PromptProduct, AgentProduct } from "../types/digital";
import { Btn } from "../components/ui";

export function DigitalProductView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const testDriveRef = useRef<HTMLDivElement | null>(null);
  const session = useAppStore((s) => s.session);
  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);
  const [testDriveResult, setTestDriveResult] = useState<string>("");
  const [testDriveInput, setTestDriveInput] = useState("");
  const [testDriveLoading, setTestDriveLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/digital/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.product) setProduct(data.product);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !session?.userId) return;
    fetch("/api/digital/my/purchases")
      .then((r) => r.json())
      .then((data) => {
        if (data.purchases) {
          const found = data.purchases.find((p: any) => p.productId === id);
          setPurchased(!!found);
        }
      })
      .catch(() => {});
  }, [id, session?.userId]);

  const handlePurchase = async () => {
    if (!id) return;
    const res = await fetch(`/api/digital/${id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      setPurchased(true);
      alert("Покупка успешна!");
    } else {
      alert("Ошибка покупки");
    }
  };

  const handleTestDrive = async () => {
    if (!id || !testDriveInput.trim()) return;
    setTestDriveLoading(true);
    setTestDriveResult("");
    try {
      const res = await fetch(`/api/digital/${id}/test-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: testDriveInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestDriveResult(data.output || "Тест выполнен");
      } else {
        setTestDriveResult(`Ошибка: ${data.error || "лимит исчерпан"}`);
      }
    } catch {
      setTestDriveResult("Ошибка сети");
    }
    setTestDriveLoading(false);
  };

  if (loading) return <div className="max-w-[1280px] mx-auto px-4 py-16">Загрузка...</div>;
  if (!product) return <div className="max-w-[1280px] mx-auto px-4 py-16">Товар не найден</div>;

  const isPrompt = product.type === "prompt";
  const isAgent = product.type === "agent";
  const showTestDrive = (isPrompt || isAgent) && !purchased;

  /* Автофокус на секции тест-драйва при переходе с карточки каталога (?section=test-drive) */
  useEffect(() => {
    if (!loading && product && searchParams.get("section") === "test-drive" && testDriveRef.current) {
      testDriveRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const ta = testDriveRef.current.querySelector("textarea");
      if (ta) setTimeout(() => ta.focus(), 350);
    }
  }, [loading, product, searchParams]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <Link to="/catalog" className="text-blue-600 hover:underline mb-4 inline-block">← Назад в каталог</Link>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Левая колонка: превью */}
        <div>
          {product.previewUrl ? (
            <img src={product.previewUrl} alt={product.title} className="w-full rounded-lg shadow-lg" />
          ) : (
            <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
              Нет превью
            </div>
          )}
        </div>

        {/* Правая колонка: информация */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
          <div className="text-2xl font-bold text-green-600 mb-4">{product.price} ₽</div>
          
          <div className="mb-4">
            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {product.type === "site" && "Сайт / шаблон"}
              {product.type === "prompt" && "Промт"}
              {product.type === "skill" && "Скилл для ИИ"}
              {product.type === "agent" && "ИИ-агент"}
              {product.type === "subscription" && "Подписка"}
            </span>
            <span className="ml-2 text-sm text-gray-500">Версия {product.version}</span>
          </div>

          <p className="text-gray-700 mb-6 whitespace-pre-line">{product.description}</p>

          {/* Специфичные поля по типу */}
          {product.type === "site" && (
            <div className="mb-4">
              <strong>Технологии:</strong> {(product as any).techStack?.join(", ")}
              {(product as any).demoUrl && (
                <div><a href={(product as any).demoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Демо</a></div>
              )}
            </div>
          )}

          {product.type === "prompt" && (
            <div className="mb-4">
              <strong>Целевая ИИ-модель:</strong> {(product as PromptProduct).targetAI}
            </div>
          )}

          {product.type === "agent" && (
            <div className="mb-4">
              <strong>Провайдер:</strong> {(product as AgentProduct).modelProvider}
              <div><strong>Лимит токенов/мес:</strong> {(product as AgentProduct).monthlyTokenLimit}</div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="space-y-3">
            {showTestDrive && (product.testDriveLimit || 0) > 0 && (
              <Btn variant="outline" className="w-full" onClick={() => {
                testDriveRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                const ta = testDriveRef.current?.querySelector("textarea");
                if (ta) setTimeout(() => ta.focus(), 350);
              }}>Тест-драйв бесплатно</Btn>
            )}
            {purchased ? (
              <Btn variant="primary" onClick={() => window.open(`/api/digital/${id}/download`, "_blank")}>
                Скачать / Открыть доступ
              </Btn>
            ) : (
              <Btn variant="primary" onClick={handlePurchase}>
                Купить за {product.price} ₽
              </Btn>
            )}
          </div>

          {/* Блок тест-драйва */}
          {showTestDrive && (
            <div ref={testDriveRef} className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-bold mb-2">Тест-драйв (бесплатно, {product.testDriveLimit} попытки)</h3>
              <textarea
                value={testDriveInput}
                onChange={(e) => setTestDriveInput(e.target.value)}
                placeholder="Введите запрос для теста..."
                className="w-full p-2 border rounded mb-2"
                rows={3}
              />
              <Btn variant="outline" onClick={handleTestDrive} disabled={testDriveLoading}>
                {testDriveLoading ? "Выполняется..." : "Запустить тест"}
              </Btn>
              {testDriveResult && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <strong>Результат:</strong>
                  <pre className="whitespace-pre-wrap text-sm">{testDriveResult}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
