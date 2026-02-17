import apiClient from './client';

export interface RetrievalResult {
    text: string;
    source: string;
    score: number;
    metadata: Record<string, any>;
}

export interface RetrievalResponse {
    results: RetrievalResult[];
    query_embedding?: number[];
    hyde_document?: string;
}

export const retrievalApi = {
    retrieve: async (botId: string, query: string, topK: number = 5): Promise<RetrievalResponse> => {
        const response = await apiClient.post<RetrievalResponse>(`/api/v1/bots/${botId}/retrieve`, {
            query,
            top_k: topK
        });
        return response.data;
    }
};
