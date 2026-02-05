import { apiClient } from './client';
import type { Tenant } from '../types/api';

export const tenantsApi = {
  getCurrentTenant: () =>
    apiClient.get<Tenant>('/api/v1/tenants/me'),

  updateTenant: (data: Partial<Tenant>) =>
    apiClient.put<Tenant>('/api/v1/tenants/me', data),
};
