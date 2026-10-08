// Инструмент мониторинга цен и скидок
export interface MonitorTask {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  targetPrice: number;
  currentPrice: number;
  status: 'active' | 'triggered' | 'cancelled';
}

const activeMonitors: MonitorTask[] = [];

export function startPriceMonitor(userId: string, productId: string, productName: string, targetPrice: number, currentPrice: number): string {
  const task: MonitorTask = {
    id: crypto.randomUUID(),
    userId,
    productId,
    productName,
    targetPrice,
    currentPrice,
    status: 'active'
  };
  
  activeMonitors.push(task);
  console.log(`[AGENT MONITOR] Started tracking ${productName} for user ${userId}. Target: ${targetPrice}₽`);
  
  return `Я начал отслеживать цену на "${productName}". Текущая цена: ${currentPrice}₽. Я уведомлю вас, когда она упадет до ${targetPrice}₽ или ниже.`;
}

export function getActiveMonitors(userId: string): MonitorTask[] {
  return activeMonitors.filter(m => m.userId === userId && m.status === 'active');
}
