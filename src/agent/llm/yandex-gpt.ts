// Провайдер YandexGPT (Заглушка для Phase 3, готова к подключению реального ключа)
import { SYSTEM_PROMPTS } from './prompts';
import { AgentRole } from '../types';

export interface LLMRequest {
  role: AgentRole;
  userMessage: string;
  context?: string; // Например, регион пользователя или история чата
}

export async function callYandexGPT(request: LLMRequest): Promise<string> {
  // TODO: Вставьте сюда реальный API ключ и Folder ID из Yandex Cloud
  // const apiKey = process.env.YANDEX_GPT_API_KEY;
  // const folderId = process.env.YANDEX_GPT_FOLDER_ID;
  
  const systemPrompt = SYSTEM_PROMPTS[request.role];
  
  console.log(`[LLM DEBUG] Запрос к YandexGPT для роли: ${request.role}`);
  console.log(`[LLM DEBUG] Сообщение пользователя: ${request.userMessage}`);
  console.log(`[LLM DEBUG] Системный промпт (первые 100 символов): ${systemPrompt.substring(0, 100)}...`);

  // ЭМУЛЯЦИЯ ОТВЕТА LLM (пока нет реального ключа)
  // В реальном проекте здесь будет fetch к https://llm.api.cloud.yandex.net/foundationModels/v1/completion
  
  await new Promise(resolve => setTimeout(resolve, 500)); // Имитация задержки сети

  if (request.role === 'buyer') {
    if (request.userMessage.toLowerCase().includes('дверь') || request.userMessage.toLowerCase().includes('door')) {
      return `Я проанализировал каталог. Для вашего региона (${request.context || 'не указан'}) найдена "Дверь межкомнатная" за 5000₽. Она доступна к доставке. Хотите, я добавлю её в корзину? Помните, что оплату вам нужно будет подтвердить самостоятельно.`;
    }
    return `Я ваш помощник покупателя. Я учту ваш регион и помогу найти лучшие товары. Что именно вы ищете?`;
  }
  
  if (request.role === 'seller') {
    return `Аналитика за неделю: Конверсия в вашем регионе выросла на 5%. Рекомендация: добавьте 2-3 дополнительных фото в карточку товара "Дверь межкомнатная", это повысит доверие покупателей.`;
  }
  
  if (request.role === 'admin') {
    return `ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ О САМООБУЧЕНИИ:\n1. Новый паттерн: Пользователи из Курска на 40% чаще ищут двери в скандинавском стиле.\n2. Рекомендация: Добавить фильтр "Скандинавский стиль" в каталог дверей.\n3. Метрика: Точность региональных рекомендаций составляет 100%.`;
  }

  return "Извините, я пока не могу обработать этот запрос.";
}
