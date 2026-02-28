import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';
import { Link } from 'react-router-dom';
import { Bot as BotIcon, Plus, Play, Settings, Trash2, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const data = await botsApi.list();
      setBots(data);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      await botsApi.delete(id);
      setBots(bots.filter(bot => bot.id !== id));
    } catch (error) {
      alert('Failed to delete bot');
    }
  };

  // Stagger animation container variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'AI Agents' }]}>
      <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 p-8 rounded-3xl bg-background/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* Subtle background glow for header */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Cpu className="w-8 h-8 text-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] rounded-lg" /> AI Agents
            </h2>
            <p className="text-muted-foreground mt-2 text-base">
              Manage and configure your intelligent RAG assistants.
            </p>
          </div>
          <Link
            to="/bots/new"
            className="
              relative z-10
              inline-flex items-center justify-center gap-2
              w-full sm:w-auto px-8 py-3.5
              bg-primary text-primary-foreground
              hover:bg-primary/90
              font-semibold
              rounded-xl
              shadow-[0_0_20px_rgba(var(--primary),0.4)]
              hover:shadow-[0_0_30px_rgba(var(--primary),0.6)]
              hover:-translate-y-1
              transition-all duration-300 border border-primary/50
            "
          >
            <Plus className="w-5 h-5" />
            Create Agent
          </Link>
        </motion.div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/[0.02] rounded-2xl border border-white/5 shadow-sm flex flex-col h-[240px] overflow-hidden animate-pulse">
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-white/5"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-1/2 bg-white/5 rounded"></div>
                      <div className="h-4 w-1/4 bg-white/5 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4">
                    <div className="h-4 w-full bg-white/5 rounded"></div>
                    <div className="h-4 w-4/5 bg-white/5 rounded"></div>
                  </div>
                </div>
                <div className="p-4 border-t border-white/5 bg-white/[0.01] flex gap-2">
                  <div className="h-10 w-10 bg-white/5 rounded-xl"></div>
                  <div className="flex-1 h-10 bg-white/5 rounded-xl"></div>
                  <div className="h-10 w-10 bg-white/5 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : bots.length === 0 ? (

          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 border-dashed p-16 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>

            <div className="size-24 rounded-2xl bg-background/50 border border-white/10 flex items-center justify-center mb-2 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] relative z-10">
              <BotIcon className="w-12 h-12 text-muted-foreground" />
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-foreground mb-2">No agents deployed</h3>
              <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">Create your first intelligent RAG assistant to start querying your knowledge base.</p>
            </div>
            <Link
              to="/bots/new"
              className="mt-6 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:-translate-y-1 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] border border-primary/50 relative z-10"
            >
              <Plus className="w-5 h-5" /> Create First Agent
            </Link>
          </motion.div>
        ) : (

          /* Bots Grid */
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {bots.map((bot) => (
              <motion.div
                key={bot.id}
                variants={itemVariants}
                className="
                  group
                  bg-background/40 backdrop-blur-2xl
                  rounded-2xl
                  border border-white/10
                  hover:border-primary/50
                  shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(var(--primary),0.15)]
                  transition-all duration-500 ease-out
                  hover:-translate-y-2
                  flex flex-col
                  h-[260px] relative overflow-hidden
                "
              >
                {/* Subtle top glow line on hover */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="p-6 flex-1 flex flex-col relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 group-hover:bg-primary/20 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.3)] transition-all duration-500 shrink-0">
                        <BotIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">{bot.name}</h3>
                        <div className="mt-1">
                          {bot.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 bg-background/50 backdrop-blur-sm p-4 rounded-xl border border-white/5 relative group-hover:bg-white/[0.05] group-hover:border-white/10 transition-all duration-500 shadow-inner">
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {bot.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-background/60 backdrop-blur-md flex items-center gap-2 relative z-10">
                  <Link
                    to={`/bots/${bot.id}/chat`}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(var(--primary),0.3)] transition-all bg-white/5 border border-transparent hover:border-primary/30 flex-shrink-0"
                    title="Open Playground"
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </Link>
                  <Link
                    to={`/bots/${bot.id}/config`}
                    className="flex-1 px-4 py-2.5 text-foreground border border-white/10 hover:border-primary/50 bg-white/5 hover:bg-primary/10 font-semibold rounded-xl text-sm transition-all text-center flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </Link>
                  <button
                    onClick={(e) => handleDelete(bot.id, e)}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/20 hover:shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all bg-white/5 border border-transparent hover:border-destructive/30 flex-shrink-0"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
