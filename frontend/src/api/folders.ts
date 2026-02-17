import { apiClient } from './client';

export interface Folder {
    id: string;
    name: string;
    bot_id: string;
    parent_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface FolderCreate {
    name: string;
    parent_id?: string | null;
}

export interface FolderUpdate {
    name?: string;
    parent_id?: string | null;
}

export const foldersApi = {
    // List folders for a bot
    async list(botId: string, parentId?: string): Promise<Folder[]> {
        const params = new URLSearchParams({ bot_id: botId });
        if (parentId) params.append('parent_id', parentId);

        const response = await apiClient.get(`/folders/?${params.toString()}`);
        return response.data;
    },

    // Create folder
    async create(botId: string, data: FolderCreate): Promise<Folder> {
        const response = await apiClient.post(`/folders/?bot_id=${botId}`, data);
        return response.data;
    },

    // Update folder
    async update(folderId: string, data: FolderUpdate): Promise<Folder> {
        const response = await apiClient.put(`/folders/${folderId}`, data);
        return response.data;
    },

    // Delete folder
    async delete(folderId: string): Promise<void> {
        await apiClient.delete(`/folders/${folderId}`);
    }
};
