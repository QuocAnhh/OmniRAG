import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { motion } from 'framer-motion';
import { BrainCircuit, Shield, Zap, Sparkles, ChevronRight, Menu, X, Database, Globe, LineChart, Code2, ArrowRight } from 'lucide-react';
import { LogoIcon } from '../components/ui/LogoIcon';

const ParticleBackground = () => {
  useEffect(() => {
    const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let particles: { x: number, y: number, vx: number, vy: number, radius: number }[] = [];
    const particleCount = Math.floor(width * height / 12000); // base density

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5
      });
    }

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Connect particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#000000]">
      <canvas id="particle-canvas" className="absolute inset-0 w-full h-full opacity-50"></canvas>
      <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[150px] mix-blend-screen"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[150px] mix-blend-screen"></div>
    </div>
  );
};

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { token } = useAuthStore();
  const isLoggedIn = !!(token || localStorage.getItem('access_token'));

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const features = [
    {
      icon: <BrainCircuit className="w-6 h-6 text-blue-400" />,
      title: "Semantic Understanding",
      description: "Our core AI engine goes beyond keyword matching to comprehend the true intent and nuance behind every query."
    },
    {
      icon: <Zap className="w-6 h-6 text-orange-400" />,
      title: "Real-time Processing",
      description: "Experience lightning-fast document indexing and retrieval, powered by state-of-the-art vector databases."
    },
    {
      icon: <Shield className="w-6 h-6 text-emerald-400" />,
      title: "Enterprise Security",
      description: "Bank-grade encryption and strict access controls ensure your organization's wisdom remains entirely private."
    },
    {
      icon: <Database className="w-6 h-6 text-indigo-400" />,
      title: "Unified Knowledge Base",
      description: "Connect scattered data silos into a single, intelligent, and highly queryable central repository."
    },
    {
      icon: <LineChart className="w-6 h-6 text-rose-400" />,
      title: "Actionable Analytics",
      description: "Gain deep insights into how your team interacts with internal documents and identify knowledge gaps."
    },
    {
      icon: <Code2 className="w-6 h-6 text-cyan-400" />,
      title: "Seamless Integration",
      description: "Integrate OmniRAG securely into your existing workflow tools via our robust REST APIs."
    }
  ];

  return (
    <div className="min-h-screen bg-[#020205] text-slate-50 font-sans overflow-x-hidden selection:bg-blue-500/30 selection:text-white">
      <ParticleBackground />

      {/* Navbar */}
      <div className="fixed top-0 inset-x-0 z-50 flex justify-center mt-6 px-4 pointer-events-none">
        <nav className={`pointer-events-auto transition-all duration-300 rounded-full flex items-center justify-between px-6 py-3 w-full max-w-5xl ${isScrolled
          ? 'bg-[#050510]/70 backdrop-blur-xl border border-white/10 shadow-lg shadow-black/50'
          : 'bg-transparent border border-transparent mt-2'
          }`}>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[1px]">
              <div className="w-full h-full bg-[#020205] rounded-xl flex items-center justify-center overflow-hidden">
                <LogoIcon className="w-6 h-6" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">OmniRAG</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 relative z-10">
            <a href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Ecosystem</a>
            <a href="#solutions" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Solutions</a>
            <Link to="/docs" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Developers</Link>
          </div>

          <div className="hidden md:flex items-center gap-4 relative z-10">
            {isLoggedIn ? (
              <Link to="/dashboard" className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-full hover:bg-slate-200 transition-all">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Log in</Link>
                <Link to="/auth" className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-full hover:scale-105 transition-transform flex items-center gap-2">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-slate-300 hover:text-white relative z-10" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="fixed top-24 inset-x-4 z-40 bg-[#050510]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col gap-4 md:hidden shadow-2xl">
          <a href="#features" className="text-lg font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Ecosystem</a>
          <a href="#solutions" className="text-lg font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
          <Link to="/docs" className="text-lg font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Developers</Link>
          <div className="h-[1px] w-full bg-white/10 my-2"></div>
          {isLoggedIn ? (
            <Link to="/dashboard" className="w-full text-center px-5 py-3 bg-white text-black text-base font-semibold rounded-full" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
          ) : (
            <Link to="/auth" className="w-full text-center px-5 py-3 bg-white text-black text-base font-semibold rounded-full" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          )}
        </div>
      )}

      <main className="relative z-10 pt-32 lg:pt-48">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-6 lg:px-8 pb-32">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col items-center text-center max-w-4xl mx-auto"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>The Next Generation of Enterprise AI</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] mb-8">
              Intelligence <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400">
                Reimagined.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed">
              Transform your scattered documents into a powerful, queryable knowledge base. Give your team the ultimate cognitive advantage with OmniRAG.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              {isLoggedIn ? (
                <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-white text-black text-base font-bold rounded-full hover:scale-105 transition-transform flex items-center justify-center gap-2">
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <Link to="/auth" className="w-full sm:w-auto px-8 py-4 bg-white text-black text-base font-bold rounded-full hover:scale-105 transition-transform flex items-center justify-center gap-2">
                  Start Building <ArrowRight className="w-5 h-5" />
                </Link>
              )}
              <a href="#features" className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 text-base font-semibold rounded-full hover:bg-white/10 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm">
                Explore Ecosystem
              </a>
            </motion.div>
          </motion.div>

          {/* Dashboard Preview / Mock */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-24 relative max-w-5xl mx-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-transparent blur-3xl -z-10 rounded-full opacity-50"></div>
            <div className="rounded-2xl border border-white/10 bg-[#06060A]/80 backdrop-blur-xl shadow-2xl overflow-hidden shadow-blue-500/10">
              <div className="flex items-center px-4 py-3 border-b border-white/5 bg-[#0A0A0F]">
                <div className="flex gap-2 w-20">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 text-xs font-mono text-slate-400 bg-white/5 rounded-md flex items-center gap-2">
                    <Shield className="w-3 h-3" /> hub.omnirag.systems
                  </div>
                </div>
                <div className="w-20"></div>
              </div>
              <div className="flex flex-col md:flex-row h-[400px] md:h-[500px] bg-gradient-to-br from-[#06060A] to-[#020205] relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/bg-grid.svg')] opacity-[0.02]"></div>

                {/* Sidebar mock */}
                <div className="hidden md:flex flex-col w-64 border-r border-white/5 p-4 gap-2 relative z-10">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Playgrounds</div>
                  <div className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 flex items-center gap-3 text-sm font-medium border border-blue-500/20">
                    <Database className="w-4 h-4" /> HR Policies
                  </div>
                  <div className="px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 flex items-center gap-3 text-sm font-medium transition-colors">
                    <Code2 className="w-4 h-4" /> API Docs
                  </div>
                  <div className="px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 flex items-center gap-3 text-sm font-medium transition-colors">
                    <LineChart className="w-4 h-4" /> Q3 Reports
                  </div>
                </div>

                {/* Chat mock */}
                <div className="flex-1 flex flex-col p-6 relative z-10">
                  <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    {/* User Message */}
                    <div className="flex gap-4 self-end max-w-[80%]">
                      <div className="bg-white/10 p-4 rounded-2xl rounded-tr-sm text-sm text-slate-200 border border-white/5">
                        What is our company policy on remote work equipment?
                      </div>
                    </div>
                    {/* Bot Message */}
                    <div className="flex gap-4 max-w-[85%]">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                        <BrainCircuit className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="bg-blue-500/10 p-4 rounded-2xl rounded-tl-sm text-sm text-slate-200 border border-blue-500/20 leading-relaxed shadow-inner shadow-blue-500/10">
                          According to the <strong>Employee Handbook v2.4</strong> updated last month, employees are eligible for a $500 stipend to set up their home office. This covers:
                          <ul className="list-disc ml-5 mt-2 space-y-1 text-slate-300">
                            <li>Ergonomic chairs & desks</li>
                            <li>External monitors</li>
                            <li>Headsets and webcams</li>
                          </ul>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] uppercase font-bold text-blue-400/70 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Sources</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 hover:text-blue-400 cursor-pointer transition-colors"><Shield className="w-3 h-3" /> Employee_Handbook_v2.pdf</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Input mock */}
                  <div className="mt-6 p-1 rounded-xl bg-white/5 border border-white/10 flex items-center pr-2">
                    <div className="p-3 text-slate-500">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-sm text-slate-500 truncate">Ask OmniRAG anything about your documents...</div>
                    <div className="p-2 bg-white/10 rounded-lg">
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features / Ecosystem */}
        <section id="features" className="py-32 relative border-t border-white/5 bg-[#020205]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp}
              className="mb-20 md:text-center"
            >
              <h2 className="text-blue-400 font-semibold tracking-wide uppercase text-sm mb-3">Ecosystem</h2>
              <h3 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-white">Engineered for Scale.</h3>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl md:mx-auto">
                Discover the modular components that make OmniRAG the most robust knowledge engine for your enterprise.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeUp}
                  className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-blue-500/30 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h4 className="text-xl font-semibold mb-3 text-slate-200">{feature.title}</h4>
                  <p className="text-slate-400 leading-relaxed text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden border-t border-white/5">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent -z-10"></div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="max-w-4xl mx-auto px-6 text-center"
          >
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Ready to transcend the limits of traditional search?
            </h2>
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Join visionary companies leveraging OmniRAG to build the smartest organizations on Earth.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/auth" className="px-8 py-4 bg-blue-600 text-white text-base font-bold rounded-full hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                Get Started Free <ChevronRight className="w-5 h-5" />
              </Link>
              <button className="px-8 py-4 bg-white/5 text-white border border-white/10 text-base font-bold rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm">
                Contact Sales
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020205] py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-[1px]">
              <div className="w-full h-full bg-[#020205] rounded-lg flex items-center justify-center">
                <LogoIcon className="w-5 h-5" />
              </div>
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">OmniRAG® Systems</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</a>
          </div>
          <p className="text-sm text-slate-500">© 2026 OmniRAG. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
