import Layout from '../components/Layout/Layout';

export default function IntegrationsPage() {
  const integrations = [
    { name: 'Website Widget', status: 'active', connections: 3, icon: 'widgets', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { name: 'Telegram', status: 'active', connections: 2, icon: 'send', color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
    { name: 'Zalo', status: 'inactive', connections: 0, icon: 'chat_bubble', color: 'text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { name: 'WhatsApp', status: 'active', connections: 1, icon: 'forum', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { name: 'Slack', status: 'inactive', connections: 0, icon: 'tag', color: 'text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { name: 'REST API', status: 'active', connections: 5, icon: 'api', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' }
  ];

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Integrations' }]}>
      <div className="flex flex-col gap-8">

        {/* Header */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold mb-3 border border-border">
            <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
            Connectivity Ecosystem
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Connect Your Channels
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Seamlessly integrate your AI agents with the platforms your customers use every day.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Channels</p>
            <p className="text-3xl font-bold text-foreground">{integrations.length}</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active</p>
            <p className="text-3xl font-bold text-primary">
              {integrations.filter(i => i.status === 'active').length}
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Connections</p>
            <p className="text-3xl font-bold text-accent-500">
              {integrations.reduce((acc, i) => acc + i.connections, 0)}
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Msgs/Day</p>
            <p className="text-3xl font-bold text-foreground/80">12.4K</p>
          </div>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div key={integration.name} className="group bg-card hover:bg-muted/30 border border-border hover:border-primary/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 relative">

              {/* Status Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${integration.status === 'active' ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`}></span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {integration.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${integration.status === 'active'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted text-muted-foreground border-border'
                  }`}>
                  {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Icon + Name */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`size-14 rounded-2xl ${integration.bg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <span className={`material-symbols-outlined text-3xl ${integration.color}`}>
                    {integration.icon}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {integration.name}
                </h3>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-border/50">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Connections
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {integration.connections}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Uptime
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {integration.status === 'active' ? '99.9%' : '—'}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button className="w-full py-2.5 bg-muted/50 hover:bg-primary/10 text-foreground hover:text-primary rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-primary-foreground">
                <span className="material-symbols-outlined text-lg">settings</span>
                Configure
              </button>
            </div>
          ))}
        </div>

        {/* API Keys Section */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">API Credentials</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage access tokens and webhooks for programmatic access.</p>
            </div>
            <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-lg">add</span>
              New Key
            </button>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Production API Key', key: 'pk_live_8a7f2b3c...', created: '2025-01-15', lastUsed: '2h ago' },
              { name: 'Development API Key', key: 'pk_test_1d9e4f6g...', created: '2025-01-10', lastUsed: '5m ago' }
            ].map((apiKey, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/20 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-colors group">
                <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
                  <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent-600">
                    <span className="material-symbols-outlined text-xl">key</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{apiKey.name}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50 inline-block">{apiKey.key}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between w-full sm:w-auto gap-6 pl-14 sm:pl-0">
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last Used</p>
                    <p className="text-sm font-medium text-foreground">{apiKey.lastUsed}</p>
                  </div>
                  <button className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Revoke Key">
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
