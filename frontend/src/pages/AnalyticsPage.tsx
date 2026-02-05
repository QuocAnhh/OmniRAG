import Layout from '../components/Layout/Layout';

export default function AnalyticsPage() {
  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Analytics' }]}>
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-text-main dark:text-white mb-6">Bot Analytics & Insights</h1>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Messages', value: '45,231', change: '+12%', icon: 'chat' },
              { label: 'Unique Users', value: '8,492', change: '+8%', icon: 'people' },
              { label: 'Avg Session', value: '4.2m', change: '-2%', icon: 'schedule' },
              { label: 'Satisfaction', value: '4.8/5', change: '+0.3', icon: 'star' },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-primary">{stat.icon}</span>
                  <span className="text-sm text-text-muted dark:text-gray-400">{stat.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-bold text-text-main dark:text-white">{stat.value}</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">{stat.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart Placeholder */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6 mb-6">
            <h3 className="font-semibold text-text-main dark:text-white mb-4">Messages Over Time</h3>
            <div className="h-64 bg-background-off dark:bg-surface-dark rounded-lg flex items-center justify-center text-text-muted dark:text-gray-400">
              Chart placeholder - integrate Chart.js or Recharts
            </div>
          </div>

          {/* Recent Conversations Table */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border-light dark:border-border-dark">
              <h3 className="font-semibold text-text-main dark:text-white">Recent Conversations</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Query</th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Rating</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                <tr className="hover:bg-background-light dark:hover:bg-surface-dark">
                  <td className="px-6 py-4 text-text-main dark:text-white font-medium">user_8492</td>
                  <td className="px-6 py-4 text-text-muted dark:text-gray-400">How to reset password?</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">Website</span></td>
                  <td className="px-6 py-4 text-text-muted dark:text-gray-400">2 min ago</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-yellow-400 text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
