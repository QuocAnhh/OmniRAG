import apiClient from './client';

export const dataGridApi = {
  // Postgres
  listUsers: (params?: { limit?: number; offset?: number }) =>
    apiClient.get('/api/v1/data-grid/postgres/users', { params }).then(r => r.data),
  listTenants: (params?: { limit?: number; offset?: number }) =>
    apiClient.get('/api/v1/data-grid/postgres/tenants', { params }).then(r => r.data),
  listBots: (params?: { limit?: number; offset?: number; tenant_id?: string }) =>
    apiClient.get('/api/v1/data-grid/postgres/bots', { params }).then(r => r.data),
  listDocuments: (params?: { limit?: number; offset?: number; bot_id?: string }) =>
    apiClient.get('/api/v1/data-grid/postgres/documents', { params }).then(r => r.data),

  // MongoDB
  mongoCollections: () => apiClient.get('/api/v1/data-grid/mongo/collections').then(r => r.data),

  // Redis
  redisKeys: (params?: { pattern?: string; max_items?: number }) =>
    apiClient.get('/api/v1/data-grid/redis/keys', { params }).then(r => r.data),

  // Qdrant
  qdrantCollections: () => apiClient.get('/api/v1/data-grid/qdrant/collections').then(r => r.data),
};
