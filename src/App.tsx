import React from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Header, Footer } from "./components/layout";
import HomePage from "./pages/home";
import { CatalogPage, ProductPage } from "./pages/catalog";
import { CartPage, CheckoutPage } from "./pages/checkout";
import { AuthPage } from "./pages/auth";
import { MastersPage, ShopPage } from "./pages/masters";
import ProfilePage from "./pages/profile";
import AiPage from "./pages/ai";
import {
  PlansPage, MarketPage, SellerRegisterPage, SellerDashboardPage,
  AboutPage, LegalPage, ContactsPage, NotFoundPage,
} from "./pages/extras";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[УютАрт]", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-[640px] text-center">
            <p className="text-[44px] mb-3">🛠️</p>
            <h1 className="font-display font-bold text-[26px] text-ink mb-3">Что-то пошло не так</h1>
            <p className="text-[14px] text-ink-soft mb-5">Обновите страницу. Если не помогло — сбросьте данные приложения.</p>
            <pre className="text-left bg-surface border border-line-soft rounded-[14px] p-4 text-[11px] overflow-auto max-h-40 text-error whitespace-pre-wrap mb-5">
              {String(this.state.error)}
            </pre>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => location.reload()} className="h-11 px-6 rounded-[10px] bg-dark text-cream font-semibold hover:bg-dark-deep transition-colors cursor-pointer">Обновить</button>
              <button
                onClick={() => { Object.keys(localStorage).filter((k) => k.startsWith("uyutart-")).forEach((k) => localStorage.removeItem(k)); location.reload(); }}
                className="h-11 px-6 rounded-[10px] border border-line bg-surface font-semibold hover:bg-cream transition-colors cursor-pointer"
              >
                Сбросить данные
              </button>
            </div>
          </div>
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
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/masters" element={<MastersPage />} />
              <Route path="/shop/:slug" element={<ShopPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/ai-assistant" element={<AiPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/seller/register" element={<SellerRegisterPage />} />
              <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/legal/:type" element={<LegalPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </ErrorBoundary>
    </HashRouter>
  );
}
