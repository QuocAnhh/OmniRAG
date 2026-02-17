import { apiClient } from './client';
import type { Document } from '../types/api';

export type { Document }; // Re-export for convenience

export const documentsApi = {
  list: async (botId: string): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>(
      `/api/v1/bots/${botId}/documents`
    );
    return response.data;
  },

  upload: async (
    botId: string,
    file: File,
    chunkingStrategy: 'recursive' | 'semantic' = 'recursive'
  ): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chunking_strategy', chunkingStrategy);

    const response = await apiClient.post<Document>(
      `/api/v1/bots/${botId}/documents`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },

  delete: async (botId: string, docId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/bots/${botId}/documents/${docId}`);
  },

  update: async (
    botId: string,
    docId: string,
    data: { folder_id?: string | null; tags?: string[] }
  ): Promise<Document> => {
    const response = await apiClient.put<Document>(
      `/api/v1/bots/${botId}/documents/${docId}`,
      data
    );
    return response.data;
  },
  getPreviewUrl: async (botId: string, docId: string): Promise<{ url: string; filename: string; content_type: string }> => {
    const response = await apiClient.get<{ url: string; filename: string; content_type: string }>(
      `/api/v1/bots/${botId}/documents/${docId}/preview`
    );
    return response.data;
  },
};
