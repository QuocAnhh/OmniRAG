import Layout from '../components/Layout/Layout';

export default function SettingsPage() {
  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Settings' }]}>
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-700 text-xs font-semibold mb-3 border border-accent/20">
            <span className="material-symbols-outlined text-[16px]">settings</span>
            Configuration
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Account & Preferences
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal profile, security settings, and API access keys.
          </p>
        </div>

        {/* Profile Settings */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Update your personal information</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-50 text-success-700 text-xs font-bold border border-success-200">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Verified
            </span>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <label htmlFor="fullName" className="text-sm font-semibold text-foreground">Full Name</label>
              <input
                id="fullName"
                type="text"
                className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                placeholder="John Doe"
                defaultValue="System Administrator"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                placeholder="admin@example.com"
                defaultValue="admin@omnirag.local"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <label htmlFor="timezone" className="text-sm font-semibold text-foreground">Timezone</label>
                <select id="timezone" className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm appearance-none">
                  <option>UTC-05:00 (EST)</option>
                  <option>UTC+00:00 (GMT)</option>
                  <option>UTC+07:00 (ICT)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="language" className="text-sm font-semibold text-foreground">Language</label>
                <select id="language" className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm appearance-none">
                  <option>English (US)</option>
                  <option>Vietnamese</option>
                  <option>Japanese</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-3">
              <button className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[20px]">save</span>
                Save Changes
              </button>
              <button className="px-6 py-2.5 bg-background border border-border text-foreground font-semibold rounded-xl hover:bg-muted/50 transition-all">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground">Security Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">Password & Authentication</p>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <label htmlFor="currentPassword" className="text-sm font-semibold text-foreground">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                placeholder="••••••••"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <label htmlFor="newPassword" className="text-sm font-semibold text-foreground">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <input type="checkbox" id="twoFactor" className="size-5 accent-primary cursor-pointer rounded border-gray-300 text-primary focus:ring-primary" />
              <label htmlFor="twoFactor" className="text-sm text-foreground font-medium cursor-pointer">
                Enable two-factor authentication (2FA)
              </label>
            </div>

            <div className="pt-6 border-t border-border">
              <button className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                Update Password
              </button>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">API Key Management</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage authentication tokens for programmatic access</p>
            </div>
            <button className="px-4 py-2 bg-muted hover:bg-primary/10 text-foreground hover:text-primary border border-border hover:border-primary/30 font-semibold rounded-xl transition-all flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Generate Key
            </button>
          </div>

          <div className="space-y-4">
            {[
              { key: 'omn_pk_live_8a7f2b3c4d5e6f7g', name: 'Production Key', created: '2 days ago', lastUsed: '5m ago', active: true },
              { key: 'omn_pk_test_1a2b3c4d5e6f7g8h', name: 'Development Key', created: '1 week ago', lastUsed: '2h ago', active: true },
              { key: 'omn_pk_live_9h8g7f6e5d4c3b2a', name: 'Legacy Key', created: '3 months ago', lastUsed: 'never', active: false }
            ].map((apiKey, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-muted/20 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all gap-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1 size-10 rounded-lg bg-background border border-border shadow-sm flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">vpn_key</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-foreground">{apiKey.name}</p>
                      {apiKey.active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success-50 text-success-700 uppercase tracking-wide">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wide">Revoked</span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded border border-border/50 inline-block mb-2">{apiKey.key}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Created: {apiKey.created}</span>
                      <span>Last used: {apiKey.lastUsed}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button className="flex-1 sm:flex-none p-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20" title="Copy Key">
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                  <button className="flex-1 sm:flex-none p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors border border-transparent hover:border-destructive/20" title="Revoke Key">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-destructive/5 rounded-2xl border border-destructive/20 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mt-1">Irreversible actions that affect your account data</p>
          </div>

          <div className="flex items-center justify-between p-5 bg-background rounded-xl border border-destructive/20">
            <div>
              <p className="text-sm font-bold text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-1">Permanently delete your account and all associated data</p>
            </div>
            <button className="px-4 py-2 bg-destructive/10 text-destructive font-semibold text-sm rounded-lg hover:bg-destructive hover:text-white transition-all">
              Delete Account
            </button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
