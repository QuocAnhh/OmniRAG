import Layout from '../components/Layout/Layout';

export default function AnalyticsPage() {
  // Mock data for 24-hour message volume
  const hourlyVolume = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: Math.floor(Math.random() * 1000 + 200)
  }));

  // Mock data for user segments
  const userSegments = [
    { label: 'New', value: 28, color: 'bg-blue-500' },
    { label: 'Returning', value: 52, color: 'bg-primary' },
    { label: 'Power Users', value: 15, color: 'bg-accent-500' },
    { label: 'Inactive', value: 5, color: 'bg-muted-foreground' }
  ];

  // Mock data for response times
  const responseTimeData = Array.from({ length: 10 }, (_, i) => ({
    time: `${i * 2}:00`,
    avgMs: Math.floor(Math.random() * 300 + 100)
  }));

  // Mock data for top queries
  const topQueries = [
    { query: 'How to reset password?', count: 1243, trend: 12 },
    { query: 'API documentation', count: 987, trend: -3 },
    { query: 'Billing questions', count: 756, trend: 28 },
    { query: 'Integration setup', count: 654, trend: 5 },
    { query: 'Account deletion', count: 423, trend: -8 }
  ];

  const conversations = [
    { user: 'USER_8492', query: 'How to reset password?', channel: 'WEB', time: '2m ago', rating: 5 },
    { user: 'USER_7231', query: 'API rate limits?', channel: 'API', time: '5m ago', rating: 4 },
    { user: 'USER_9103', query: 'Billing inquiry', channel: 'WEB', time: '8m ago', rating: 5 },
    { user: 'USER_5567', query: 'Integration help', channel: 'SLACK', time: '12m ago', rating: 3 },
    { user: 'USER_2891', query: 'Account settings', channel: 'WEB', time: '15m ago', rating: 5 }
  ];

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Analytics' }]}>
      <div className="flex flex-col gap-8">

        {/* Header */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-700 text-xs font-semibold mb-3 border border-accent/20">
            <span className="size-1.5 rounded-full bg-accent-500 animate-pulse"></span>
            Live Insights
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Performance Insights
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Monitor interaction quality, volume, and user satisfaction in real-time.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Messages', value: '45,231', change: '+12%', up: true, icon: 'chat', color: 'text-primary' },
            { label: 'Users', value: '8,492', change: '+8%', up: true, icon: 'group', color: 'text-blue-500' },
            { label: 'Avg Session', value: '4.2m', change: '-2%', up: false, icon: 'timer', color: 'text-orange-500' },
            { label: 'Satisfaction', value: '4.8/5', change: '+0.3', up: true, icon: 'star', color: 'text-yellow-500' },
            { label: 'Resolution', value: '94%', change: '+3%', up: true, icon: 'check_circle', color: 'text-accent-600' }
          ].map((stat) => (
            <div key={stat.label} className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className={`material-symbols-outlined ${stat.color} text-2xl bg-muted/30 p-2 rounded-xl`}>{stat.icon}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.up ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Charts Grid - 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Message Volume Chart */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">24h Message Volume</h3>
                <p className="text-xs text-muted-foreground">Volume distribution across day</p>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                Real-time
              </span>
            </div>
            <div className="flex items-end justify-between h-48 gap-1 pt-4 border-b border-border border-dashed">
              {hourlyVolume.map((item, idx) => {
                const height = (item.count / 1200) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-primary/20 hover:bg-primary transition-all relative group cursor-pointer rounded-t-sm"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl font-medium z-10">
                      {item.hour}:00 • {item.count} msgs
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted-foreground font-mono">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>

          {/* User Segments */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-1">User Segments</h3>
            <p className="text-xs text-muted-foreground mb-6">Distribution by user type</p>

            <div className="space-y-6">
              {userSegments.map((segment) => (
                <div key={segment.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{segment.label}</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">{segment.value}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${segment.color} transition-all rounded-full`}
                      style={{ width: `${segment.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-5 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Total Active Users</span>
              <span className="text-foreground font-bold text-lg">8,492</span>
            </div>
          </div>

          {/* Response Time Chart */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">Response Latency</h3>
                <p className="text-xs text-muted-foreground">Average processing time per response</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">187<span className="text-sm font-normal text-muted-foreground ml-1">ms</span></p>
                <p className="text-xs text-primary font-medium">Avg</p>
              </div>
            </div>
            <div className="space-y-4">
              {responseTimeData.map((item, idx) => {
                const width = (item.avgMs / 400) * 100;
                const color = item.avgMs < 150 ? 'bg-primary' : item.avgMs < 250 ? 'bg-accent-500' : 'bg-destructive';
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-12">{item.time}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all rounded-full opacity-80`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-12 text-right tabular-nums">{item.avgMs}ms</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Queries */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-1">Top Queries</h3>
            <p className="text-xs text-muted-foreground mb-6">Most frequent user intents (24h)</p>

            <div className="space-y-1">
              {topQueries.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 px-3 hover:bg-muted/30 rounded-xl transition-colors group">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm text-foreground font-medium truncate">{item.query}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">{item.count}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.trend > 0 ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'}`}>
                      {item.trend > 0 ? '+' : ''}{item.trend}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Conversations Table */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-muted/10">
            <h3 className="text-lg font-bold text-foreground">Recent Conversations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Query</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {conversations.map((conv, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-primary bg-primary/5 px-2 py-1 rounded-md">{conv.user}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground font-medium">{conv.query}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                        {conv.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{conv.time}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-base ${i < conv.rating ? 'text-yellow-400 material-symbols-outlined filled' : 'text-muted/30 material-symbols-outlined'}`}>
                            star
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
