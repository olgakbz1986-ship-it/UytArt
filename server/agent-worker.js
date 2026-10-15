// Фоновый воркер AI-Агента (имитация автономной работы 24/7)
// В реальном проекте это отдельный процесс, подключенный к Redis/Bull Queue.
// Здесь мы используем setInterval для демонстрации автономности.

console.log("[AGENT WORKER] Запущен фоновый планировщик задач...");

// Эмуляция базы активных задач (в реальности берется из БД)
let activeMonitors = [
  { id: 'task-1', userId: 'user-123', productName: 'Диван угловой', targetPrice: 40000, currentPrice: 45000 }
];

// Запускаем проверку каждые 10 секунд (для демо; в продакшене - каждые 6 часов)
const CHECK_INTERVAL_MS = 10000;

setInterval(() => {
  console.log(`[AGENT WORKER] Выполняю фоновую проверку ${new Date().toLocaleTimeString()}...`);
  
  activeMonitors.forEach(task => {
    // Эмуляция изменения цены на сервере
    const simulatedPriceDrop = Math.random() > 0.7; // 30% шанс падения цены
    
    if (simulatedPriceDrop) {
      const newPrice = task.targetPrice - 3000;
      console.log(`✅ [AGENT WORKER] АЛЕРТ: Цена на "${task.productName}" упала до ${newPrice}₽!`);
      console.log(`   -> Отправка push-уведомления пользователю ${task.userId}...`);
      console.log(`   -> Задача ${task.id} помечена как выполненная.`);
      
      // Удаляем из активных после срабатывания
      activeMonitors = activeMonitors.filter(t => t.id !== task.id);
    } else {
      console.log(`   -> Цена на "${task.productName}" стабильна (${task.currentPrice}₽).`);
    }
  });

  if (activeMonitors.length === 0) {
    console.log("[AGENT WORKER] Активных задач мониторинга нет. Ожидание новых...");
  }
}, CHECK_INTERVAL_MS);

console.log(`[AGENT WORKER] Следующая проверка через ${CHECK_INTERVAL_MS / 1000} секунд.`);
