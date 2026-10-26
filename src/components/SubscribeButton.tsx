import { useState, useEffect } from 'react';
import { subscribeOnServer, unsubscribeOnServer, isSubscribedCached } from '../lib/userFeed';

interface SubscribeButtonProps {
  targetType: string;
  targetId: string;
  variant?: 'default' | 'small';
}

export function SubscribeButton({ targetType, targetId, variant = 'default' }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(() => isSubscribedCached(targetType, targetId));
  const [loading, setLoading] = useState(false);

  /* ИСПРАВЛЕНИЕ: состояние кнопки и реальная запись подписки теперь
     живут на одном серверном источнике истины (/api/subscriptions).
     Подписка, оформленная кнопкой, гарантированно появляется в кабинете
     покупателя в разделе «Мои подписки». */
  useEffect(() => {
    let alive = true;
    fetch('/api/subscriptions', { headers: { 'x-user-id': localStorage.getItem('userId') || 'demo-user-1' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data || !Array.isArray(data.subscriptions)) return;
        setIsSubscribed(
          data.subscriptions.some((s: any) => s.targetType === targetType && String(s.targetId) === String(targetId))
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [targetType, targetId]);

  const handleToggle = async () => {
    if (!targetId) return; /* цель ещё не резолвлена — не пишем пустую подписку */
    setLoading(true);
    try {
      if (isSubscribed) {
        const ok = await unsubscribeOnServer(targetType, targetId);
        if (ok) setIsSubscribed(false);
      } else {
        const ok = await subscribeOnServer(targetType, targetId);
        if (ok) setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Ошибка подписки:', err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClass = variant === 'small' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center rounded-lg font-medium transition-all ${sizeClass} ${
        isSubscribed
          ? 'bg-accent-deep text-white hover:bg-accent-deep/90'
          : 'bg-surface border border-line text-ink hover:border-accent-deep hover:text-accent-deep'
      } ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {isSubscribed ? (
        <>
          <span>Вы подписаны</span>
        </>
      ) : (
        <>
          <span>Подписаться</span>
        </>
      )}
    </button>
  );
}
