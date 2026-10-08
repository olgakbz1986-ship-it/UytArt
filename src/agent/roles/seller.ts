import { AgentMessage } from '../types';

export async function handleSellerMessage(message: string): Promise<AgentMessage> {
  if (message.toLowerCase().includes('аналитик') || message.toLowerCase().includes('продаж')) {
    return {
      id: crypto.randomUUID(),
      role: 'agent',
      content: 'Ваша конверсия за неделю выросла на 5%. Рекомендую добавить больше фото в карточку товара "Дверь межкомнатная".',
      timestamp: Date.now(),
    };
  }
  return {
    id: crypto.randomUUID(),
    role: 'agent',
    content: 'Я ваш помощник продавца. Спросите меня: "Покажи аналитику продаж".',
    timestamp: Date.now(),
  };
}
