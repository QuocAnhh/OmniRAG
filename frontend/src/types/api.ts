export type ChunkingStrategy = 'recursive' | 'semantic' | 'sentence' | 'article' | 'parent_child';

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
    model?: string; // Add alias/alternative if needed
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
    welcome_message?: string;
    fallback_message?: string;
    top_k?: number;
    similarity_threshold?: number;
    // Domain-aware RAG fields
    domain?: 'general' | 'education' | 'legal' | 'sales';
    chunking_strategy?: ChunkingStrategy;
    chunk_size?: number;
    chunk_overlap?: number;
    enable_knowledge_graph?: boolean;
    enrich_picture_description?: boolean;
    zalo_personal?: Record<string, any> | null;
    zalo_integration?: any;
    zalo_bot?: Record<string, any> | null;
    facebook?: Record<string, any> | null;
    [key: string]: any;
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
  folder_id?: string | null;
  tags?: string[];
  doc_metadata?: {
    num_chunks?: number;
    chunking_strategy?: ChunkingStrategy;
    enable_knowledge_graph?: boolean;
    kg_status?: 'processing' | 'completed' | 'failed';
  };
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  message_id?: string;
  sources?: any[];
  retrieved_chunks?: any[];
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  session_id?: string;
}

export interface RetrievedChunk {
  text: string;
  source: string;
  score?: number;
  hybrid_score?: number;
  metadata?: Record<string, any>;
  highlights?: string[];
}

export interface AgentLog {
  step: string;
  description: string;
  status: string;
  timestamp: string;
}

export interface ChatResponse {
  response: string;
  sources: string[];
  retrieved_chunks?: RetrievedChunk[];
  agent_logs?: AgentLog[];
  reasoning?: string;
  message_id: string;
  search_query?: string;
  session_id?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  response_time?: number;
  from_cache?: boolean;
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

export interface ChannelAccount {
  id: string;
  bot_id: string;
  tenant_id: string;
  channel_type: 'zalo_personal' | 'facebook_messenger';
  display_name?: string;
  channel_uid?: string;
  avatar_url?: string;
  status: string;
  reply_policy: 'mention_only' | 'all';
  thread_whitelist?: string[];
  connected_at?: string;
  last_event_at?: string;
  last_error?: string;
  error_count: number;
  is_active: boolean;
  rate_limit?: {
    daily_count: number;
    daily_limit: number;
  };
  circuit_breaker?: {
    disconnect_tripped: boolean;
    backend_down: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ChannelAccountAccess {
  id: string;
  account_id: string;
  user_id: string;
  permission: 'read' | 'chat' | 'admin';
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
