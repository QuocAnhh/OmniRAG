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
      confirmButtonColor: '#b53333',
      cancelButtonColor: '#87867f',
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 py-6 rounded-2xl bg-white border border-[#e8e6dc] relative overflow-hidden"
        >
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold font-serif tracking-tight text-[#141413] flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-primary/70" /> AI Agents
            </h2>
            <p className="text-[#87867f] mt-1.5 text-sm">
              Manage and configure your RAG assistants.
            </p>
          </div>
          <Link
            to="/bots/new"
            className="relative z-10 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all shadow-[0px_0px_0px_1px_#c96442]"
          >
            <Plus className="w-4 h-4" />
            New agent
          </Link>
        </motion.div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#e8e6dc] shadow-sm flex flex-col h-[240px] overflow-hidden animate-pulse">
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-[#f0eee6]"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-1/2 bg-[#f0eee6] rounded"></div>
                      <div className="h-4 w-1/4 bg-[#f0eee6] rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4">
                    <div className="h-4 w-full bg-[#f0eee6] rounded"></div>
                    <div className="h-4 w-4/5 bg-[#f0eee6] rounded"></div>
                  </div>
                </div>
                <div className="p-4 border-t border-[#e8e6dc] bg-[#faf9f5] flex gap-2">
                  <div className="h-10 w-10 bg-[#f0eee6] rounded-xl"></div>
                  <div className="flex-1 h-10 bg-[#f0eee6] rounded-xl"></div>
                  <div className="h-10 w-10 bg-[#f0eee6] rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : bots.length === 0 ? (

          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-[#e8e6dc] border-dashed p-16 text-center flex flex-col items-center justify-center gap-3"
          >
            <div className="size-14 rounded-xl bg-[#f0eee6] border border-[#e8e6dc] flex items-center justify-center mb-2">
              <BotIcon className="w-6 h-6 text-[#b0aea5]" />
            </div>
            <div>
              <h3 className="text-base font-semibold font-serif text-[#5e5d59] mb-1">No agents yet</h3>
              <p className="text-sm text-[#87867f] max-w-xs mx-auto leading-relaxed">Create your first agent to start querying your knowledge base.</p>
            </div>
            <Link
              to="/bots/new"
              className="mt-3 px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2 shadow-[0px_0px_0px_1px_#c96442]"
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
                className="group bg-white rounded-2xl border border-[#e8e6dc] hover:border-[#d1cfc5] transition-all duration-300 flex flex-col overflow-hidden"
              >
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-5 h-5 text-primary/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-[#141413] line-clamp-1 tracking-tight">{bot.name}</h3>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {bot.is_active ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f0eee6] text-[#87867f] border border-[#e8e6dc]">
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

                  <p className="text-xs text-[#87867f] line-clamp-3 leading-relaxed flex-1">
                    {bot.description || 'No description provided.'}
                  </p>
                </div>

                <div className="px-4 py-3 border-t border-[#e8e6dc] flex items-center gap-2">
                  <Link
                    to={`/bots/${bot.id}/chat`}
                    className="flex-1 px-3 py-2 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-xs font-medium rounded-lg transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Chat
                  </Link>
                  <Link
                    to={`/bots/${bot.id}/config`}
                    className="p-2 rounded-lg text-[#b0aea5] hover:text-[#5e5d59] hover:bg-[#f0eee6] transition-all"
                    title="Configure"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={(e) => handleDelete(bot.id, e)}
                    className="p-2 rounded-lg text-[#b0aea5] hover:text-[#b53333] hover:bg-[#b53333]/10 transition-all"
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
