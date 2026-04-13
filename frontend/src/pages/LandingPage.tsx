import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { motion } from 'framer-motion';
import { BrainCircuit, Shield, Zap, ChevronRight, Menu, X, Database, LineChart, Code2, ArrowRight, Fingerprint, Network } from 'lucide-react';
import { LogoIcon } from '../components/ui/LogoIcon';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { token } = useAuthStore();
  const isLoggedIn = !!(token || localStorage.getItem('access_token'));

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }
  };

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const features = [
    {
      icon: <BrainCircuit className="w-5 h-5" />,
      title: "Semantic retrieval",
      description: "Goes beyond keyword matching. The retrieval engine understands intent, context, and meaning — returning what's relevant, not just what matches.",
      accent: "text-primary/80",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Sub-second indexing",
      description: "Documents are chunked, embedded, and searchable within seconds of upload. No batch jobs, no waiting.",
      accent: "text-amber-600",
    },
    {
      icon: <Fingerprint className="w-5 h-5" />,
      title: "Access controls",
      description: "Per-bot permissions, JWT-secured endpoints, and isolated knowledge bases keep your data where it belongs.",
      accent: "text-emerald-600",
    },
    {
      icon: <Network className="w-5 h-5" />,
      title: "Knowledge graph",
      description: "Entity and relationship extraction surfaces connections that vector search misses. Built on LightRAG — runs locally.",
      accent: "text-violet-600",
    },
    {
      icon: <LineChart className="w-5 h-5" />,
      title: "Usage analytics",
      description: "See which questions get answered, which fall through, and where your knowledge base has gaps.",
      accent: "text-rose-600",
    },
    {
      icon: <Code2 className="w-5 h-5" />,
      title: "REST API",
      description: "Every feature is available via API. Drop OmniRAG into an existing product without rebuilding anything.",
      accent: "text-cyan-600",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f4ed] text-[#141413] font-sans overflow-x-hidden selection:bg-primary/20 selection:text-foreground">
      {/* Navbar */}
      <div className="fixed top-0 inset-x-0 z-50 flex justify-center mt-5 px-4 pointer-events-none">
        <nav className={`pointer-events-auto transition-all duration-300 rounded-2xl flex items-center justify-between px-5 py-3 w-full max-w-5xl ${
          isScrolled
            ? 'bg-white/90 backdrop-blur-md border border-[#e8e6dc] shadow-[rgba(0,0,0,0.05)_0px_4px_24px]'
            : 'bg-transparent border border-transparent'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <LogoIcon className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#141413]">OmniRAG</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-[#87867f] hover:text-[#141413] transition-colors">Features</a>
            <a href="#solutions" className="text-sm text-[#87867f] hover:text-[#141413] transition-colors">Solutions</a>
            <Link to="/docs/zalo-bot" className="text-sm text-[#87867f] hover:text-[#141413] transition-colors">Docs</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <Link to="/dashboard" className="px-4 py-2 bg-[#f0eee6] hover:bg-[#e8e6dc] border border-[#e8e6dc] text-[#4d4c48] hover:text-[#141413] text-sm font-medium rounded-xl transition-all">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-sm text-[#87867f] hover:text-[#141413] transition-colors">Sign in</Link>
                <Link to="/auth" className="px-4 py-2 bg-primary hover:bg-primary/85 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-1.5">
                  Get started <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden text-[#87867f] hover:text-[#141413] transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed top-20 inset-x-4 z-40 bg-white border border-[#e8e6dc] rounded-2xl p-5 flex flex-col gap-3 md:hidden shadow-[rgba(0,0,0,0.05)_0px_4px_24px]">
          <a href="#features" className="text-sm font-medium text-[#5e5d59] hover:text-[#141413] py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#solutions" className="text-sm font-medium text-[#5e5d59] hover:text-[#141413] py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
          <Link to="/docs/zalo-bot" className="text-sm font-medium text-[#5e5d59] hover:text-[#141413] py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Docs</Link>
          <div className="h-px w-full bg-[#e8e6dc] my-1" />
          <Link to="/auth" className="w-full text-center px-5 py-3 bg-primary text-white text-sm font-medium rounded-xl" onClick={() => setMobileMenuOpen(false)}>Get started</Link>
        </div>
      )}

      <main className="relative z-10">
        {/* Hero — left-aligned, asymmetric */}
        <section className="mx-auto max-w-7xl px-6 lg:px-8 pt-36 lg:pt-48 pb-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="flex flex-col gap-6"
            >
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-primary/70 border border-primary/20 bg-primary/6 rounded-full px-3 py-1.5 tracking-wide">
                  <Database className="w-3 h-3" />
                  RAG platform · Knowledge graph · Multi-domain
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-[clamp(2.6rem,5vw,4rem)] font-bold leading-[1.08] tracking-[-0.04em] text-[#141413] font-serif"
              >
                Your knowledge base,<br />
                <span className="text-primary/80">actually useful.</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="text-[#87867f] text-lg leading-relaxed max-w-lg">
                Upload documents, connect a knowledge graph, and deploy AI chatbots that give real answers — with citations.
                Built for teams that can't afford hallucinations.
              </motion.p>

              <motion.div variants={fadeUp} className="flex items-center gap-3 pt-2">
                {isLoggedIn ? (
                  <Link to="/dashboard" className="px-6 py-3 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2">
                    Go to dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link to="/auth" className="px-6 py-3 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2 shadow-md shadow-primary/20">
                    Start building <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                <a href="#features" className="px-6 py-3 bg-[#f0eee6] hover:bg-[#e8e6dc] border border-[#e8e6dc] text-[#5e5d59] hover:text-[#141413] text-sm font-medium rounded-xl transition-all">
                  See features
                </a>
              </motion.div>

              {/* Social proof strip */}
              <motion.div variants={fadeUp} className="flex items-center gap-4 pt-4 border-t border-[#e8e6dc]">
                <div className="text-xs text-[#b0aea5]">Built with</div>
                <div className="flex items-center gap-3">
                  {['FastAPI', 'Qdrant', 'LightRAG', 'OpenRouter'].map(t => (
                    <span key={t} className="text-[11px] text-[#87867f] font-mono">{t}</span>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Right — chat mock */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="rounded-2xl border border-[#e8e6dc] bg-white shadow-[rgba(0,0,0,0.05)_0px_4px_24px] overflow-hidden">
                {/* Window bar */}
                <div className="flex items-center px-4 py-3 border-b border-[#e8e6dc] bg-[#faf9f5]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#d1cfc5]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#d1cfc5]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#d1cfc5]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-3 py-1 text-[11px] font-mono text-[#87867f] bg-[#f0eee6] rounded-md flex items-center gap-1.5">
                      <Shield className="w-2.5 h-2.5" /> hub.omnirag.app
                    </div>
                  </div>
                  <div className="w-14" />
                </div>

                {/* Chat content */}
                <div className="p-6 flex flex-col gap-5 min-h-[360px]">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-[#c96442] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[80%]">
                      What is our policy on remote work equipment?
                    </div>
                  </div>

                  {/* Bot message */}
                  <div className="flex gap-3 max-w-[90%]">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <BrainCircuit className="w-3.5 h-3.5 text-primary/80" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="bg-[#faf9f5] border border-[#e8e6dc] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[#141413] leading-relaxed">
                        Per <span className="text-primary/80 font-medium">Employee Handbook v2.4</span>, employees are eligible for a $500 stipend covering ergonomic furniture, monitors, headsets, and webcams.
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#b0aea5] font-mono">Source</span>
                        <span className="text-[11px] text-primary/60 hover:text-primary/80 cursor-pointer transition-colors">Employee_Handbook_v2.pdf · p.14</span>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="mt-auto pt-4 border-t border-[#e8e6dc] flex items-center gap-3">
                    <div className="flex-1 text-sm text-[#b0aea5] bg-[#f0eee6] border border-[#e8e6dc] rounded-xl px-4 py-2.5">
                      Ask anything about your documents...
                    </div>
                    <div className="w-8 h-8 bg-primary/15 border border-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="w-4 h-4 text-primary/60" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stat cards */}
              <div className="absolute -bottom-5 -left-8 hidden lg:flex items-center gap-2.5 bg-white border border-[#e8e6dc] rounded-xl px-4 py-3 shadow-lg shadow-black/5">
                <div className="w-2 h-2 rounded-full bg-emerald-400/70 animate-pulse" />
                <span className="text-xs text-[#87867f] font-mono">47 docs · 12,384 chunks</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features — asymmetric grid */}
        <section id="features" className="py-28 border-t border-[#e8e6dc]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="mb-16 max-w-xl"
            >
              <p className="text-[11px] font-semibold text-primary/60 tracking-[0.1em] uppercase mb-3">What's inside</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-[#141413] font-serif mb-4">
                Built for accuracy,<br />not just speed.
              </h2>
              <p className="text-[#87867f] text-base leading-relaxed">
                Every component in the pipeline was chosen to reduce hallucinations and improve answer quality in production.
              </p>
            </motion.div>

            {/* Feature grid — gap-px divider pattern */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e8e6dc] rounded-2xl overflow-hidden border border-[#e8e6dc]"
            >
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeUp}
                  className="p-7 bg-white hover:bg-[#faf9f5] transition-colors duration-300 group flex flex-col gap-4"
                >
                  <div className={`w-9 h-9 rounded-lg bg-[#f0eee6] border border-[#e8e6dc] flex items-center justify-center ${feature.accent} group-hover:border-[#d1cfc5] transition-colors`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#141413] mb-1.5">{feature.title}</h3>
                    <p className="text-sm text-[#87867f] leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section id="solutions" className="py-28 border-t border-[#e8e6dc]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="max-w-2xl mx-auto px-6 text-center"
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-[-0.03em] text-[#141413] font-serif mb-5">
              Ready to put your<br />documents to work?
            </h2>
            <p className="text-[#87867f] text-base mb-10 leading-relaxed">
              Set up takes under ten minutes. No infrastructure to manage — everything runs in Docker.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/auth" className="px-7 py-3.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                Get started free <ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/docs/zalo-bot" className="px-7 py-3.5 bg-[#f0eee6] hover:bg-[#e8e6dc] border border-[#e8e6dc] text-[#5e5d59] hover:text-[#141413] text-sm font-medium rounded-xl transition-all">
                Read the docs
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e6dc] py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/15 flex items-center justify-center">
              <LogoIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium text-[#87867f]">OmniRAG</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-[#b0aea5] hover:text-[#87867f] transition-colors">Privacy policy</a>
            <a href="#" className="text-xs text-[#b0aea5] hover:text-[#87867f] transition-colors">Terms of service</a>
          </div>
          <p className="text-xs text-[#b0aea5]">© 2026 OmniRAG. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
