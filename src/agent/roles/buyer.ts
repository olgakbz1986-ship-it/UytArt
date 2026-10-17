import { AgentMessage } from '../types';
import { searchProducts } from '../tools/search';

export async function handleBuyerMessage(message: string, userRegion: string): Promise<AgentMessage> {
  if (message.toLowerCase().includes('дверь') || message.toLowerCase().includes('найти')) {
    const products = searchProducts('дверь', userRegion);
    if (products.length > 0) {
      const list = products.map(p => `${p.name} (${p.price}₽)`).join(', ');
      return {
        id: crypto.randomUUID(),
        role: 'agent',
        content: `Я нашел для вас в регионе ${userRegion}: ${list}.`,
        timestamp: Date.now(),
      };
    } else {
      return {
        id: crypto.randomUUID(),
        role: 'agent',
        content: `К сожалению, в регионе ${userRegion} подходящих дверей с доставкой не найдено.`,
        timestamp: Date.now(),
      };
    }
  }
  
  return {
    id: crypto.randomUUID(),
    role: 'agent',
    content: 'Я ваш помощник покупателя. Спросите меня: "Найди мне двери в [ваш город]".',
    timestamp: Date.now(),
  };
}
