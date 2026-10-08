import { AgentRole, AgentMessage } from '../types';
import { validateAction } from './constitution';
import { handleBuyerMessage } from '../roles/buyer';
import { handleSellerMessage } from '../roles/seller';
import { handleAdminMessage } from '../roles/admin';

export class AgentOrchestrator {
  private role: AgentRole;
  private userRegion: string;

  constructor(role: AgentRole, userRegion: string = 'Курск') {
    this.role = role;
    this.userRegion = userRegion;
  }

  async processMessage(message: string, history: AgentMessage[]): Promise<AgentMessage> {
    // 1. Проверка конституции (базовая валидация действия)
    if (!validateAction('chat_process')) {
      throw new Error('Constitution violation');
    }

    // 2. Маршрутизация по ролям
    switch (this.role) {
      case 'buyer':
        return await handleBuyerMessage(message, this.userRegion);
      case 'seller':
        return await handleSellerMessage(message);
      case 'admin':
        return await handleAdminMessage(message);
      default:
        return {
          id: crypto.randomUUID(),
          role: 'agent',
          content: 'Роль не распознана.',
          timestamp: Date.now(),
        };
    }
  }
}
