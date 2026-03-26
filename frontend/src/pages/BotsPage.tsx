import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import { Bot as BotIcon, Plus, Play, Settings, Trash2, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getDomainMeta } from '../utils/domainHelpers';

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
      toast.error('Could not load your agents. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const result = await Swal.fire({
      title: 'Delete Agent?',
      text: 'You cannot undo this action.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3b82f6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await botsApi.delete(id);
        setBots(bots.filter(bot => bot.id !== id));
      } catch (error) {
        toast.error('Failed to delete agent. Please try again.');
      }
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 py-6 rounded-2xl bg-background/40 backdrop-blur-2xl border border-white/6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-primary/70" /> AI Agents
            </h2>
            <p className="text-white/30 mt-1.5 text-sm">
              Manage and configure your RAG assistants.
            </p>
          </div>
          <Link
            to="/bots/new"
            className="relative z-10 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            New agent
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background/40 backdrop-blur-2xl rounded-2xl border border-white/6 border-dashed p-16 text-center flex flex-col items-center justify-center gap-3"
          >
            <div className="size-14 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center mb-2">
              <BotIcon className="w-6 h-6 text-white/20" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white/70 mb-1">No agents yet</h3>
              <p className="text-sm text-white/30 max-w-xs mx-auto leading-relaxed">Create your first agent to start querying your knowledge base.</p>
            </div>
            <Link
              to="/bots/new"
              className="mt-3 px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Create agent
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
                className="group bg-background/40 backdrop-blur-xl rounded-2xl border border-white/6 hover:border-white/10 transition-all duration-300 hover:-translate-y-px flex flex-col overflow-hidden"
              >
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-5 h-5 text-primary/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-white/85 line-clamp-1 tracking-tight">{bot.name}</h3>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {bot.is_active ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/30 border border-white/8">
                            Inactive
                          </span>
                        )}
                        {(() => {
                          const dm = getDomainMeta(bot.config?.domain);
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${dm.badge}`}>
                              <span className="material-symbols-outlined text-[10px]">{dm.icon}</span>
                              {dm.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-white/30 line-clamp-3 leading-relaxed flex-1">
                    {bot.description || 'No description provided.'}
                  </p>
                </div>

                <div className="px-4 py-3 border-t border-white/6 flex items-center gap-2">
                  <Link
                    to={`/bots/${bot.id}/chat`}
                    className="flex-1 px-3 py-2 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-xs font-medium rounded-lg transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Chat
                  </Link>
                  <Link
                    to={`/bots/${bot.id}/config`}
                    className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/6 transition-all"
                    title="Configure"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={(e) => handleDelete(bot.id, e)}
                    className="p-2 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Delete agent"
                  >
                    <Trash2 className="w-4 h-4" />
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
