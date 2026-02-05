import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';
import type { DashboardStats, QuickStats, Activity } from '../api/dashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, quickStatsRes, activitiesRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getQuickStats(),
        dashboardApi.getActivity(),
      ]);
      setStats(statsRes.data);
      setQuickStats(quickStatsRes.data);
      setActivities(activitiesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Dashboard' }]}>
      <div className="p-6 bg-transparent min-h-full animate-ray-slide-up relative">
        {/* Atmospheric Glows */}
        <div className="absolute top-[-10%] left-[-10%] size-[400px] bg-ray-blue/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] size-[400px] bg-ray-primary/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-[1200px] mx-auto flex flex-col gap-6 relative z-10">
          {/* Bento Grid Header */}
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-[28px] font-bold tracking-tight text-ray-text drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">System Intelligence</h2>
              <p className="text-[14px] text-ray-muted font-medium">Monitoring OmniRAG nodes and agent performance.</p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="group flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-ray-text rounded-ray-button border border-white/5 transition-all text-xs font-semibold backdrop-blur-md"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Sync Data
            </button>
          </div>

          {/* Main Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Stat Card 1 */}
            <div className="md:col-span-1 ray-card bg-ray-surface/40 backdrop-blur-xl p-4 flex flex-col justify-between min-h-[140px] border-white/5 hover:border-white/10 group">
              <div className="flex items-center gap-2 text-ray-muted group-hover:text-ray-text transition-colors">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Total Agents</span>
              </div>
              <div>
                <p className="text-[36px] font-bold text-ray-text tabular-nums tracking-tight">{stats?.total_bots || 0}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <p className="text-[11px] text-ray-muted font-medium">{quickStats?.active_bots || 0} online</p>
                </div>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="md:col-span-1 ray-card bg-ray-surface/40 backdrop-blur-xl p-4 flex flex-col justify-between min-h-[140px] border-white/5 hover:border-white/10 group">
              <div className="flex items-center gap-2 text-ray-muted group-hover:text-ray-text transition-colors">
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Average Latency</span>
              </div>
              <div>
                <p className="text-[36px] font-bold text-ray-text tabular-nums tracking-tight">{stats?.avg_response_time || '0ms'}</p>
                <p className="text-[11px] text-ray-blue font-medium mt-1">Faster than 92% of nodes</p>
              </div>
            </div>

            {/* Stat Card 3 (Bento Large) */}
            <div className="md:col-span-2 md:row-span-2 ray-card bg-ray-surface/30 backdrop-blur-2xl p-6 flex flex-col gap-6 border-white/5 hover:border-white/10 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-[120px]">insights</span>
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2 text-ray-muted group-hover:text-ray-text transition-colors">
                  <span className="material-symbols-outlined text-[18px]">analytics</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Intelligence Stream</span>
                </div>
                <div className="flex gap-1">
                  {['7D', '24H'].map(t => (
                    <button key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded border border-white/5 transition-colors ${t === '7D' ? 'bg-white/10 text-ray-text' : 'text-ray-muted hover:bg-white/5'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex items-end gap-2 py-4 relative z-10">
                {[40, 65, 50, 85, 70, 45, 90, 60, 75, 55, 80, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-ray-blue/20 to-ray-blue/60 group-hover:to-ray-blue rounded-t-[2px] transition-all cursor-pointer relative"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
                  >
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-ray-muted font-mono tracking-widest relative z-10 opacity-60">
                <span>PERIOD_START</span><span>ACTIVE_MONITORING</span><span>PERIOD_END</span>
              </div>
            </div>

            {/* Stat Card 4 */}
            <div className="md:col-span-1 ray-card bg-ray-surface/40 backdrop-blur-xl p-4 flex flex-col justify-between min-h-[140px] border-white/5 hover:border-white/10 group">
              <div className="flex items-center gap-2 text-ray-muted group-hover:text-ray-text transition-colors">
                <span className="material-symbols-outlined text-[18px]">neurology</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Total Tokens</span>
              </div>
              <div>
                <p className="text-[36px] font-bold text-ray-text tabular-nums tracking-tight">{stats?.messages_today || 0}</p>
                <p className="text-[11px] text-ray-muted font-medium mt-1">Last 24 hours</p>
              </div>
            </div>

            {/* Stat Card 5 */}
            <div className="md:col-span-1 ray-card bg-ray-surface/40 backdrop-blur-xl p-4 flex flex-col justify-between min-h-[140px] border-white/5 hover:border-white/10 group">
              <div className="flex items-center gap-2 text-ray-muted group-hover:text-ray-text transition-colors">
                <span className="material-symbols-outlined text-[18px]">sensors</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Live Sessions</span>
              </div>
              <div>
                <p className="text-[36px] font-bold text-ray-text tabular-nums tracking-tight">{stats?.active_sessions || 0}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="size-1.5 rounded-full bg-ray-blue animate-pulse shadow-[0_0_8px_rgba(88,166,255,0.5)]"></div>
                  <p className="text-[11px] text-ray-muted font-medium">Real-time tracking</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Grid Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Activity (Raycast List Style) */}
            <div className="lg:col-span-2 ray-card bg-ray-surface/20 backdrop-blur-md flex flex-col border-white/5">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ray-muted">Live Intelligence Feed</span>
                <Link to="/analytics" className="text-[10px] font-bold text-ray-blue hover:text-white transition-colors uppercase tracking-widest">Open Stream ↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
                {activities.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-[48px] text-ray-muted/20">bubble_chart</span>
                    <p className="text-[13px] text-ray-muted/50 font-medium tracking-wide">Awaiting system signals...</p>
                  </div>
                ) : (
                  activities.map((activity, idx) => (
                    <div key={idx} className="ray-list-item group bg-transparent hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all py-3">
                      <div className="size-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-ray-primary group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[20px]">history_edu</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-ray-text truncate tracking-tight">
                            {activity.bot_name}
                          </p>
                          <span className="size-1 rounded-full bg-ray-muted/30"></span>
                          <span className="text-[10px] text-ray-muted font-mono">{formatTime(activity.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-ray-muted truncate mt-0.5 group-hover:text-ray-text/70 transition-colors uppercase tracking-wider">{activity.message}</p>
                      </div>
                      <span className="text-[10px] font-bold text-ray-muted group-hover:text-ray-primary transition-colors">DETAILS</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions (Control Center Style) */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="ray-card bg-ray-surface/40 backdrop-blur-xl p-6 flex flex-col gap-4 border-white/5">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ray-muted mb-2">Neural Controls</span>
                <Link to="/bots/new" className="group flex items-center gap-3 px-4 py-3 bg-ray-primary/10 hover:bg-ray-primary text-ray-primary hover:text-white rounded-ray-button text-sm font-bold transition-all border border-ray-primary/20 shadow-[0_0_20px_rgba(255,99,99,0.05)]">
                  <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform">add</span>
                  Initialize New Agent
                  <span className="ml-auto text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">⌘N</span>
                </Link>
                <Link to="/documents" className="group flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 text-ray-text rounded-ray-button border border-white/5 text-sm font-bold transition-all">
                  <span className="material-symbols-outlined text-[20px] group-hover:-translate-y-0.5 transition-transform">upload_file</span>
                  Knowledge Ingest
                  <span className="ml-auto text-[10px] text-ray-muted font-mono">⌘U</span>
                </Link>
                <Link to="/settings" className="group flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 text-ray-text rounded-ray-button border border-white/5 text-sm font-bold transition-all">
                  <span className="material-symbols-outlined text-[20px] group-hover:rotate-45 transition-transform">settings_input_component</span>
                  Core Configuration
                  <span className="ml-auto text-[10px] text-ray-muted font-mono">⌘S</span>
                </Link>
              </div>

              {/* Status Indicator (High-End) */}
              <div className="ray-card bg-ray-surface/60 backdrop-blur-2xl p-5 flex flex-col gap-4 border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-[14px] font-bold text-ray-text tracking-tight">Pulse Status: Nominal</p>
                    <p className="text-[10px] text-ray-muted font-mono uppercase tracking-[0.2em]">All systems operational</p>
                  </div>
                  <div className="size-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px] animate-pulse">check_circle</span>
                  </div>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[99.9%] shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
