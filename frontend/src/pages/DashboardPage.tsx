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
import { Plus, MessageSquare, Bot as BotIcon, ChevronRight, Settings, Clock, Users, Star } from 'lucide-react';

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
      label: 'Total messages',
      value: stats ? stats.total_messages.toLocaleString() : '—',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      label: 'Avg response',
      value: stats?.avg_response_time ?? '—',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: 'Active users',
      value: stats ? stats.active_users.toLocaleString() : '—',
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Satisfaction',
      value: stats?.avg_csat_score ? `${(stats.avg_csat_score * 100).toFixed(1)}%` : '—',
      icon: <Star className="w-4 h-4" />,
    },
  ];

  if (loading) {
    return (
      <Layout breadcrumbs={[{ label: 'Home' }]}>
        <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
          {/* Greeting card skeleton */}
          <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-20" />
          {/* Stat tiles skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-28" />
            <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-28" />
            <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-28" />
            <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-28" />
          </div>
          {/* Panels skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-80 lg:col-span-3" />
            <div className="animate-pulse bg-[#f0eee6] rounded-2xl h-80 lg:col-span-2" />
          </div>
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 py-6 rounded-2xl bg-white border border-[#e8e6dc] relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-[#b0aea5] text-xs mb-1.5 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-2xl font-semibold font-serif text-[#141413] tracking-tight">{greeting}, {firstName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-[#87867f]">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400/70" />
                {activeBots} active agent{activeBots !== 1 ? 's' : ''}
              </span>
              <span className="hidden sm:inline opacity-40">·</span>
              <span>{totalDocs} docs indexed</span>
            </div>
          </div>
          <Link
            to="/bots/new"
            className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all shadow-[0px_0px_0px_1px_#c96442]"
          >
            <Plus className="w-4 h-4" />
            New agent
          </Link>
        </motion.div>

        {/* ── Stat Tiles ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statTiles.map((tile, index) => (
            <div
              key={tile.label}
              className="flex flex-col gap-3 p-5 rounded-2xl bg-white border border-[#e8e6dc]"
            >
              <div
                className="size-8 rounded-lg bg-[#f0eee6] border border-[#e8e6dc] flex items-center justify-center text-[#87867f] flex-shrink-0 animate-float"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                {tile.icon}
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-foreground/90 tabular-nums tracking-tight">{tile.value}</div>
                <div className="text-[11px] text-[#b0aea5] mt-0.5 font-medium">{tile.label}</div>
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
            className="lg:col-span-3 bg-white rounded-3xl border border-[#e8e6dc] shadow-[rgba(0,0,0,0.05)_0px_4px_24px] overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#e8e6dc] flex items-center justify-between">
              <h3 className="font-semibold font-serif text-sm text-foreground flex items-center gap-2">
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
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
                }}
                className="divide-y divide-[#e8e6dc]"
              >
                {conversations.map((conv) => {
                  const dm = getDomainMeta(bots.find(b => b.id === conv.bot_id)?.config?.domain);
                  return (
                    <motion.div
                      key={conv.id}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
                    >
                    <Link
                      to={`/bots/${conv.bot_id}/chat`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-[#f0eee6] transition-colors group"
                    >
                      <div className="size-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-[#f0eee6] border border-[#e8e6dc]">
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
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>

          {/* RIGHT: Agent Status (full height, no quick actions) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 bg-white rounded-3xl border border-[#e8e6dc] shadow-[rgba(0,0,0,0.05)_0px_4px_24px] overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#e8e6dc] flex items-center justify-between">
              <h3 className="font-semibold font-serif text-sm text-foreground flex items-center gap-2">
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
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
                }}
                className="divide-y divide-[#e8e6dc] flex-1"
              >
                {bots.map((bot) => {
                  const dm = getDomainMeta(bot.config?.domain);
                  const docs = botDocs[bot.id];
                  const status = !docs
                    ? 'loading'
                    : docs.processing ? 'processing'
                    : docs.count === 0 ? 'empty'
                    : 'ready';

                  return (
                    <motion.div
                      key={bot.id}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
                      className="flex items-center gap-3 px-5 py-4 group hover:bg-[#f0eee6] transition-colors"
                    >
                      <div className="size-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-[#f0eee6] border border-[#e8e6dc]">
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
                          className="p-1.5 rounded-lg hover:bg-[#f0eee6] text-muted-foreground hover:text-foreground transition-colors"
                          title="Configure"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>

        </div>
      </div>
    </Layout>
  );
}
