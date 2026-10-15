import React from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, Suspense } from "react";
import { usePrefsStore, applyTheme } from "./lib/prefs";
import { useAppStore } from "./lib/store";
import { Header, Footer, Toasts } from "./components/layout";
import { CenteredLoader } from "./components/CenteredLoader";
import HomePage from "./pages/home";
import { CatalogPage, ProductPage } from "./pages/catalog";
import { CartPage, CheckoutPage } from "./pages/checkout";
import { AuthPage } from "./pages/auth";

/* ТЗ 14.2: code-splitting тяжёлых страниц — грузятся динамически при переходе */
const AiPage = React.lazy(() => import("./pages/ai"));
const AiDesignerPage = React.lazy(() => import("./features/ai-designer/AiDesigner"));
const ProfilePage = React.lazy(() => import("./pages/profile"));
const ProductEditorPage = React.lazy(() => import("./pages/ProductEditor").then((m) => ({ default: m.ProductEditorPage })));
const MastersPage = React.lazy(() => import("./pages/masters").then((m) => ({ default: m.MastersPage })));
const ShopPage = React.lazy(() => import("./pages/masters").then((m) => ({ default: m.ShopPage })));
const PlansPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.PlansPage })));
const MarketPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.MarketPage })));
const SellerRegisterPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.SellerRegisterPage })));
const SellerDashboardPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.SellerDashboardPage })));
const AboutPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.AboutPage })));
const LegalIndexPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.LegalIndexPage })));
const LegalPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.LegalPage })));
const ContactsPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.ContactsPage })));
const NotFoundPage = React.lazy(() => import("./pages/extras").then((m) => ({ default: m.NotFoundPage })));
/* Кабинет администратора — закрытая приватная зона (hash-роутинг #/admin, серверные cookie-сессии).
   На публичном сайте нет ни одной ссылки на кабинет и он не индексируется. */
const Cabinet = React.lazy(() => import("./pages/cabinet/router"));
const DigitalProductViewPage = React.lazy(() => import("./pages/DigitalProductView").then((m) => ({ default: m.DigitalProductView })));
const DigitalPurchasesPage = React.lazy(() => import("./pages/DigitalPurchases").then((m) => ({ default: m.DigitalPurchasesPage })));

function PageFallback() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
      <div className="h-4 w-40 rounded bg-line-soft animate-pulse mb-3" />
      <div className="h-4 w-64 rounded bg-line-soft animate-pulse" />
    </div>
  );
}
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/* синхронизация темы с <html data-theme>; для «системной» следит за ОС */
function ThemeSync() {
  const theme = usePrefsStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}

function SessionRestore() {
  useEffect(() => { useAppStore.getState().restoreSession(); }, []);
  return null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="max-w-[640px] mx-auto px-4 py-24 text-center">
          <p className="text-[56px] mb-3">🛠️</p>
          <h1 className="font-display font-bold text-[26px] text-ink mb-2">Что-то пошло не так</h1>
          <p className="text-[14px] text-ink-soft mb-6">Сброс данных почти наверняка вернёт сервис к жизни.</p>
          <pre className="text-left bg-surface border border-line rounded-xl p-4 text-[11px] text-error overflow-auto max-h-40 mb-6 whitespace-pre-wrap">{String(this.state.error)}</pre>
          <button
            onClick={() => { localStorage.clear(); window.location.hash = "#/"; window.location.reload(); }}
            className="h-[52px] px-7 rounded-[10px] bg-accent text-ink font-semibold hover:bg-accent-deep hover:text-cream transition-colors cursor-pointer"
          >
            Сбросить и перезапустить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <ThemeSync />
        <SessionRestore />
        <div className="min-h-screen flex flex-col">
          <Header />
          <Toasts />
          <main className="flex-1">
            <React.Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/digital/:id" element={<DigitalProductViewPage />} />
              <Route path="/digital-purchases" element={<DigitalPurchasesPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/masters" element={<MastersPage />} />
              <Route path="/shop/:slug" element={<ShopPage />} />
              <Route path="/ai-assistant" element={<AiPage />} />
              <Route path="/ai-designer" element={<AiDesignerPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/seller/register" element={<SellerRegisterPage />} />
              <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
              <Route path="/seller/product/new" element={<ProductEditorPage />} />
              <Route path="/seller/product/:id/edit" element={<ProductEditorPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/legal" element={<LegalIndexPage />} />
              <Route path="/legal/:type" element={<LegalPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/admin" element={<Suspense fallback={<CenteredLoader />}><Cabinet /></Suspense>} />
              <Route path="/admin/:seg" element={<Suspense fallback={<CenteredLoader />}><Cabinet /></Suspense>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </React.Suspense>
          </main>
          <Footer />
        </div>
      </ErrorBoundary>
    </HashRouter>
  );
}

