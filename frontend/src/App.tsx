import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import { useSecurity } from './hooks/useSecurity';
import { Toaster } from 'react-hot-toast';
import { LogoIcon } from './components/ui/LogoIcon';

// Lazy load all route components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const BotsPage = lazy(() => import('./pages/BotsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BotWizardPage = lazy(() => import('./pages/BotWizardPage'));
const BotConfigPage = lazy(() => import('./pages/BotConfigPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage'));
const ZaloBotGuidePage = lazy(() => import('./pages/Docs/ZaloBotGuidePage'));

// Premium loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen ops-root flex items-center justify-center">
      <div className="text-center">
        <div className="size-20 mx-auto mb-6 rounded-xl overflow-hidden border border-[var(--color-ops-border)] bg-[var(--color-ops-panel)] p-3">
          <LogoIcon className="w-full h-full" />
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="size-2 bg-[var(--color-ops-accent)] rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            ></div>
          ))}
        </div>
        <p className="ops-section-title text-[10px] ops-muted">Loading workspace...</p>
      </div>
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isInitialized } = useAuthStore();

  // Wait until initializeAuth has run — prevents redirect flash on first load
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // Initialize security checks
  // useSecurity(); // F12 and devtools disabled - re-enable if needed

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: {
            iconTheme: {
              primary: 'hsl(var(--primary))',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: 'hsl(var(--destructive))',
              secondary: '#fff',
            },
          },
        }}
      />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/docs/zalo-bot" element={<ZaloBotGuidePage />} />

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
          {/* IMPORTANT: Specific sub-routes MUST come before /bots/:id */}
          <Route path="/bots/new" element={
            <ProtectedRoute>
              <BotWizardPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/:id/edit" element={
            <ProtectedRoute>
              <BotConfigPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/:id/config" element={
            <ProtectedRoute>
              <BotConfigPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/:id/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />
          <Route path="/bots/:id/graph" element={
            <ProtectedRoute>
              <KnowledgeGraphPage />
            </ProtectedRoute>
          } />
          {/* Generic :id — redirect to chat */}
          <Route path="/bots/:id" element={<Navigate to="chat" replace />} />
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
