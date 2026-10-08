import { AgentRole, AgentMessage } from '../types';

export class AgentOrchestrator {
  private role: AgentRole;

  constructor(role: AgentRole) {
    this.role = role;
  }

  // Основной метод обработки (заглушка для Этапа 1)
  async processMessage(message: string, history: AgentMessage[]): Promise<AgentMessage> {
    return {
      id: crypto.randomUUID(),
      role: 'agent',
      content: `[${this.role.toUpperCase()} AGENT] Инфраструктура готова. Жду подключения LLM и инструментов!`,
      timestamp: Date.now(),
    };
  }
}
