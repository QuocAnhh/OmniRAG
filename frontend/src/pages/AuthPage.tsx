import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { STORAGE_KEYS } from '../utils/constants';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

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
        navigate('/dashboard');
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
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-mesh text-text-main dark:text-white font-body min-h-screen flex flex-col antialiased transition-colors duration-200 relative overflow-hidden">
      {/* Floating background blobs */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-ocean-blue/20 blob-shape opacity-40 blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-coral/20 blob-shape opacity-30 blur-3xl animate-float-slow"></div>

      {/* Top Navigation */}
      <header className="w-full px-6 py-5 absolute top-0 left-0 z-20 flex justify-between items-center glass-effect">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-ocean-blue to-ocean-light flex items-center justify-center text-white shadow-lg shadow-ocean-blue/30">
            <span className="material-symbols-outlined text-[22px]">smart_toy</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-text-main dark:text-white">OmniRAG</h1>
        </div>
        <button className="text-text-muted hover:text-ocean-blue transition-colors hidden sm:block font-medium">
          <span className="text-sm">Need help?</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        {/* Auth Card Container */}
        <div className="w-full max-w-6xl card-elevated min-h-[650px] flex overflow-hidden animate-scale-in">
          {/* Left Side: Visual/Brand (Hidden on Mobile) */}
          <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-ocean-blue via-blue-600 to-indigo-700 relative flex-col justify-between p-12 text-white overflow-hidden">
            {/* Animated background blobs */}
            <div className="absolute top-10 left-10 w-64 h-64 bg-coral/30 rounded-full blur-3xl animate-float"></div>
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-sage/20 rounded-full blur-3xl animate-float-slow"></div>

            <div className="relative z-10">
              <div className="size-16 mb-8 rounded-2xl bg-white/20 glass-effect flex items-center justify-center text-white shadow-xl">
                <span className="material-symbols-outlined text-4xl">auto_awesome</span>
              </div>
              <h2 className="text-4xl font-display font-bold leading-tight mb-5">Orchestrate your enterprise knowledge.</h2>
              <p className="text-blue-100 text-lg font-medium leading-relaxed">
                Connect your data sources and deploy intelligent RAG chatbots in minutes, not months.
              </p>
            </div>

            <div className="relative z-10 mt-auto glass-effect rounded-2xl p-8 border border-white/20 shadow-2xl">
              <div className="flex gap-1 text-sand mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-xl" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                ))}
              </div>
              <p className="italic text-white/95 mb-5 text-base leading-relaxed">
                "OmniRAG has completely transformed how our support team accesses technical documentation. It's fast, secure, and incredibly accurate."
              </p>
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-gradient-to-br from-coral to-orange-500 flex items-center justify-center text-white font-display font-bold text-lg shadow-lg">SC</div>
                <div>
                  <p className="font-bold text-white">Sarah Chen</p>
                  <p className="text-sm text-blue-100">CTO, TechFlow Inc.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-center bg-surface-light dark:bg-surface-dark relative">
            <div className="max-w-md mx-auto w-full space-y-8">
              {/* Form Header */}
              <div className="text-center lg:text-left animate-slide-up">
                <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-main dark:text-white mb-3">
                  {isLogin ? 'Welcome back' : 'Join OmniRAG'}
                </h2>
                <p className="text-text-muted dark:text-gray-400 text-base">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError('');
                    }}
                    className="text-ocean-blue hover:text-ocean-light font-semibold transition-colors"
                  >
                    {isLogin ? 'Sign up →' : 'Log in →'}
                  </button>
                </p>
              </div>

              {/* Social Auth */}
              <div className="flex flex-col gap-3 animate-slide-up stagger-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-border-light dark:border-border-dark glass-effect px-5 py-3.5 text-text-main dark:text-white hover:border-ocean-blue hover:bg-ocean-blue/5 transition-all font-semibold"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="relative flex items-center justify-center animate-slide-up stagger-2">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-border-light to-transparent dark:via-border-dark" />
                <span className="absolute glass-effect px-4 py-1 text-xs uppercase text-text-muted dark:text-gray-500 font-bold tracking-wider rounded-full border border-border-light/50 dark:border-border-dark/50">
                  Or {isLogin ? 'login' : 'sign up'} with email
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up stagger-3">
                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border-2 border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  </div>
                )}

                {!isLogin && (
                  <>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-text-main dark:text-gray-200" htmlFor="fullName">
                        Full Name
                      </label>
                      <input
                        className="w-full rounded-lg border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark px-4 py-3 text-text-main dark:text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                        id="fullName"
                        name="fullName"
                        placeholder="John Doe"
                        required
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-text-main dark:text-gray-200" htmlFor="tenantName">
                        Company Name
                      </label>
                      <input
                        className="w-full rounded-lg border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark px-4 py-3 text-text-main dark:text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                        id="tenantName"
                        name="tenantName"
                        placeholder="Acme Inc."
                        required
                        type="text"
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-main dark:text-gray-200" htmlFor="email">
                    Work Email
                  </label>
                  <input
                    className="w-full rounded-xl border-2 border-border-light dark:border-border-dark bg-background-off dark:bg-background-dark px-4 py-3.5 text-text-main dark:text-white placeholder-text-muted focus:border-ocean-blue focus:ring-2 focus:ring-ocean-blue/20 transition-all outline-none"
                    id="email"
                    name="email"
                    placeholder="name@company.com"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-main dark:text-gray-200" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark px-4 py-3 pr-10 text-text-main dark:text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
                      id="password"
                      name="password"
                      placeholder="Min. 8 characters"
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-main dark:hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        id="rememberMe"
                        type="checkbox"
                        className="rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
                      />
                      <span className="text-text-muted dark:text-gray-300">Remember me</span>
                    </label>
                    <a href="#" className="text-primary hover:text-primary/90 font-medium">
                      Forgot password?
                    </a>
                  </div>
                )}

                {!isLogin && (
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="terms"
                      required
                      className="mt-1 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
                    />
                    <label htmlFor="terms" className="text-sm text-text-muted dark:text-gray-400">
                      I agree to the{' '}
                      <a href="#" className="text-primary hover:text-primary/90 font-medium">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="#" className="text-primary hover:text-primary/90 font-medium">
                        Privacy Policy
                      </a>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-ocean w-full h-12 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                    </div>
                  ) : (
                    <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                  )}
                </button>

                {!isLogin && (
                  <div className="flex items-center justify-center gap-2.5 text-sm text-text-muted dark:text-gray-400">
                    <span className="material-symbols-outlined text-base text-sage">verified_user</span>
                    <span className="font-medium">256-bit SSL encryption</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
