import { create } from 'zustand';
import type { User } from '../types/api';
import { STORAGE_KEYS } from '../utils/constants';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;  // NEW: prevents race condition on first render
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,

  login: (token, user) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    set({ token, user, isAuthenticated: true, isInitialized: true });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    // Clear any zustand persist remnants
    localStorage.removeItem('auth-storage');
    set({ token: null, user: null, isAuthenticated: false, isInitialized: true });
    window.location.href = '/auth';
  },

  setUser: (user) => set({ user }),

  // Initialize auth state from localStorage on app load
  initializeAuth: () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (token) {
      const user = userStr ? JSON.parse(userStr) : null;
      set({ token, user, isAuthenticated: true, isInitialized: true });
    } else {
      // No token — mark as initialized so routes can render correctly
      set({ isInitialized: true });
    }
  },
}));
