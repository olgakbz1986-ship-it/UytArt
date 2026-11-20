import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Поймана ошибка рендера:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl bg-danger-soft border border-danger/30 text-center">
          <p className="text-[16px] font-bold text-danger mb-2">⚠️ Ошибка в этом разделе</p>
          <p className="text-[13px] text-ink-soft mb-4">Этот блок временно недоступен, но остальной кабинет работает нормально.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-dark text-cream text-[13px] font-bold hover:bg-dark-deep"
          >
            Попробовать обновить блок
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}