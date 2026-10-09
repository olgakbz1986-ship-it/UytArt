// Движок автономных переговоров между агентами
import { CONSTITUTION } from '../core/constitution';

export interface NegotiationRequest {
  productId: string;
  productName: string;
  currentPrice: number;
  requestedDiscountPercent: number;
  sellerMaxDiscountPercent: number;
}

export interface NegotiationResult {
  success: boolean;
  finalDiscountPercent: number;
  finalPrice: number;
  message: string;
}

export function negotiatePrice(request: NegotiationRequest): NegotiationResult {
  console.log(`[NEGOTIATION] Покупатель просит скидку ${request.requestedDiscountPercent}% на "${request.productName}"`);
  
  // 1. Проверка Конституции: не превышаем глобальный лимит
  if (request.requestedDiscountPercent > CONSTITUTION.limits.maxDiscountNegotiation) {
    return {
      success: false,
      finalDiscountPercent: 0,
      finalPrice: request.currentPrice,
      message: `К сожалению, запрошенная скидка (${request.requestedDiscountPercent}%) превышает максимально допустимую Конституцией (${CONSTITUTION.limits.maxDiscountNegotiation}%).`
    };
  }

  // 2. Проверка лимита конкретного продавца (Контр-предложение)
  if (request.requestedDiscountPercent > request.sellerMaxDiscountPercent) {
    const counterDiscount = request.sellerMaxDiscountPercent;
    const counterPrice = request.currentPrice * (1 - counterDiscount / 100);
    return {
      success: true,
      finalDiscountPercent: counterDiscount,
      finalPrice: Math.round(counterPrice),
      message: `Продавец не может дать ${request.requestedDiscountPercent}%, но сделал для вас исключение: скидка ${counterDiscount}% (цена ${Math.round(counterPrice)}₽) при оплате в течение часа!`
    };
  }

  // 3. Полное одобрение
  const finalPrice = request.currentPrice * (1 - request.requestedDiscountPercent / 100);
  return {
    success: true,
    finalDiscountPercent: request.requestedDiscountPercent,
    finalPrice: Math.round(finalPrice),
    message: `Отличные новости! Продавец одобрил вашу скидку ${request.requestedDiscountPercent}%. Итоговая цена: ${Math.round(finalPrice)}₽. Добавьте товар в корзину для оформления.`
  };
}
