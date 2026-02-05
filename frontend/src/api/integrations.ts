import { apiClient } from './client';

export type IntegrationType = 'telegram' | 'slack' | 'whatsapp' | 'zalo' | 'website' | 'api';
export type IntegrationStatus = 'active' | 'inactive' | 'error';

export interface Integration {
  id: string;
  bot_id: string;
  bot_name: string;
  type: IntegrationType;
  name: string;
  config: Record<string, any>;
  status: IntegrationStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCreate {
  bot_id: string;
  type: IntegrationType;
  config: Record<string, any>;
  name?: string;
}

export interface IntegrationUpdate {
  config?: Record<string, any>;
  is_active?: boolean;
  name?: string;
}

export const integrationsApi = {
  list: (botId?: string) => 
    apiClient.get<Integration[]>('/api/v1/integrations', {
      params: botId ? { bot_id: botId } : {}
    }),
  
  get: (integrationId: string) => 
    apiClient.get<Integration>(`/api/v1/integrations/${integrationId}`),
  
  create: (data: IntegrationCreate) => 
    apiClient.post<Integration>('/api/v1/integrations', data),
  
  update: (integrationId: string, data: IntegrationUpdate) => 
    apiClient.put(`/api/v1/integrations/${integrationId}`, data),
  
  delete: (integrationId: string) => 
    apiClient.delete(`/api/v1/integrations/${integrationId}`),
  
  test: (integrationId: string) => 
    apiClient.post(`/api/v1/integrations/${integrationId}/test`),
};
