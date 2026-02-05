import { apiClient } from './client';

export interface AnalyticsStats {
  total_messages: number;
  avg_response_time: string;
  active_users: number;
  avg_csat_score: number;
}

export interface Conversation {
  id: string;
  bot_id: string;
  bot_name: string;
  session_id: string;
  user_message: string;
  response: string;
  timestamp: string;
  response_time?: number;
  satisfaction_score?: number;
}

export interface MessageOverTime {
  date: string;
  count: number;
}

export interface BotUsage {
  bot_id: string;
  bot_name: string;
  is_active: boolean;
  message_count: number;
  avg_response_time: number;
  unique_sessions: number;
}

export const analyticsApi = {
  getStats: () => 
    apiClient.get<AnalyticsStats>('/api/v1/analytics/stats'),
  
  getConversations: (limit: number = 10) => 
    apiClient.get<Conversation[]>('/api/v1/analytics/conversations', {
      params: { limit }
    }),
  
  getMessagesOverTime: (period: string = '30d') => 
    apiClient.get<MessageOverTime[]>('/api/v1/analytics/messages-over-time', {
      params: { period }
    }),
  
  getBotUsage: () => 
    apiClient.get<BotUsage[]>('/api/v1/analytics/bot-usage'),
};
