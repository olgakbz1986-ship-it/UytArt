// Типы для AI-Агента Quantiform

export type AgentRole = 'buyer' | 'seller' | 'admin';

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  emotion?: 'neutral' | 'happy' | 'frustrated' | 'confused' | 'urgent';
}

export interface AgentTask {
  id: string;
  type: 'price_monitor' | 'design_room' | 'cart_fill' | 'analytics';
  status: 'pending' | 'active' | 'completed' | 'failed';
  userId: string;
  params: Record<string, any>;
  createdAt: number;
  completedAt?: number;
}

export interface AgentInsight {
  id: string;
  userId: string;
  type: 'discount_alert' | 'trend_alert' | 'behavior_pattern';
  message: string;
  createdAt: number;
  read: boolean;
}

export interface WeeklyLearningReport {
  period: string;
  newPatternsDiscovered: number;
  userBehaviorChanges: string[];
  marketTrendsIdentified: string[];
  recommendationAccuracyChange: number;
  criticalInsights: string[];
  suggestedServiceImprovements: string[];
}
