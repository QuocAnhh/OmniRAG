import { apiClient } from './client';
import type { User } from '../types/api';

export interface UserProfileUpdate {
  full_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

export interface APIKey {
  id: string;
  name: string;
  description?: string;
  key?: string; // Only returned on creation
  key_prefix: string;
  created_at: string;
  last_used_at?: string;
  is_active: boolean;
}

export interface APIKeyCreate {
  name: string;
  description?: string;
}

export const usersApi = {
  getCurrentUser: () => 
    apiClient.get<User>('/api/v1/users/me'),
  
  updateProfile: (data: UserProfileUpdate) => 
    apiClient.put<User>('/api/v1/users/me', data),
  
  listAPIKeys: () => 
    apiClient.get<APIKey[]>('/api/v1/users/me/api-keys'),
  
  createAPIKey: (data: APIKeyCreate) => 
    apiClient.post<APIKey>('/api/v1/users/me/api-keys', data),
  
  revokeAPIKey: (keyId: string) => 
    apiClient.delete(`/api/v1/users/me/api-keys/${keyId}`),
  
  toggleAPIKey: (keyId: string) => 
    apiClient.patch(`/api/v1/users/me/api-keys/${keyId}/toggle`),
};
