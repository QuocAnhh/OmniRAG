import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { STORAGE_KEYS } from '../utils/constants';
import { LogoIcon } from '../components/ui/LogoIcon';

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

  if (!isInitialized) {
    return null;
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
        await authApi.register({
          email,
          password,
          full_name: fullName,
          tenant_name: tenantName,
        });
        const loginData = await authApi.login({
          username: email,
          password,
        });
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, loginData.access_token);
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
    <div className="min-h-screen flex items-center justify-center bg-warm-parchment relative overflow-hidden">
      {/* Organic Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-float" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-warm-cream/50 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDuration: '10s', animationDelay: '1s' }}></div>

      <div className="w-full max-w-md p-8 m-4 bg-white border border-border-warm/50 rounded-hero shadow-whisper-lg relative z-10">
        <div className="text-center mb-8">
          <div className="size-16 rounded-feature overflow-hidden border border-border-warm bg-white flex items-center justify-center mx-auto mb-4 shadow-whisper">
            <LogoIcon className="w-full h-full" />
          </div>
          <h1 className="text-2xl font-bold font-serif text-text-primary tracking-tight">
            {isLogin ? 'Welcome back' : 'Join our garden'}
          </h1>
          <p className="text-text-tertiary mt-2 text-sm">
            {isLogin ? 'Enter your credentials to access your workspace' : 'Create an account to verify your intelligence'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-feature bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {!isLogin && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-primary" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-feature bg-warm-cream/30 border border-border-warm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-muted/50"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-primary" htmlFor="tenantName">Organization</label>
                <input
                  id="tenantName"
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-feature bg-warm-cream/30 border border-border-warm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-muted/50"
                  placeholder="Acme Inc."
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-feature bg-warm-cream/30 border border-border-warm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-muted/50"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-feature bg-warm-cream/30 border border-border-warm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-muted/50 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
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
            className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-feature hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 shadow-whisper hover:shadow-whisper-lg hover:-translate-y-0.5 transition-all text-sm disabled:opacity-70 disabled:cursor-not-allowed"
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

        <div className="mt-8 pt-6 border-t border-border-warm flex flex-col gap-4 text-center">
          <p className="text-sm text-text-tertiary">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="font-semibold text-primary hover:text-brand-coral hover:underline transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          <p className="text-xs text-text-muted/60">
            Protected by reCAPTCHA and subject to the OmniRAG <a href="#" className="hover:text-primary">Privacy Policy</a> and <a href="#" className="hover:text-primary">Terms of Service</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
