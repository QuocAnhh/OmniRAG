export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  BOTS: '/bots',
  BOT_CONFIG: '/bots/:id/config',
  KNOWLEDGE_BASE: '/knowledge-base',
  CHAT: '/chat/:botId',
  ANALYTICS: '/analytics',
  INTEGRATIONS: '/integrations',
  SUBSCRIPTION: '/subscription',
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
} as const;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER: 'user',
  THEME: 'theme',
} as const;
