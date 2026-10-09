// Планировщик фоновых задач AI-Агента
import { AgentTask } from '../types';

class TaskPlanner {
  private tasks: Map<string, AgentTask> = new Map();

  // Добавить новую фоновую задачу
  addTask(task: AgentTask): void {
    this.tasks.set(task.id, task);
    console.log(`[PLANNER] Задача добавлена: ${task.type} для пользователя ${task.userId}`);
  }

  // Получить все активные задачи
  getActiveTasks(): AgentTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === 'active');
  }

  // Завершить задачу
  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = Date.now();
      console.log(`[PLANNER] Задача ${taskId} завершена.`);
    }
  }

  // Имитация выполнения фоновой проверки (например, мониторинг цен)
  async runBackgroundChecks(): Promise<void> {
    const activeTasks = this.getActiveTasks();
    for (const task of activeTasks) {
      if (task.type === 'price_monitor') {
        // Эмуляция: цена упала!
        const newPrice = task.params.targetPrice - 2000; 
        console.log(`[PLANNER WORKER] Алерт! Цена на "${task.params.productName}" упала до ${newPrice}₽ (цель: ${task.params.targetPrice}₽). Уведомление отправлено пользователю ${task.userId}.`);
        this.completeTask(task.id);
      }
    }
  }
}

export const planner = new TaskPlanner();
