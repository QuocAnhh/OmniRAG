import { apiClient } from './client';
import type { ChatRequest, ChatResponse } from '../types/api';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';

export const chatApi = {
  send: async (botId: string, request: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(
      `/api/v1/bots/${botId}/chat`,
      request
    );
    return response.data;
  },

  stream: async (botId: string, request: ChatRequest, onChunk: (chunk: any) => void) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const response = await fetch(`${API_BASE_URL}/api/v1/bots/${botId}/chat-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error('Streaming request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onChunk(data);
          } catch (e) {
            console.error('Error parsing stream chunk', e);
          }
        }
      }
    }
  },

  sendFeedback: async (botId: string, messageId: string, score: number): Promise<void> => {
    await apiClient.post(`/api/v1/bots/${botId}/chat/${messageId}/feedback`, { score });
  },

  getHistory: async (botId: string, sessionId?: string, limit: number = 20): Promise<any[]> => {
    const url = sessionId
      ? `/api/v1/bots/${botId}/history?session_id=${sessionId}&limit=${limit}`
      : `/api/v1/bots/${botId}/history?limit=${limit}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  getSessions: async (botId: string, limit: number = 50): Promise<any[]> => {
    const response = await apiClient.get(`/api/v1/bots/${botId}/sessions?limit=${limit}`);
    return response.data;
  },

  deleteSession: async (botId: string, sessionId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/bots/${botId}/sessions/${sessionId}`);
  },

  clearHistory: async (botId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/bots/${botId}/history`);
  },
};
