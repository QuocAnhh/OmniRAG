
import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { analyticsApi } from '../api/analytics';
import type { AnalyticsStats, ConversationItem, ResponseTimeDistribution, TopQuery } from '../api/analytics';
import { Button } from '../components/ui/Button';

// Simple Bar Chart Component for Distribution
const BarChart = ({ data }: { data: ResponseTimeDistribution[] }) => {
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="flex items-end gap-2 h-40 w-full pt-6">
            {data.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="text-xs font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.count}
                    </div>
                    <div
                        className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-sm transition-all relative group-hover:shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                        style={{ height: `${(item.count / max) * 100}%` }}
                    />
                    <div className="text-[10px] text-muted-foreground rotate-0 truncate w-full text-center">
                        {item.range}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function AnalyticsPage() {
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [distributon, setDistribution] = useState<ResponseTimeDistribution[]>([]);
    const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsData, convsData, distData, topData] = await Promise.all([
                analyticsApi.getStats(),
                analyticsApi.getConversations(20),
                analyticsApi.getResponseTimeDistribution(),
                analyticsApi.getTopQueries(5)
            ]);
            setStats(statsData);
            setConversations(convsData);
            setDistribution(distData);
            setTopQueries(topData);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Auto refresh every 30s
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Analytics' }]}>
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Analytics Overview</h1>
                        <p className="text-muted-foreground mt-1">Real-time insights into agent performance and user interactions.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={loadData} isLoading={loading}>
                            <span className="material-symbols-outlined text-[18px] mr-2">refresh</span>
                            Refresh
                        </Button>
                        <div className="bg-muted px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground flex items-center">
                            <span className="size-2 bg-success-500 rounded-full mr-2 animate-pulse"></span>
                            Live
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon="forum"
                        label="Total Messages"
                        value={stats?.total_messages.toLocaleString() || '0'}
                        color="text-blue-500"
                        bg="bg-blue-500/10"
                    />
                    <StatCard
                        icon="avg_time"
                        label="Avg Response Time"
                        value={stats?.avg_response_time || '0s'}
                        color="text-orange-500"
                        bg="bg-orange-500/10"
                    />
                    <StatCard
                        icon="group"
                        label="Active Users"
                        value={stats?.active_users.toLocaleString() || '0'}
                        color="text-green-500"
                        bg="bg-green-500/10"
                    />
                    <StatCard
                        icon="star"
                        label="CSAT Score"
                        value={stats?.avg_csat_score.toFixed(1) || '0.0'}
                        color="text-purple-500"
                        bg="bg-purple-500/10"
                    />
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Response Time Distribution */}
                    <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6">
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">bar_chart</span>
                            Response Time Distribution
                        </h3>
                        <div className="bg-muted/10 rounded-xl p-4">
                            <BarChart data={distributon} />
                        </div>
                        <div className="flex justify-between items-center mt-4 text-xs text-muted-foreground">
                            <span>Faster</span>
                            <span>Slower</span>
                        </div>
                    </div>

                    {/* Top Queries */}
                    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col">
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent-500">trending_up</span>
                            Top Queries
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {topQueries.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No data yet</div>
                            ) : (
                                topQueries.map((q, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <span className="text-sm font-medium text-foreground truncate max-w-[180px]" title={q.query}>
                                            {q.query}
                                        </span>
                                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-md">
                                            {q.count}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Conversations */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/10">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <span className="material-symbols-outlined text-muted-foreground">history</span>
                            Recent Conversations
                        </h3>
                        <Button variant="ghost" size="sm" className="text-xs">View All</Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3">Time</th>
                                    <th className="px-6 py-3">Agent</th>
                                    <th className="px-6 py-3 w-1/3">User Query</th>
                                    <th className="px-6 py-3 w-1/3">Response</th>
                                    <th className="px-6 py-3 text-right">Latency</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50 text-sm">
                                {loading && conversations.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4">
                                                <div className="h-4 bg-muted/50 rounded w-full"></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : conversations.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            No conversations recorded yet. Use the Playground to generate data.
                                        </td>
                                    </tr>
                                ) : (
                                    conversations.map((conv) => (
                                        <tr key={conv.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(conv.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                {conv.bot_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="truncate max-w-[200px] text-muted-foreground" title={conv.user_message}>
                                                    {conv.user_message}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="truncate max-w-[200px] text-muted-foreground" title={conv.response}>
                                                    {conv.response}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-xs">
                                                <span className={`px-2 py-1 rounded ${conv.response_time < 1 ? 'bg-success-50 text-success-700' :
                                                    conv.response_time < 3 ? 'bg-warning-50 text-warning-700' :
                                                        'bg-destructive-50 text-destructive-700'
                                                    }`}>
                                                    {conv.response_time?.toFixed(2)}s
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function StatCard({ icon, label, value, color, bg }: { icon: string, label: string, value: string, color: string, bg: string }) {
    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
                    <h4 className="text-2xl font-bold text-foreground">{value}</h4>
                </div>
                <div className={`size-10 rounded-xl ${bg} ${color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
        </div>
    );
}
