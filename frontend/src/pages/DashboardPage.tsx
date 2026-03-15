import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import { documentsApi } from '../api/documents';
import { analyticsApi } from '../api/analytics';
import type { ConversationItem, AnalyticsStats } from '../api/analytics';
import { useAuthStore } from '../store/authStore';
import type { Bot } from '../types/api';
import { getDomainMeta } from '../utils/domainHelpers';
import { Plus, MessageSquare, Bot as BotIcon, ChevronRight, Settings, Zap, Clock, Users, Star } from 'lucide-react';

function formatTimeAgo(ts: string): string {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type BotDocState = { count: number; processing: boolean };

export default function DashboardPage() {
  const { user } = useAuthStore();

  const [bots, setBots] = useState<Bot[]>([]);
  const [botDocs, setBotDocs] = useState<Record<string, BotDocState>>({});
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [botsData, convsData, statsData] = await Promise.all([
        botsApi.list(),
        analyticsApi.getConversations(8).catch(() => [] as ConversationItem[]),
        analyticsApi.getStats().catch(() => null),
      ]);

      setBots(botsData);
      setConversations(convsData);
      setStats(statsData);

      const results = await Promise.all(
        botsData.map(async (bot) => {
          try {
            const docs = await documentsApi.list(bot.id);
            return {
              id: bot.id,
              count: docs.filter(d => d.status === 'completed').length,
              processing: docs.some(d => d.status === 'processing' || d.status === 'pending'),
            };
          } catch {
            return { id: bot.id, count: 0, processing: false };
          }
        })
      );

      const map: Record<string, BotDocState> = {};
      results.forEach(r => { map[r.id] = { count: r.count, processing: r.processing }; });
      setBotDocs(map);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const activeBots = bots.filter(b => b.is_active).length;
  const totalDocs = Object.values(botDocs).reduce((s, d) => s + d.count, 0);
  const botsNeedingDocs = bots.filter(b => !botDocs[b.id]?.processing && (botDocs[b.id]?.count ?? 1) === 0);

  const statTiles = [
    {
      label: 'Total Messages',
      value: stats ? stats.total_messages.toLocaleString() : '—',
      icon: <MessageSquare className="w-4 h-4" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Avg Response',
      value: stats?.avg_response_time ?? '—',
      icon: <Clock className="w-4 h-4" />,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      label: 'Active Users',
      value: stats ? stats.active_users.toLocaleString() : '—',
      icon: <Users className="w-4 h-4" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Satisfaction',
      value: stats?.avg_csat_score ? `${(stats.avg_csat_score * 100).toFixed(0)}%` : '—',
      icon: <Star className="w-4 h-4" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
  ];

  if (loading) {
    return (
      <Layout breadcrumbs={[{ label: 'Home' }]}>
        <div className="flex items-center justify-center h-64">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={[{ label: 'Home' }]}>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

        {/* ── Greeting Header ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-8 rounded-3xl bg-background/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/8 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <p className="text-muted-foreground text-sm mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-3xl font-bold text-white">{greeting}, {firstName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {activeBots} active agent{activeBots !== 1 ? 's' : ''}
              </span>
              <span className="hidden sm:inline">·</span>
              <span>{totalDocs} docs indexed</span>
            </div>
          </div>
          <Link
            to="/bots/new"
            className="relative z-10 inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)] border border-primary/50"
          >
            <Plus className="w-4 h-4" />
            New Agent
          </Link>
        </motion.div>

        {/* ── Stat Tiles ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="flex items-center gap-4 p-5 rounded-2xl bg-background/40 backdrop-blur-xl border border-white/8 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <div className={`size-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${tile.bg} ${tile.color}`}>
                {tile.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-bold text-foreground tabular-nums">{tile.value}</div>
                <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">{tile.label}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Attention Banner ────────────────────────────────── */}
        {botsNeedingDocs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-sm"
          >
            <span className="material-symbols-outlined text-amber-400 text-[18px] flex-shrink-0">warning</span>
            <span className="text-amber-300/90">
              <span className="font-semibold">{botsNeedingDocs.map(b => b.name).join(', ')}</span>
              {' '}{botsNeedingDocs.length === 1 ? 'has' : 'have'} no documents — upload knowledge to activate RAG.
            </span>
            <Link
              to={`/bots/${botsNeedingDocs[0].id}/config?tab=knowledge`}
              className="ml-auto flex-shrink-0 text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
            >
              Fix now <ChevronRight className="w-3 h-3" />
            </Link>
          </motion.div>
        )}

        {/* ── Main 2-col layout ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT: Recent Conversations */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Recent Conversations
              </h3>
            </div>

            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No conversations yet</p>
                {bots[0] && (
                  <Link to={`/bots/${bots[0].id}/chat`} className="mt-4 text-xs text-primary hover:underline">
                    Start your first chat →
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {conversations.map((conv) => {
                  const dm = getDomainMeta(bots.find(b => b.id === conv.bot_id)?.config?.domain);
                  return (
                    <Link
                      key={conv.id}
                      to={`/bots/${conv.bot_id}/chat`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="size-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-background/60 border border-white/10">
                        <span className={`material-symbols-outlined text-[16px] ${dm.iconColor}`}>{dm.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-muted-foreground">{conv.bot_name}</span>
                          <span className="text-[10px] text-muted-foreground/40">{formatTimeAgo(conv.timestamp)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 truncate">{conv.user_message}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* RIGHT: Agent Status (full height, no quick actions) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <BotIcon className="w-4 h-4 text-primary" />
                Agents
              </h3>
              <Link to="/bots" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                View all →
              </Link>
            </div>

            {bots.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground">
                <BotIcon className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No agents yet</p>
                <Link to="/bots/new" className="mt-4 text-xs text-primary hover:underline">
                  Create your first agent →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5 flex-1">
                {bots.map((bot) => {
                  const dm = getDomainMeta(bot.config?.domain);
                  const docs = botDocs[bot.id];
                  const status = !docs
                    ? 'loading'
                    : docs.processing ? 'processing'
                    : docs.count === 0 ? 'empty'
                    : 'ready';

                  return (
                    <div key={bot.id} className="flex items-center gap-3 px-5 py-4 group hover:bg-white/[0.02] transition-colors">
                      <div className="size-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-background/60 border border-white/10">
                        <span className={`material-symbols-outlined text-[16px] ${dm.iconColor}`}>{dm.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{bot.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {status === 'ready' && (
                            <>
                              <span className="size-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span className="text-[11px] text-muted-foreground">{docs!.count} doc{docs!.count !== 1 ? 's' : ''}</span>
                            </>
                          )}
                          {status === 'processing' && (
                            <>
                              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                              <span className="text-[11px] text-amber-400/80">Indexing...</span>
                            </>
                          )}
                          {status === 'empty' && (
                            <>
                              <span className="size-1.5 rounded-full bg-muted-foreground/25 flex-shrink-0" />
                              <span className="text-[11px] text-muted-foreground/50">No documents</span>
                            </>
                          )}
                          {status === 'loading' && <span className="text-[11px] text-muted-foreground/30">—</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <Link
                          to={`/bots/${bot.id}/chat`}
                          className="p-1.5 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                          title="Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/bots/${bot.id}/config`}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                          title="Configure"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </Layout>
  );
}
