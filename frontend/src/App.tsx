import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
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

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="size-20 mx-auto mb-6 rounded-lg overflow-hidden border border-[#e8e6dc] bg-[#faf9f5] p-3">
          <LogoIcon className="w-full h-full" />
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="size-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            ></div>
          ))}
        </div>
        <p className="text-xs text-[#87867f] uppercase tracking-wider font-medium">Loading workspace...</p>
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
            background: '#faf9f5',
            color: '#141413',
            border: '1px solid #e8e6dc',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
          },
          success: {
            iconTheme: {
              primary: '#c96442',
              secondary: '#faf9f5',
            },
          },
          error: {
            iconTheme: {
              primary: '#b53333',
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
