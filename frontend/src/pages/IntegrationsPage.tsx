import Layout from '../components/Layout/Layout';

export default function IntegrationsPage() {
  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Integrations' }]}>
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-text-main dark:text-white mb-6">Channel Integrations</h1>
          <p className="text-text-muted dark:text-gray-400">Connect your AI agent to your customers' favorite platforms</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {['Website Widget', 'Telegram', 'Zalo', 'WhatsApp', 'Slack', 'API'].map((channel) => (
              <div key={channel} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">extension</span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-main dark:text-white">{channel}</h3>
                </div>
                <p className="text-sm text-text-muted dark:text-gray-400 mb-4">Connect and configure {channel} integration</p>
                <button className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                  Configure
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
