import { apiClient } from './client';
import type { Bot } from '../types/api';

export const botsApi = {
  list: async (): Promise<Bot[]> => {
    const response = await apiClient.get<Bot[]>('/api/v1/bots/');
    return response.data;
  },

  get: async (id: string): Promise<Bot> => {
    const response = await apiClient.get<Bot>(`/api/v1/bots/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    config?: Record<string, any>;
  }): Promise<Bot> => {
    const response = await apiClient.post<Bot>('/api/v1/bots/', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<Bot>
  ): Promise<Bot> => {
    const response = await apiClient.put<Bot>(`/api/v1/bots/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/bots/${id}`);
  },
};
