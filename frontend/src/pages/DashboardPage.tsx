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
import { EmptyState } from '../components/ui/EmptyState';
import { EmptyBots, EmptyChat } from '../components/illustrations';
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
          <div className="animate-pulse bg-warm-cream rounded-feature h-20" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-warm-cream rounded-feature h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="animate-pulse bg-warm-cream rounded-hero h-80 lg:col-span-3" />
            <div className="animate-pulse bg-warm-cream rounded-hero h-80 lg:col-span-2" />
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 py-6 rounded-feature bg-white border border-border-warm relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-text-muted text-xs mb-1.5 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-2xl font-semibold font-serif text-text-primary tracking-tight">{greeting}, {firstName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-text-tertiary">
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
            className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-comfort transition-all shadow-ring-primary"
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
              className="flex flex-col gap-3 p-5 rounded-feature bg-white border border-border-warm shadow-whisper-sm"
            >
              <div
                className="size-8 rounded-comfort bg-warm-cream border border-border-warm flex items-center justify-center text-text-tertiary flex-shrink-0 animate-float"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                {tile.icon}
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-text-primary/90 tabular-nums tracking-tight">{tile.value}</div>
                <div className="text-[11px] text-text-muted mt-0.5 font-medium">{tile.label}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Attention Banner ────────────────────────────────── */}
        {botsNeedingDocs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-5 py-3.5 rounded-feature border border-amber-500/30 bg-amber-500/5 text-sm"
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
            className="lg:col-span-3 bg-white rounded-hero border border-border-warm shadow-whisper overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-border-warm flex items-center justify-between">
              <h3 className="font-semibold font-serif text-sm text-text-primary flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Recent Conversations
              </h3>
            </div>

            {conversations.length === 0 ? (
              <EmptyState
                illustration={<EmptyChat size="sm" />}
                title="No conversations yet"
                description="Start chatting with your agents to see history here."
                illustrationTone="muted"
                action={
                  bots[0] ? (
                    <Link to={`/bots/${bots[0].id}/chat`} className="text-xs text-primary hover:underline font-medium">
                      Start your first chat →
                    </Link>
                  ) : undefined
                }
                className="py-16"
              />
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
                }}
                className="divide-y divide-border-warm"
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
                      className="flex items-center gap-4 px-6 py-4 hover:bg-warm-cream transition-colors group"
                    >
                      <div className="size-9 rounded-comfort flex-shrink-0 flex items-center justify-center bg-warm-cream border border-border-warm">
                        <span className={`material-symbols-outlined text-[16px] ${dm.iconColor}`}>{dm.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-text-secondary">{conv.bot_name}</span>
                          <span className="text-[10px] text-text-muted/40">{formatTimeAgo(conv.timestamp)}</span>
                        </div>
                        <p className="text-sm text-text-primary/80 truncate">{conv.user_message}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted/30 group-hover:text-text-tertiary/70 transition-colors flex-shrink-0" />
                    </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>

          {/* RIGHT: Agent Status */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 bg-white rounded-hero border border-border-warm shadow-whisper overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-border-warm flex items-center justify-between">
              <h3 className="font-semibold font-serif text-sm text-text-primary flex items-center gap-2">
                <BotIcon className="w-4 h-4 text-primary" />
                Agents
              </h3>
              <Link to="/bots" className="text-xs text-text-tertiary hover:text-primary transition-colors">
                View all →
              </Link>
            </div>

            {bots.length === 0 ? (
              <EmptyState
                illustration={<EmptyBots size="sm" />}
                title="No agents yet"
                description="Create your first agent to start querying your knowledge base."
                illustrationTone="primary"
                action={
                  <Link
                    to="/bots/new"
                    className="px-5 py-2.5 bg-primary hover:bg-primary/85 active:scale-[0.97] text-white text-sm font-medium rounded-comfort transition-all shadow-ring-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create agent
                  </Link>
                }
                className="py-16"
              />
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
                }}
                className="divide-y divide-border-warm flex-1"
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
                      className="flex items-center gap-3 px-5 py-4 group hover:bg-warm-cream transition-colors"
                    >
                      <div className="size-9 rounded-comfort flex-shrink-0 flex items-center justify-center bg-warm-cream border border-border-warm">
                        <span className={`material-symbols-outlined text-[16px] ${dm.iconColor}`}>{dm.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-text-primary truncate">{bot.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {status === 'ready' && (
                            <>
                              <span className="size-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span className="text-[11px] text-text-tertiary">{docs!.count} doc{docs!.count !== 1 ? 's' : ''}</span>
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
                              <span className="size-1.5 rounded-full bg-text-muted/25 flex-shrink-0" />
                              <span className="text-[11px] text-text-muted/50">No documents</span>
                            </>
                          )}
                          {status === 'loading' && <span className="text-[11px] text-text-muted/30">—</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <Link
                          to={`/bots/${bot.id}/chat`}
                          className="p-1.5 rounded-comfort hover:bg-primary/20 text-primary transition-colors"
                          title="Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/bots/${bot.id}/config`}
                          className="p-1.5 rounded-comfort hover:bg-warm-cream text-text-muted hover:text-text-primary transition-colors"
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
