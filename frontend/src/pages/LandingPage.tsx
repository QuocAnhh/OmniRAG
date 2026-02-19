import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);
  const { token } = useAuthStore();
  const isLoggedIn = !!(token || localStorage.getItem('access_token'));

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/20 selection:text-primary-900">

      {/* Navbar */}
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl overflow-hidden border border-border bg-card flex items-center justify-center shadow-lg shadow-primary/10">
              <img src="/logo.png" alt="OmniRAG Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-black tracking-tighter text-foreground bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">OmniRAG</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors" href="#features">Features</a>
            <a className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors" href="#solutions">Solutions</a>
            <a className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors" href="#pricing">Pricing</a>
            <Link to="/docs/zalo-bot" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Docs</Link>
          </nav>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
                <Link to="/auth" className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden">
          {/* Background Decor */}
          <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-accent/20 rounded-full blur-[120px] opacity-60 mix-blend-multiply animate-float" style={{ animationDuration: '8s' }}></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] opacity-60 mix-blend-multiply animate-float" style={{ animationDuration: '10s', animationDelay: '1s' }}></div>
          </div>

          <div className="mx-auto max-w-7xl px-6 lg:px-8 relative">
            <div className={`mx-auto max-w-4xl text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent-700 border border-accent/20 mb-8 cursor-default hover:bg-accent/20 transition-colors">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
                </span>
                Intelligence Reimagined
              </div>

              <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl lg:text-8xl mb-8">
                Cultivate your <br className="hidden sm:block" />
                <span className="text-primary italic">Organization's Wisdom</span>
              </h1>

              <p className="mt-6 text-xl leading-relaxed text-muted-foreground max-w-2xl mx-auto">
                OmniRAG transforms your scattered documents into an intelligent, queryable knowledge base. Gentle on your workflow, powerful for your business.
              </p>

              <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                {isLoggedIn ? (
                  <Link
                    to="/dashboard"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 hover:scale-105 transition-all duration-300"
                  >
                    <span className="material-symbols-outlined text-[22px]">grid_view</span>
                    Go to Dashboard
                  </Link>
                ) : (
                  <Link to="/auth" className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 hover:scale-105 transition-all duration-300">
                    Start Curator Journey
                  </Link>
                )}
                <button className="w-full sm:w-auto px-8 py-4 bg-card text-foreground border border-border text-lg font-semibold rounded-2xl hover:bg-muted/50 hover:border-primary/20 transition-all duration-300">
                  View Demo
                </button>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="mt-24 relative rounded-3xl bg-muted/20 p-4 lg:p-6 border border-border/50 backdrop-blur-sm -rotate-1 hover:rotate-0 transition-transform duration-700">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-border bg-card">
                {/* Placeholder for dashboard screenshot */}
                <div className="aspect-[16/9] bg-muted/30 flex items-center justify-center text-muted-foreground relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-50"></div>
                  <div className="text-center z-10">
                    <span className="material-symbols-outlined text-6xl text-primary/20 mb-4 group-hover:scale-110 transition-transform duration-500">grid_view</span>
                    <p className="font-medium">Dashboard Preview</p>
                  </div>
                  {/* Mock UI Elements */}
                  <div className="absolute top-8 left-8 right-8 h-8 bg-background rounded-lg shadow-sm w-3/4 opacity-40"></div>
                  <div className="absolute top-24 left-8 w-64 h-48 bg-background rounded-xl shadow-sm opacity-60"></div>
                  <div className="absolute top-24 left-80 right-8 h-64 bg-background rounded-xl shadow-sm opacity-50"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 lg:py-32 bg-muted/30 relative">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-20 max-w-3xl mx-auto">
              <h2 className="text-base font-semibold text-primary uppercase tracking-widest mb-3">Natural Intelligence</h2>
              <h3 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-6">Designed for clarity.</h3>
              <p className="text-lg text-muted-foreground">
                We believe AI tools should feel like a natural extension of your thought process, not a complex machine to operate.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Semantic Understanding',
                  desc: 'Our engine goes beyond keywords to understand the intent and nuance behind every query.',
                  icon: 'psychology'
                },
                {
                  title: 'Source Transparency',
                  desc: 'Every answer is cited. Trace insights back to their original documents with a single click.',
                  icon: 'find_in_page'
                },
                {
                  title: 'Secure by Nature',
                  desc: 'Your data remains yours. Enterprise-grade encryption ensures complete privacy and compliance.',
                  icon: 'encrypted'
                }
              ].map((feature, i) => (
                <div key={i} className="bg-card p-10 rounded-3xl border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
                  <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-3xl">{feature.icon}</span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground mb-3">{feature.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 lg:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 -z-10"></div>
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-8 tracking-tight">
              Ready to bring <span className="text-primary">harmony</span> <br /> to your knowledge?
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Join forward-thinking teams using OmniRAG to cultivate a smarter, calmer, and more efficient workplace.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/auth" className="px-10 py-5 bg-foreground text-background text-lg font-bold rounded-2xl hover:scale-105 transition-transform shadow-xl">
                Get Started Free
              </Link>
              <button className="px-10 py-5 bg-transparent border border-border text-foreground text-lg font-bold rounded-2xl hover:bg-muted transition-all">
                Contact Sales
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 bg-background">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center shadow-md">
              <img src="/logo.png" alt="OmniRAG Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">OmniRAG</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 OmniRAG Systems. Crafted with intention.</p>
        </div>
      </footer>
    </div>
  );
}
