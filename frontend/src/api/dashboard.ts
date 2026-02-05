import { apiClient } from './client';

export interface DashboardStats {
  total_bots: number;
  active_sessions: number;
  messages_today: number;
  avg_response_time: string;
}

export interface QuickStats {
  total_documents: number;
  active_bots: number;
  processing_documents: number;
}

export interface Activity {
  id: string;
  bot_name: string;
  message: string;
  timestamp: string;
  type: string;
}

export const dashboardApi = {
  getStats: () => 
    apiClient.get<DashboardStats>('/api/v1/dashboard/stats'),
  
  getQuickStats: () => 
    apiClient.get<QuickStats>('/api/v1/dashboard/quick-stats'),
  
  getActivity: () => 
    apiClient.get<Activity[]>('/api/v1/dashboard/activity'),
};
