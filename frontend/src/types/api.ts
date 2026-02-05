export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'member';
  tenant_id: string;
  is_active: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Bot {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  tenant_id: string;
  is_active?: boolean;
  api_key: string;
  config: {
    llm_model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
    welcome_message?: string;
    fallback_message?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  bot_id: string;
  filename: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_size?: number;
  doc_metadata?: {
    num_chunks?: number;
    chunking_strategy?: string;
  };
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  sources: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
  tenant_settings?: Record<string, any>;
}

export interface DashboardStats {
  total_bots: number;
  active_sessions: number;
  messages_today: number;
  avg_response_time: string;
}

export interface AnalyticsStats {
  total_messages: number;
  avg_response_time: string;
  active_users: number;
  avg_csat_score: number;
}
