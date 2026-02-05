import { apiClient } from './client';
import type { ChatRequest, ChatResponse } from '../types/api';

export const chatApi = {
  send: async (botId: string, request: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(
      `/api/v1/bots/${botId}/chat`,
      request
    );
    return response.data;
  },
};
