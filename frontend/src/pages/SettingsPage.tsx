import Layout from '../components/Layout/Layout';

export default function SettingsPage() {
  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Settings' }]}>
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-text-main dark:text-white mb-2">Settings</h1>
          <p className="text-text-muted dark:text-gray-400 mb-8">Manage your account and workspace preferences</p>

          {/* Profile Settings */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-text-main dark:text-white mb-6">Profile Settings</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                  placeholder="john@example.com"
                />
              </div>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium">
                Save Changes
              </button>
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
            <h2 className="text-xl font-semibold text-text-main dark:text-white mb-6">API Keys</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border-light dark:border-border-dark rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400">key</span>
                  <div>
                    <p className="font-mono text-sm text-slate-900 dark:text-white">omn_••••••••••••••••</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Created 2 days ago</p>
                  </div>
                </div>
                <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium">
                  Revoke
                </button>
              </div>
              <button className="w-full px-4 py-2 border-2 border-dashed border-border-light dark:border-border-dark text-text-muted dark:text-gray-400 rounded-lg hover:border-primary hover:text-primary transition-colors font-medium">
                + Generate New API Key
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
