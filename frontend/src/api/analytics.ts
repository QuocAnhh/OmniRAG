import apiClient from './client';

export interface AnalyticsStats {
  total_messages: number;
  avg_response_time: string;
  active_users: number;
  avg_csat_score: number;
}

export interface ConversationItem {
  id: string;
  bot_id: string;
  bot_name: string;
  session_id: string;
  user_message: string;
  response: string;
  timestamp: string;
  response_time: number;
  satisfaction_score?: number;
}

export interface MessageVolume {
  date: string;
  count: number;
}

export interface TopQuery {
  query: string;
  count: number;
}

export interface ResponseTimeDistribution {
  range: string;
  count: number;
}

export const analyticsApi = {
  getStats: async (): Promise<AnalyticsStats> => {
    const response = await apiClient.get<AnalyticsStats>('/api/v1/analytics/stats');
    return response.data;
  },

  getConversations: async (limit: number = 10): Promise<ConversationItem[]> => {
    const response = await apiClient.get<ConversationItem[]>(`/api/v1/analytics/conversations?limit=${limit}`);
    return response.data;
  },

  getMessagesOverTime: async (period: string = '24h'): Promise<MessageVolume[]> => {
    const response = await apiClient.get<MessageVolume[]>(`/api/v1/analytics/messages-over-time?period=${period}`);
    return response.data;
  },

  getTopQueries: async (limit: number = 5): Promise<TopQuery[]> => {
    const response = await apiClient.get<TopQuery[]>(`/api/v1/analytics/top-queries?limit=${limit}`);
    return response.data;
  },

  getResponseTimeDistribution: async (): Promise<ResponseTimeDistribution[]> => {
    const response = await apiClient.get<ResponseTimeDistribution[]>('/api/v1/analytics/response-time-distribution');
    return response.data;
  }
};
