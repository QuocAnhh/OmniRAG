import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { STORAGE_KEYS } from '../utils/constants';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { token, isInitialized } = useAuthStore();

  // Wait until auth is initialized before making redirect decisions
  // This prevents the loop: dashboard → 401 → /auth → token still in LS → /dashboard
  if (!isInitialized) {
    return null; // Let the LoadingScreen in App.tsx handle it
  }

  if (token) {
    return <Navigate to="/bots" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Login flow
        const loginData = await authApi.login({
          username: email,
          password,
        });
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, loginData.access_token);
        const user = await authApi.getCurrentUser();
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        login(loginData.access_token, user);
        navigate('/bots');
      } else {
        // Register flow
        await authApi.register({
          email,
          password,
          full_name: fullName,
          tenant_name: tenantName,
        });
        // Auto-login after register
        const loginData = await authApi.login({
          username: email,
          password,
        });
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, loginData.access_token);
        // Get current user after login to ensure we have complete data
        const user = await authApi.getCurrentUser();
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        login(loginData.access_token, user);
        navigate('/bots');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Organic Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-float" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDuration: '10s', animationDelay: '1s' }}></div>

      <div className="w-full max-w-md p-8 m-4 bg-card border border-border/50 rounded-3xl shadow-xl shadow-primary/5 relative z-10">
        <div className="text-center mb-8">
          <div className="size-16 rounded-2xl overflow-hidden border border-border bg-card flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10">
            <img src="/logo.png" alt="OmniRAG Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {isLogin ? 'Welcome back' : 'Join our garden'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isLogin ? 'Enter your credentials to access your workspace' : 'Create an account to verify your intelligence'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {!isLogin && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground" htmlFor="tenantName">Organization</label>
                <input
                  id="tenantName"
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Acme Inc."
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all text-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="font-semibold text-primary hover:text-primary-600 hover:underline transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          <p className="text-xs text-muted-foreground/60">
            Protected by reCAPTCHA and subject to the OmniRAG <a href="#" className="hover:text-primary">Privacy Policy</a> and <a href="#" className="hover:text-primary">Terms of Service</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
