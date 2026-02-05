import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="bg-ray-bg text-ray-text font-sans overflow-x-hidden antialiased selection:bg-ray-primary selection:text-white relative">
      {/* Absolute Mesh Background for Landing */}
      <div className="absolute inset-x-0 top-0 h-[1000px] -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-20%] size-[800px] bg-ray-blue/20 blur-[150px] rounded-full"></div>
        <div className="absolute top-[20%] right-[-20%] size-[800px] bg-ray-primary/10 blur-[150px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-ray-surface/40 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg overflow-hidden border border-white/10 shadow-[0_0_15px_rgba(88,166,255,0.2)]">
              <img src="/logo.png" alt="OmniRAG Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold tracking-tight text-ray-text">OmniRAG</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-[13px] font-semibold text-ray-muted hover:text-ray-text transition-colors" href="#">System</a>
            <a className="text-[13px] font-semibold text-ray-muted hover:text-ray-text transition-colors" href="#">Neural Flow</a>
            <a className="text-[13px] font-semibold text-ray-muted hover:text-ray-text transition-colors" href="#">Docs</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-[13px] font-bold text-ray-muted hover:text-ray-text transition-colors">Login</Link>
            <Link to="/auth" className="px-4 py-1.5 bg-ray-primary hover:bg-ray-primary/90 text-white text-[13px] font-bold rounded-ray-button transition-all shadow-[0_0_15px_rgba(255,99,99,0.2)]">
              Start Building
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-auto">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6">
            <div className={`mx-auto max-w-4xl text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-ray-blue border border-white/5 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ray-blue opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ray-blue"></span>
                </span>
                Intelligence Layer Active
              </div>

              <h1 className="text-5xl font-bold tracking-tight text-ray-text sm:text-7xl lg:text-8xl animate-ray-slide-up">
                Agentic RAG <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-ray-blue to-white opacity-80">Workspace</span>
              </h1>

              <p className="mt-8 text-lg leading-relaxed text-ray-muted max-w-2xl mx-auto animate-ray-slide-up" style={{ animationDelay: '0.1s' }}>
                The command-center for your enterprise AI. Ingest documents, curate knowledge, and deploy specialized agents with Raycast-speed.
              </p>

              <div className="mt-12 flex items-center justify-center gap-4 animate-ray-slide-up" style={{ animationDelay: '0.2s' }}>
                <Link to="/auth" className="px-8 py-4 bg-ray-primary text-white text-base font-bold rounded-ray-button shadow-2xl shadow-ray-primary/20 hover:scale-105 transition-transform">
                  Initial Synchronization
                </Link>
                <button className="px-8 py-4 bg-white/5 border border-white/10 text-ray-text text-base font-bold rounded-ray-button hover:bg-white/10 transition-all backdrop-blur-md">
                  Watch Terminal
                </button>
              </div>
            </div>

            {/* Product Preview Section */}
            <div className="mt-24 relative animate-ray-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="absolute inset-0 bg-ray-blue/10 blur-[100px] -z-10 rounded-full scale-90"></div>
              <div className="ray-card bg-ray-surface/40 backdrop-blur-xl border-white/10 p-2 transform perspective-1000 rotate-x-2">
                <img src="/preview-dashboard.png" alt="OmniRAG Dashboard" className="rounded-ray-card w-full shadow-2xl" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-32 relative">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-20">
              <h2 className="text-[14px] font-bold text-ray-blue uppercase tracking-[0.3em] mb-4">Core Infrastructure</h2>
              <p className="text-3xl md:text-5xl font-bold text-ray-text tracking-tight">Built for Speed. <br />Designed for Intelligence.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-4 ray-card p-10 bg-gradient-to-br from-ray-surface/60 to-transparent border-white/5 group hover:border-ray-blue/30 transition-all">
                <div className="flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-ray-text mb-4">Neural Vector Engine</h3>
                    <p className="text-ray-muted leading-relaxed">Our proprietary RAG engine indexes millions of tokens in seconds. Experience sub-100ms retrieval times across your entire knowledge base.</p>
                    <ul className="mt-6 flex flex-col gap-3">
                      {['Semantic Search', 'Hybrid Retrieval', 'Contextual Re-ranking'].map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-[13px] font-bold text-ray-blue/80">
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="w-full md:w-1/2">
                    <img src="/preview-agents.png" alt="Neural Engine" className="rounded-xl shadow-2xl border border-white/10 group-hover:scale-[1.02] transition-transform" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 ray-card p-10 bg-ray-surface/30 border-white/5 flex flex-col justify-end group hover:border-ray-primary/30 transition-all">
                <div className="size-12 rounded-xl bg-ray-primary/10 flex items-center justify-center mb-6 text-ray-primary">
                  <span className="material-symbols-outlined">security</span>
                </div>
                <h3 className="text-xl font-bold text-ray-text mb-4">Secure by Design</h3>
                <p className="text-[14px] text-ray-muted leading-relaxed">Enterprise-grade encryption for all data at rest and in transit. Private LLM deployment options available.</p>
              </div>

              <div className="md:col-span-3 ray-card p-10 bg-ray-surface/30 border-white/5 group hover:border-white/20 transition-all">
                <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 text-white">
                  <span className="material-symbols-outlined">hub</span>
                </div>
                <h3 className="text-xl font-bold text-ray-text mb-4">Multi-Channel Deployment</h3>
                <p className="text-[14px] text-ray-muted leading-relaxed">Connect your agents to Slack, Discord, WhatsApp, or your custom web portals with a single click.</p>
              </div>

              <div className="md:col-span-3 ray-card p-10 bg-ray-surface/30 border-white/5 group hover:border-white/20 transition-all overflow-hidden relative">
                <div className="absolute top-0 right-0 w-48 h-48 bg-ray-blue/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="size-12 rounded-xl bg-ray-blue/10 flex items-center justify-center mb-6 text-ray-blue">
                  <span className="material-symbols-outlined">analytics</span>
                </div>
                <h3 className="text-xl font-bold text-ray-text mb-4">Intelligence Analytics</h3>
                <p className="text-[14px] text-ray-muted leading-relaxed">Monitor agent performance, identify knowledge gaps, and optimize response accuracy with real-time feedback loops.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Secton */}
        <section className="py-24 bg-white/[0.02] border-y border-white/5 relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-3xl md:text-5xl font-bold text-ray-text mb-8">Works where you do.</h2>
              <p className="text-lg text-ray-muted mb-10 leading-relaxed">OmniRAG integrates seamlessly with your favorite communication channels. Deploy your agents where your customers already are.</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'Web Widget', icon: 'language' },
                  { name: 'Zalo', icon: 'chat' },
                  { name: 'Telegram', icon: 'send' },
                  { name: 'Facebook', icon: 'group' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4 rounded-xl bg-white/5 border border-white/5 text-[15px] font-bold text-ray-text hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-ray-blue">{item.icon}</span>
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative">
                <div className="absolute inset-0 bg-ray-primary/10 blur-[80px] rounded-full"></div>
                <img src="/integration-mesh.png" alt="OmniRAG Integrations" className="rounded-3xl shadow-2xl border border-white/10 relative z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32">
          <div className="mx-auto max-w-5xl px-6">
            <div className="ray-card bg-gradient-to-br from-ray-surface/80 to-ray-surface/40 backdrop-blur-3xl p-16 text-center border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-ray-blue to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <h2 className="text-4xl md:text-6xl font-bold text-ray-text mb-8 tracking-tight">Ready to activate <br />your intelligence?</h2>
              <p className="text-lg text-ray-muted mb-12 max-w-2xl mx-auto">Join the next generation of knowledge management. Scale your support without scaling your headcount.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/auth" className="px-10 py-5 bg-white text-black text-lg font-bold rounded-ray-button hover:scale-105 transition-transform">
                  Deploy First Agent
                </Link>
                <button className="px-10 py-5 bg-white/5 border border-white/10 text-ray-text text-lg font-bold rounded-ray-button hover:bg-white/10 transition-all">
                  Contact Protocol
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
            <div className="size-5 rounded-md bg-ray-primary flex items-center justify-center text-white text-[12px]">
              <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
            </div>
            <span className="text-sm font-bold tracking-tight">OmniRAG SYSTEM v2.0.4</span>
          </div>
          <p className="text-[11px] font-mono text-ray-muted uppercase tracking-[0.3em]">© 2026 DEEPMIND PROTOCOL. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
}
