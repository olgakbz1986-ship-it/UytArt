import React from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Header, Footer } from "./components/layout";
import HomePage from "./pages/home";
import { CatalogPage, ProductPage } from "./pages/catalog";
import { CartPage, CheckoutPage } from "./pages/checkout";
import { AuthPage } from "./pages/auth";
import { MastersPage, ShopPage } from "./pages/masters";
import AiPage from "./pages/ai";
import ProfilePage from "./pages/profile";
import {
  PlansPage, MarketPage, SellerRegisterPage, SellerDashboardPage,
  AboutPage, LegalIndexPage, LegalPage, ContactsPage, NotFoundPage,
} from "./pages/extras";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
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
              <Route path="/ai-assistant" element={<AiPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/seller/register" element={<SellerRegisterPage />} />
              <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/legal" element={<LegalIndexPage />} />
              <Route path="/legal/:type" element={<LegalPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </ErrorBoundary>
    </HashRouter>
  );
}
