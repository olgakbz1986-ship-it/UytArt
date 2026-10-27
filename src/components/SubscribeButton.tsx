/* ============================================================
   Кнопка подписки (ЗАДАЧА завершения, п.1): полностью на TanStack
   Query — состояние читается из кэша /api/subscriptions, запись
   идёт через useMutation (POST /api/subscriptions / DELETE), кэш
   обновляется автоматически, при ошибке показывается понятное
   сообщение: продавец не найден / лимит исчерпан / сеть недоступна
   / сервер ошибся (п.22 ЗАДАЧИ 4).
   ============================================================ */
import { useState } from 'react';
import { marketProducts } from '../lib/market';
import { canonicalSellerId } from '../lib/userFeed';
import { useSubscriptions } from '../hooks/useSubscriptions';
import {
  useSubscribeMutation,
  useUnsubscribeMutation,
  subscriptionErrorMessage,
} from '../hooks/useSubscriptionMutations';
import { useToast } from './a11y';

interface SubscribeButtonProps {
  targetType: string;
  targetId: string;
  variant?: 'default' | 'small';
}

export function SubscribeButton({ targetType, targetId, variant = 'default' }: SubscribeButtonProps) {
  /* Единый серверный источник истины: список подписок из TanStack Query
     (кэш автоматически инвалидируется мутациями subscribe/unsubscribe). */
  const { data: subs = [], isLoading } = useSubscriptions({ limit: 100 });
  const isSubscribed =
    !!targetId &&
    subs.some((s) => s.target_type === targetType && String(s.target_id) === String(targetId));

  const subscribe = useSubscribeMutation();
  const unsubscribe = useUnsubscribeMutation();
  const pending = subscribe.isPending || unsubscribe.isPending;
  const { toast } = useToast();

  /* ИСПРАВЛЕНИЕ (сохранено из прежней реализации): канонизация цели.
     Если цель — демо-вендор seed-каталога (id вида "vendor-*"), находим
     реального владельца витрины по товару этого вендора; иначе кабинет
     «Мои подписки» не смог бы резолвить магазин. */
  const resolveTargetId = (): string => {
    if (targetType === 'shop' && /^vendor-/.test(String(targetId))) {
      const own = marketProducts().find((x: any) => String(x.vendorId || '') === String(targetId));
      const real = own ? canonicalSellerId(own as any) : '';
      return real || String(targetId);
    }
    return String(targetId);
  };

  const handleToggle = () => {
    if (!targetId) return; /* цель ещё не резолвлена — не пишем пустую подписку */
    const id = resolveTargetId();
    if (isSubscribed) {
      unsubscribe.mutate(
        { targetType, targetId: id },
        {
          onSuccess: () => toast('success', 'Вы отписаны'),
          onError: (e) => toast('error', subscriptionErrorMessage(e)),
        }
      );
    } else {
      subscribe.mutate(
        { targetType, targetId: id },
        {
          onSuccess: (d: any) => {
            /* «Уже подписаны» (дубликат через уникальный индекс) — инфо */
            if (d && typeof d.message === 'string' && d.message) toast('info', d.message);
            else toast('success', 'Вы подписаны на обновления');
          },
          onError: (e) => toast('error', subscriptionErrorMessage(e)),
        }
      );
    }
  };

  const sizeClass = variant === 'small' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm';
  /* Тач-цель минимум 44x44 (доступность, п.21) */
  const minTouch = 'min-h-[44px] min-w-[44px]';

  return (
    <button
        onClick={handleToggle}
        disabled={pending || isLoading}
        aria-pressed={isSubscribed}
        aria-label={isSubscribed ? 'Отписаться от продавца' : 'Подписаться на продавца'}
        className={`inline-flex items-center justify-center rounded-lg font-medium transition-all ${sizeClass} ${minTouch} ${
          isSubscribed
            ? 'bg-accent-deep text-white hover:bg-accent-deep/90'
            : 'bg-surface border border-line text-ink hover:border-accent-deep hover:text-accent-deep'
        } ${pending || isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isLoading ? '…' : isSubscribed ? <span>Вы подписаны</span> : <span>Подписаться</span>}
      </button>
  );
}
