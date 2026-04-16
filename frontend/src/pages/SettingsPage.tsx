import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import toast from 'react-hot-toast';
import { usersApi, type APIKey } from '../api/users';

export default function SettingsPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    loadKeys();
  }, []);

  const loadUser = async () => {
    try {
      const res = await usersApi.getCurrentUser();
      const user = res.data;
      setFullName((user as any).full_name || '');
      setEmail(user.email || '');
    } catch {
      toast.error('Could not load profile. Please refresh the page.');
    } finally {
      setLoadingUser(false);
    }
  };

  const loadKeys = async () => {
    try {
      const res = await usersApi.listAPIKeys();
      setApiKeys(res.data);
    } catch {
      // non-critical, silently fail
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      await usersApi.updateProfile({ full_name: fullName, email });
      toast.success('Profile updated successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to update profile. Please try again.';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setSavingPassword(true);
    try {
      await usersApi.updateProfile({ current_password: currentPassword, new_password: newPassword });
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to update password. Check your current password and try again.';
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key.');
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await usersApi.createAPIKey({ name: newKeyName.trim() });
      const created = res.data;
      setApiKeys(prev => [created, ...prev]);
      setNewKeyName('');
      if (created.key) {
        setRevealedKey(created.key);
        toast.success('API key created. Copy it now — it will not be shown again.', { duration: 8000 });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create API key. Please try again.';
      toast.error(msg);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Revoke "${keyName}"? Any applications using this key will stop working.`)) return;
    try {
      await usersApi.revokeAPIKey(keyId);
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success(`"${keyName}" has been revoked.`);
    } catch {
      toast.error('Failed to revoke API key. Please try again.');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => toast.success('Copied to clipboard.'));
  };

  const inputClasses = "w-full px-4 py-2.5 rounded-feature bg-white border border-border-warm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary text-sm placeholder:text-text-muted";

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Settings' }]}>
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary font-serif">
            Settings
          </h1>
          <p className="text-text-tertiary mt-1.5 text-sm">
            Profile, security, and API access.
          </p>
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-feature border border-border-warm shadow-whisper p-6 sm:p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Profile Settings</h2>
              <p className="text-xs text-text-tertiary mt-1">Update your personal information</p>
            </div>
          </div>

          {loadingUser ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-warm-cream rounded-feature w-full" />
              <div className="h-10 bg-warm-cream rounded-feature w-full" />
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <label htmlFor="fullName" className="text-xs font-medium text-text-secondary">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={inputClasses}
                  placeholder="Your full name"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="email" className="text-xs font-medium text-text-secondary">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClasses}
                  placeholder="you@example.com"
                />
              </div>

              <div className="pt-6 border-t border-border-warm flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/85 text-white text-sm font-medium rounded-comfort transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingProfile ? (
                    <span className="size-4 border-2 border-primary/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[20px]">save</span>
                  )}
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-feature border border-border-warm shadow-whisper p-6 sm:p-8">
          <div className="mb-8">
            <h2 className="text-base font-semibold text-text-primary">Security Settings</h2>
            <p className="text-xs text-text-tertiary mt-1">Password & Authentication</p>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-2">
              <label htmlFor="currentPassword" className="text-xs font-medium text-text-secondary">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-feature bg-warm-cream/50 border border-border-warm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary text-sm"
                placeholder="••••••••"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <label htmlFor="newPassword" className="text-xs font-medium text-text-secondary">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className={inputClasses}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="confirmPassword" className="text-xs font-medium text-text-secondary">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={inputClasses}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border-warm">
              <button
                onClick={handleUpdatePassword}
                disabled={savingPassword}
                className="px-6 py-2.5 bg-primary text-white font-semibold rounded-comfort hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {savingPassword ? (
                  <span className="size-4 border-2 border-primary/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                )}
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-feature border border-border-warm shadow-whisper p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-text-primary">API Key Management</h2>
              <p className="text-xs text-text-tertiary mt-1">Manage authentication tokens for programmatic access</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerateKey()}
              placeholder="Key name (e.g. Production)"
              className={inputClasses}
            />
            <button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="px-4 py-2 bg-warm-cream hover:bg-primary/10 text-text-tertiary hover:text-primary border border-border-warm hover:border-primary/25 font-medium rounded-feature transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {generatingKey ? (
                <span className="size-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
              )}
              {generatingKey ? 'Generating...' : 'Generate Key'}
            </button>
          </div>

          {revealedKey && (
            <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-feature flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-700">Copy this key now — it will not be shown again.</p>
                <p className="text-xs font-mono text-text-primary mt-1 break-all">{revealedKey}</p>
              </div>
              <button
                onClick={() => { handleCopyKey(revealedKey); setRevealedKey(null); }}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 rounded-comfort border border-amber-500/30 transition-all"
              >
                Copy & Dismiss
              </button>
            </div>
          )}

          {loadingKeys ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map(i => <div key={i} className="h-20 bg-warm-cream rounded-feature" />)}
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">No API keys yet. Generate one above.</p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-warm-ivory rounded-feature border border-border-warm hover:border-warm-sand hover:bg-warm-cream transition-all gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 size-10 rounded-comfort bg-white border border-border-warm shadow-ring-subtle flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[22px]">vpn_key</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-text-primary">{apiKey.name}</p>
                        {apiKey.is_active ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Active</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warm-cream text-text-tertiary border border-border-warm">Revoked</span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-text-tertiary bg-white px-2 py-1 rounded border border-border-warm/50 inline-block mb-2">
                        {apiKey.key_prefix}••••••••
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                        {apiKey.last_used_at && <span>Last used: {new Date(apiKey.last_used_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                  {apiKey.is_active && (
                    <button
                      onClick={() => handleRevokeKey(apiKey.id, apiKey.name)}
                      className="flex-shrink-0 p-2 rounded-comfort text-text-tertiary hover:bg-rose-500/10 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-500/20"
                      title="Revoke Key"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="rounded-feature border border-rose-500/15 bg-rose-500/5 p-6 sm:p-8">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-rose-600">Danger zone</h2>
            <p className="text-xs text-text-tertiary mt-1">Irreversible actions that affect your account.</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-warm-ivory rounded-feature border border-rose-200">
            <div>
              <p className="text-sm font-medium text-text-primary">Delete account</p>
              <p className="text-xs text-text-tertiary mt-0.5">Permanently removes your account and all data.</p>
            </div>
            <button
              onClick={() => toast.error('Contact support to delete your account.')}
              className="px-4 py-2 bg-rose-500/10 text-rose-600 font-medium text-xs rounded-comfort hover:bg-rose-500 hover:text-white transition-all"
            >
              Delete account
            </button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
