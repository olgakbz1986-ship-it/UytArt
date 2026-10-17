import { AgentMessage } from '../types';

export async function handleAdminMessage(message: string): Promise<AgentMessage> {
  if (message.toLowerCase().includes('отчет') || message.toLowerCase().includes('научился')) {
    return {
      id: crypto.randomUUID(),
      role: 'agent',
      content: 'Еженедельный отчет: Обнаружен новый паттерн - пользователи из Курска чаще ищут двери в скандинавском стиле. Рекомендую добавить соответствующий фильтр в каталог.',
      timestamp: Date.now(),
    };
  }
  return {
    id: crypto.randomUUID(),
    role: 'agent',
    content: 'Я аналитический помощник администратора. Спросите меня: "Покажи еженедельный отчет о самообучении".',
    timestamp: Date.now(),
  };
}
