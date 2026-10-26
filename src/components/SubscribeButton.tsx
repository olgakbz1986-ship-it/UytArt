import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

interface SubscribeButtonProps {
  targetType: string;
  targetId: string;
  variant?: 'default' | 'small';
}

export function SubscribeButton({ targetType, targetId, variant = 'default' }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Проверяем, подписан ли пользователь
    const userId = localStorage.getItem('userId') || 'demo-user-1';
    fetch('/api/subscriptions', {
      headers: { 'x-user-id': userId }
    })
      .then(r => r.json())
      .then(data => {
        const subscribed = data.subscriptions.some(
          (s: any) => s.targetType === targetType && s.targetId === targetId
        );
        setIsSubscribed(subscribed);
      })
      .catch(() => {});
  }, [targetType, targetId]);

  const handleToggle = async () => {
    setLoading(true);
    const userId = localStorage.getItem('userId') || 'demo-user-1';
    const url = '/api/subscriptions';
    
    try {
      if (isSubscribed) {
        // Отписка
        await fetch(`${url}/${targetType}/${targetId}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId }
        });
        setIsSubscribed(false);
      } else {
        // Подписка
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': userId 
          },
          body: JSON.stringify({ targetType, targetId })
        });
        const data = await res.json();
        if (data.ok) setIsSubscribed(true);
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
