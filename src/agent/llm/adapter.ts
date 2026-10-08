// Единый адаптер для работы с LLM
import { callYandexGPT, LLMRequest } from './yandex-gpt';
import { AgentRole } from '../types';

export async function generateAgentResponse(role: AgentRole, userMessage: string, context?: string): Promise<string> {
  try {
    const request: LLMRequest = {
      role,
      userMessage,
      context
    };
    
    // Сейчас вызывает заглушку YandexGPT. 
    // В будущем здесь можно добавить роутинг между разными провайдерами (Yandex, GigaChat, etc.)
    return await callYandexGPT(request);
  } catch (error) {
    console.error('[LLM Adapter Error]:', error);
    return "Извините, произошла ошибка при обработке вашего запроса. Попробуйте еще раз.";
  }
}
