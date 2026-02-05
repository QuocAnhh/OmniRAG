import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/api';
import { STORAGE_KEYS } from '../utils/constants';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (token, user) => {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
        set({ token, user, isAuthenticated: true });
      },
      
      logout: () => {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        set({ token: null, user: null, isAuthenticated: false });
        window.location.href = '/auth';
      },
      
      setUser: (user) => set({ user }),
      
      // Initialize auth state from localStorage on app load
      initializeAuth: () => {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const userStr = localStorage.getItem(STORAGE_KEYS.USER);
        if (token) {
          const user = userStr ? JSON.parse(userStr) : null;
          set({ token, user, isAuthenticated: true });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
