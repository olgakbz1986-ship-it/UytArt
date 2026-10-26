import { useState } from 'react';
import { subscribeOnServer, unsubscribeOnServer, useUserSubscriptions } from '../lib/userFeed';

interface SubscribeButtonProps {
  targetType: string;
  targetId: string;
  variant?: 'default' | 'small';
}

export function SubscribeButton({ targetType, targetId, variant = 'default' }: SubscribeButtonProps) {
  /* ИСПРАВЛЕНИЕ: состояние кнопки читается из того же единого серверного
     источника истины (/api/subscriptions), что и раздел «Мои подписки» в
     кабинете — через общий хук useUserSubscriptions (с кэшем и корректным
     id покупателя). Ранее кнопка ходила на сервер сама, читая несуществующий
     ключ localStorage "userId", — из-за этого «Вы подписаны» и реальный
     список подписок могли расходиться. */
  const { subscriptions } = useUserSubscriptions();
  const isSubscribed =
    !!targetId &&
    subscriptions.some(
      (s) => s.targetType === targetType && String(s.targetId) === String(targetId)
    );
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!targetId) return; /* цель ещё не резолвлена — не пишем пустую подписку */
    setLoading(true);
    try {
      /* Подписка/отписка на сервере; после успешного ответа общий кэш
         подписок инвалидируется и перечитывается — состояние кнопки
         («Вы подписаны») и раздел «Мои подписки» обновляются из одного
         источника истины одновременно. */
      if (isSubscribed) {
        await unsubscribeOnServer(targetType, targetId);
      } else {
        await subscribeOnServer(targetType, targetId);
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
