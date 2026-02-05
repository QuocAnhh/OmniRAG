import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';

// Lazy load all route components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BotsPage = lazy(() => import('./pages/BotsPage'));
const BotFormPage = lazy(() => import('./pages/BotFormPage'));
const BotConfigPage = lazy(() => import('./pages/BotConfigPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DataGridPage = lazy(() => import('./pages/DataGridPage'));

// Premium loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-ray-bg flex items-center justify-center relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] size-[500px] bg-ray-blue/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] size-[500px] bg-ray-primary/5 blur-[120px] rounded-full"></div>

      <div className="text-center relative z-10">
        <div className="size-24 mx-auto mb-8 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-ray-blue/20 animate-ray-slide-up">
          <img src="/logo.png" alt="Loading OmniRAG" className="w-full h-full object-cover" />
        </div>
        <div className="flex justify-center gap-2 mb-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="size-2 bg-ray-blue rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            ></div>
          ))}
        </div>
        <p className="text-ray-muted font-bold tracking-[0.2em] uppercase text-[10px]">Synchronizing Neural Network...</p>
      </div>
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const storageToken = localStorage.getItem('access_token');

  // Check both zustand state and localStorage
  if (!token && !storageToken) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/bots" element={
            <ProtectedRoute>
              <BotsPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/new" element={
            <ProtectedRoute>
              <BotFormPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/:id/edit" element={
            <ProtectedRoute>
              <BotFormPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/:id/config" element={
            <ProtectedRoute>
              <BotConfigPage />
            </ProtectedRoute>
          } />
          <Route path="/documents" element={
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          } />
          <Route path="/integrations" element={
            <ProtectedRoute>
              <IntegrationsPage />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          } />
          <Route path="/data-grid" element={
            <ProtectedRoute>
              <DataGridPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
