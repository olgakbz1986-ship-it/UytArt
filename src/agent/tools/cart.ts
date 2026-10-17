// Инструмент управления корзиной с проверкой региона
import { Product } from './search';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function addToCart(items: CartItem[], userRegion: string): { success: boolean; message: string; total: number } {
  // Эмуляция проверки: в реальном проекте здесь будет запрос к БД
  const allowedRegions: Record<string, string[]> = {
    '1': ['Курск', 'Kursk'], // Дверь межкомнатная
    '2': ['all_russia'],     // Смартфон
    '3': ['Курск', 'Kursk', 'Воронеж'], // Диван
  };

  let total = 0;
  const validItems: CartItem[] = [];

  for (const item of items) {
    const regions = allowedRegions[item.productId] || [];
    const isAllowed = regions.includes(userRegion) || regions.includes('all_russia');
    
    if (!isAllowed) {
      return { 
        success: false, 
        message: `Товар "${item.name}" недоступен для доставки в регион ${userRegion}.`, 
        total: 0 
      };
    }
    validItems.push(item);
    total += item.price * item.quantity;
  }

  // Эмуляция сохранения в корзину (в Phase 3 подключим к реальному store)
  console.log(`[AGENT CART] Added ${validItems.length} items for region ${userRegion}. Total: ${total}₽`);
  
  return { 
    success: true, 
    message: `Успешно добавлено ${validItems.length} товаров в корзину. Общая сумма: ${total}₽. Перейдите к оформлению для оплаты.`, 
    total 
  };
}
