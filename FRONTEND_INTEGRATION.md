# Frontend Integration Guide - Kết hợp UI với Backend OmniRAG

Hướng dẫn chi tiết cách kết hợp UI design (Google Stitch hoặc bất kỳ framework nào) với Backend API đã có.

## 📋 Mục lục

- [Kiến trúc Frontend-Backend](#kiến-trúc-frontend-backend)
- [Chọn Frontend Framework](#chọn-frontend-framework)
- [Setup Frontend Project](#setup-frontend-project)
- [API Integration](#api-integration)
- [Authentication Flow](#authentication-flow)
- [Page Structure](#page-structure)
- [Example Implementation](#example-implementation)
- [Deployment](#deployment)

## 🏗 Kiến trúc Frontend-Backend

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser / Mobile App                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Login Page  │  │ Dashboard    │  │  Chat UI     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  React/Vue/Angular + Tailwind/Material UI                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTP/REST API (JWT Token)
                  │ WebSocket (Real-time chat - future)
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Port 8000)                    │
│                                                             │
│  ✅ /api/v1/auth/*     - Authentication                    │
│  ✅ /api/v1/bots/*     - Bot Management                    │
│  ✅ /api/v1/documents/* - Document Upload                  │
│  ✅ /api/v1/chat       - RAG Chat                          │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Chọn Frontend Framework

### Option 1: React (Recommended)
**Ưu điểm**:
- Ecosystem lớn, nhiều libraries
- Component-based, dễ reuse
- React Query cho API calls
- TypeScript support tốt

**Tech Stack**:
```
React 18 + TypeScript + Vite
TailwindCSS (styling)
React Query (API state management)
React Router (routing)
Zustand/Redux (global state)
Axios (HTTP client)
```

### Option 2: Next.js (Full-stack)
**Ưu điểm**:
- SSR/SSG support
- API routes (có thể proxy backend)
- SEO-friendly
- Built-in routing

**Tech Stack**:
```
Next.js 14 + TypeScript
TailwindCSS
SWR (data fetching)
NextAuth (authentication)
```

### Option 3: Vue 3 (Alternative)
**Ưu điểm**:
- Learning curve thấp hơn React
- Composition API rất mạnh
- Vuetify/Quasar cho UI components

**Tech Stack**:
```
Vue 3 + TypeScript + Vite
TailwindCSS / Vuetify
Pinia (state management)
Vue Router
Axios
```

## 🚀 Setup Frontend Project

### Scenario 1: React + Vite + TypeScript

```bash
# Tạo project trong thư mục OmniRAG
cd /home/quocanh/OmniRAG

# Create React app với Vite
npm create vite@latest frontend -- --template react-ts

cd frontend
npm install

# Install dependencies
npm install axios react-query @tanstack/react-query
npm install react-router-dom
npm install zustand
npm install @headlessui/react @heroicons/react
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install dev dependencies
npm install -D @types/node
```

**Project structure**:
```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios instance với JWT
│   │   ├── auth.ts            # Auth API calls
│   │   ├── bots.ts            # Bots API calls
│   │   └── chat.ts            # Chat API calls
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── Bots/
│   │   │   ├── BotCard.tsx
│   │   │   ├── BotList.tsx
│   │   │   └── CreateBotModal.tsx
│   │   └── Chat/
│   │       ├── ChatWindow.tsx
│   │       ├── MessageBubble.tsx
│   │       └── ChatInput.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── BotsPage.tsx
│   │   └── ChatPage.tsx
│   ├── store/
│   │   └── authStore.ts       # Zustand store
│   ├── types/
│   │   └── api.ts             # TypeScript types
│   ├── utils/
│   │   └── constants.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Scenario 2: Next.js

```bash
cd /home/quocanh/OmniRAG

# Create Next.js app
npx create-next-app@latest frontend --typescript --tailwind --app --use-npm

cd frontend
npm install axios swr zustand
npm install @headlessui/react @heroicons/react
```

**Project structure**:
```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── bots/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── chat/
│   │   │   └── [botId]/
│   │   │       └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   │   ├── api.ts
│   │   └── auth.ts
│   └── types/
└── package.json
```

## 🔌 API Integration

### 1. Setup Axios Client với JWT

**`src/api/client.ts`**:
```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. TypeScript Types

**`src/types/api.ts`**:
```typescript
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
  settings: Record<string, any>;
  created_at: string;
}

export interface Bot {
  id: string;
  name: string;
  description?: string;
  tenant_id: string;
  api_key: string;
  config: {
    llm_model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  bot_id: string;
  filename: string;
  file_type: string;
  status: 'processing' | 'completed' | 'failed';
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
```

### 3. API Services

**`src/api/auth.ts`**:
```typescript
import { apiClient } from './client';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  User 
} from '../types/api';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', data.username);
    formData.append('password', data.password);
    
    const response = await apiClient.post<LoginResponse>(
      '/api/v1/auth/login',
      formData,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>(
      '/api/v1/auth/register',
      data
    );
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    return response.data;
  },
};
```

**`src/api/bots.ts`**:
```typescript
import { apiClient } from './client';
import { Bot } from '../types/api';

export const botsApi = {
  list: async (): Promise<Bot[]> => {
    const response = await apiClient.get<Bot[]>('/api/v1/bots');
    return response.data;
  },

  get: async (id: string): Promise<Bot> => {
    const response = await apiClient.get<Bot>(`/api/v1/bots/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    config?: Record<string, any>;
  }): Promise<Bot> => {
    const response = await apiClient.post<Bot>('/api/v1/bots', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<Bot>
  ): Promise<Bot> => {
    const response = await apiClient.put<Bot>(`/api/v1/bots/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/bots/${id}`);
  },
};
```

**`src/api/documents.ts`**:
```typescript
import { apiClient } from './client';
import { Document } from '../types/api';

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
};
```

**`src/api/chat.ts`**:
```typescript
import { apiClient } from './client';
import { ChatRequest, ChatResponse } from '../types/api';

export const chatApi = {
  send: async (botId: string, request: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(
      `/api/v1/bots/${botId}/chat`,
      request
    );
    return response.data;
  },
};
```

## 🔐 Authentication Flow

### Zustand Store

**`src/store/authStore.ts`**:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (token, user) => {
        localStorage.setItem('access_token', token);
        set({ token, user, isAuthenticated: true });
      },
      
      logout: () => {
        localStorage.removeItem('access_token');
        set({ token: null, user: null, isAuthenticated: false });
      },
      
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### Protected Route

**`src/components/ProtectedRoute.tsx`**:
```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
```

### Router Setup

**`src/App.tsx`**:
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BotsPage from './pages/BotsPage';
import ChatPage from './pages/ChatPage';
import Layout from './components/Layout/Layout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/chat/:botId" element={<ChatPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

## 📄 Page Structure

### 1. Login Page

**`src/pages/LoginPage.tsx`**:
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login
      const loginData = await authApi.login({
        username: email,
        password,
      });
      
      // Get user info
      const user = await authApi.getCurrentUser();
      
      // Save to store
      login(loginData.access_token, user);
      
      // Redirect
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to OmniRAG
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div className="text-center">
            <a href="/register" className="text-indigo-600 hover:text-indigo-500">
              Don't have an account? Register
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 2. Bots Page với React Query

**`src/pages/BotsPage.tsx`**:
```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botsApi } from '../api/bots';
import { Bot } from '../types/api';

export default function BotsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch bots
  const { data: bots, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: botsApi.list,
  });

  // Create bot mutation
  const createMutation = useMutation({
    mutationFn: botsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setShowCreateModal(false);
    },
  });

  // Delete bot mutation
  const deleteMutation = useMutation({
    mutationFn: botsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Bots</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Create Bot
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots?.map((bot) => (
          <div
            key={bot.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold mb-2">{bot.name}</h3>
            <p className="text-gray-600 mb-4">{bot.description}</p>
            
            <div className="flex gap-2">
              <a
                href={`/chat/${bot.id}`}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded text-center hover:bg-green-700"
              >
                Chat
              </a>
              <button
                onClick={() => deleteMutation.mutate(bot.id)}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal would go here */}
    </div>
  );
}
```

### 3. Chat Page

**`src/pages/ChatPage.tsx`**:
```typescript
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat';
import { botsApi } from '../api/bots';
import { ChatMessage } from '../types/api';

export default function ChatPage() {
  const { botId } = useParams<{ botId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch bot info
  const { data: bot } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => botsApi.get(botId!),
    enabled: !!botId,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.slice(-10); // Last 10 messages
      return chatApi.send(botId!, { message, history });
    },
    onSuccess: (data, message) => {
      // Add user message
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data.response },
      ]);
      setInput('');
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMutation.mutate(input);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">{bot?.name}</h1>
        <p className="text-gray-600">{bot?.description}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
              Thinking...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="bg-white border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={sendMutation.isPending}
          />
          <button
            type="submit"
            disabled={sendMutation.isPending || !input.trim()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

## 🎨 Áp dụng Google Stitch Design

### Bước 1: Export Design Assets từ Stitch

1. Mở project Stitch của bạn
2. Export các assets:
   - **Images**: Export logos, icons as SVG/PNG
   - **Colors**: Copy color palette
   - **Typography**: Font families và sizes
   - **Spacing**: Margins, paddings values

### Bước 2: Setup Design System trong TailwindCSS

**`tailwind.config.js`**:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Copy colors từ Stitch design
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          // ... các shades khác
          900: '#0c4a6e',
        },
        // Custom colors từ design
        brand: '#YOUR_BRAND_COLOR',
      },
      // Typography
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      // Spacing giống design
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      // Border radius
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
```

### Bước 3: Component Mapping

Ánh xạ các components từ Stitch design sang React components:

| Stitch Component | React Component | File |
|------------------|-----------------|------|
| Login Screen | LoginPage | `pages/LoginPage.tsx` |
| Dashboard | DashboardPage | `pages/DashboardPage.tsx` |
| Bot Card | BotCard | `components/Bots/BotCard.tsx` |
| Chat Window | ChatWindow | `components/Chat/ChatWindow.tsx` |
| Navigation Bar | Header | `components/Layout/Header.tsx` |

### Bước 4: Copy Layout & Styling

Dựa vào Stitch design, tạo các components với styling tương ứng:

**Example - Bot Card theo design**:
```typescript
// src/components/Bots/BotCard.tsx
interface BotCardProps {
  bot: Bot;
  onDelete: (id: string) => void;
}

export function BotCard({ bot, onDelete }: BotCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
      {/* Icon/Avatar section - theo design */}
      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl mb-4 flex items-center justify-center">
        <span className="text-white text-xl font-bold">
          {bot.name.charAt(0)}
        </span>
      </div>
      
      {/* Title - match font size và weight từ design */}
      <h3 className="text-xl font-heading font-semibold text-gray-900 mb-2">
        {bot.name}
      </h3>
      
      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {bot.description}
      </p>
      
      {/* Metadata - nếu có trong design */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <DocumentIcon className="w-4 h-4" />
          {bot.document_count || 0} docs
        </span>
        <span>•</span>
        <span>GPT-4</span>
      </div>
      
      {/* Actions - theo button style trong design */}
      <div className="flex gap-2">
        <a
          href={`/chat/${bot.id}`}
          className="flex-1 bg-primary-600 text-white text-center py-2 rounded-lg hover:bg-primary-700 transition font-medium"
        >
          Chat
        </a>
        <button
          onClick={() => onDelete(bot.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

## 🚀 Run Development

### Backend
```bash
cd /home/quocanh/OmniRAG
docker compose up -d
```

### Frontend
```bash
cd frontend
npm run dev
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 🔧 Environment Variables

**`frontend/.env`**:
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

**`frontend/.env.production`**:
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

## 📱 Responsive Design

Ensure mobile-first approach:

```typescript
// Example responsive chat page
<div className="flex flex-col h-screen">
  {/* Header - collapsible on mobile */}
  <div className="bg-white border-b px-4 md:px-6 py-3 md:py-4">
    <h1 className="text-lg md:text-2xl font-bold">{bot?.name}</h1>
  </div>

  {/* Messages - full height minus header and input */}
  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4">
    {/* Messages */}
  </div>

  {/* Input - sticky bottom */}
  <form className="bg-white border-t p-3 md:p-4">
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        className="flex-1 border rounded-lg px-3 md:px-4 py-2 text-sm md:text-base"
      />
      <button className="bg-primary-600 text-white px-4 md:px-6 py-2 rounded-lg">
        Send
      </button>
    </div>
  </form>
</div>
```

## 🌐 Deployment

### Build Frontend

```bash
cd frontend
npm run build
# Output: dist/
```

### Deployment Options

#### Option 1: Serve từ Backend (FastAPI Static Files)

**`backend/app/main.py`**:
```python
from fastapi.staticfiles import StaticFiles

# Mount frontend build
app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
```

#### Option 2: Separate Deployment

- **Frontend**: Vercel / Netlify / Cloudflare Pages
- **Backend**: Railway / Render / DigitalOcean

#### Option 3: Docker Compose với Nginx

**`docker-compose.yml`** (add):
```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

**`frontend/Dockerfile`**:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🎯 Next Steps

1. **Export design assets từ Stitch** vào `frontend/src/assets/`
2. **Setup Tailwind theo design system** của bạn
3. **Implement từng page** theo workflow:
   - Login → Dashboard → Bots → Chat
4. **Test integration** với backend API
5. **Add advanced features**:
   - File upload UI với progress bar
   - Real-time chat với WebSocket
   - Document viewer
   - Analytics dashboard
6. **Responsive testing** trên mobile/tablet
7. **Production deployment**

## 📚 Useful Resources

- [React Query Docs](https://tanstack.com/query/latest)
- [TailwindCSS](https://tailwindcss.com)
- [Zustand State Management](https://zustand-demo.pmnd.rs)
- [Axios Documentation](https://axios-http.com)
- [FastAPI CORS Setup](https://fastapi.tiangolo.com/tutorial/cors/)

---

**Questions?** Check logs:
```bash
# Frontend console (browser DevTools)
# Backend logs
docker compose logs -f backend
```
