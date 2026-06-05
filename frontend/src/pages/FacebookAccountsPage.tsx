import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { channelAccountsApi } from '../api/channelAccounts';
import { botsApi } from '../api/bots';
import { apiClient } from '../api/client';
import type { ChannelAccount } from '../types/api';

const STATUS_META: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-800 border-green-300' },
  connecting: { label: 'Connecting', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  disconnected: { label: 'Disconnected', color: 'bg-red-100 text-red-800 border-red-300' },
  error: { label: 'Error', color: 'bg-red-100 text-red-800 border-red-300' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-300' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export default function FacebookAccountsPage() {
  const { id: botId } = useParams<{ id: string }>();
  const [botName, setBotName] = useState('');
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbCookiesText, setFbCookiesText] = useState('');
  const [fbCookiesError, setFbCookiesError] = useState('');
  const fbFileInputRef = useRef<HTMLInputElement | null>(null);
  const [loginMode, setLoginMode] = useState<'password' | 'cookies'>('password');
  const [fbUsername, setFbUsername] = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [fbTwofa, setFbTwofa] = useState('');
  const [showTwofa, setShowTwofa] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!botId) return;
    try {
      const data = await channelAccountsApi.listFbAccounts(botId);
      setAccounts(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    if (botId) {
      botsApi.get(botId).then((r: any) => setBotName(r.data?.name || '')).catch(() => {});
      fetchAccounts();
    }
  }, [botId, fetchAccounts]);

  const handleDisconnect = async () => {
    const { confirmAction } = await import('../lib/confirmAction');
    const confirmed = await confirmAction({
      title: 'Disconnect Facebook Messenger?',
      text: 'Bot will stop replying in Messenger groups.',
      confirmText: 'Disconnect',
      tone: 'danger',
    });
    if (!confirmed || !botId) return;
    try {
      await apiClient.post(`/api/v1/channels/facebook/disconnect/${botId}`);
      toast.success('Disconnected');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to disconnect');
    }
  };

  const handleCredentialsConnect = async () => {
    if (!botId || !fbUsername.trim() || !fbPassword.trim()) {
      toast.error('Please enter email and password');
      return;
    }
    setFbConnecting(true);
    const t = toast.loading('Logging in to Facebook...');
    try {
      const body: any = { bot_id: botId, username: fbUsername.trim(), password: fbPassword };
      if (showTwofa && fbTwofa.trim()) body.twofa_code = fbTwofa.trim();
      await apiClient.post('/api/v1/channels/facebook/connect/credentials', body);
      setFbUsername(''); setFbPassword(''); setFbTwofa('');
      toast.success('Connected!', { id: t });
      fetchAccounts();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Login failed';
      toast.error(detail, { id: t });
      // If 2FA required, show the field
      if (detail.toLowerCase().includes('two') || detail.toLowerCase().includes('2fa') || detail.toLowerCase().includes('1348162')) {
        setShowTwofa(true);
      }
    } finally { setFbConnecting(false); }
  };

  const handleConnect = async () => {
    if (!botId || !fbCookiesText.trim()) {
      setFbCookiesError('Please paste cookies JSON first.');
      return;
    }
    let parsed: any;
    try { parsed = JSON.parse(fbCookiesText.trim()); }
    catch { setFbCookiesError('Not valid JSON — re-export from Cookie-Editor.'); return; }

    const cookiesList: any[] = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.cookies) ? parsed.cookies : []);
    if (!cookiesList.length) { setFbCookiesError('JSON does not contain a cookies array.'); return; }
    const names = new Set(cookiesList.map((c: any) => c?.name || c?.key));
    const required = ['c_user', 'xs', 'fr', 'datr', 'sb'];
    const missing = required.filter((n) => !names.has(n));
    if (missing.length) { setFbCookiesError(`Missing required cookies: ${missing.join(', ')}.`); return; }

    setFbConnecting(true);
    const t = toast.loading('Connecting Facebook Messenger...');
    try {
      await apiClient.post('/api/v1/channels/facebook/connect', { bot_id: botId, cookies: cookiesList });
      setFbCookiesText('');
      toast.success('Connected!', { id: t });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Connection failed', { id: t });
    } finally { setFbConnecting(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to={`/bots/${botId}/config?tab=channels`} className="text-sm text-muted-foreground hover:text-primary mb-1 block">
          ← Back to {botName || 'Bot'} settings
        </Link>
        <h1 className="text-2xl font-bold">Facebook Messenger Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect and manage Facebook accounts for this bot.</p>
      </div>

      {/* Connect Form */}
      <div className="p-6 bg-black/10 rounded-2xl border border-white/5 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">Connect New Account</h3>
          <div className="flex bg-muted/30 rounded-lg p-0.5">
            <button onClick={() => setLoginMode('password')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${loginMode === 'password' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Email/Password
            </button>
            <button onClick={() => setLoginMode('cookies')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${loginMode === 'cookies' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Cookies JSON
            </button>
          </div>
        </div>

        {loginMode === 'password' ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Email or Phone</label>
              <input type="text" placeholder="facebook@email.com" value={fbUsername}
                onChange={(e) => setFbUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Password</label>
              <input type="password" placeholder="Facebook password" value={fbPassword}
                onChange={(e) => setFbPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            {!showTwofa ? (
              <button type="button" onClick={() => setShowTwofa(true)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors pl-1">
                + I have 2-Factor Authentication enabled
              </button>
            ) : (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">2FA Code</label>
                <input type="text" placeholder="6-digit code from Google Authenticator" value={fbTwofa}
                  onChange={(e) => setFbTwofa(e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" />
              </div>
            )}
            <button onClick={handleCredentialsConnect} disabled={fbConnecting || !fbUsername.trim() || !fbPassword.trim()}
              className="px-6 py-3 bg-[#0866FF] text-white font-bold rounded-xl hover:bg-[#0866FF]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {fbConnecting ? <><span className="animate-spin">⏳</span> Logging in...</> : <><span className="material-symbols-outlined text-sm">login</span> Login & Connect</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Facebook Cookies (JSON)</label>
              <textarea
                placeholder='Paste JSON from Cookie-Editor — supports {"url":"...","cookies":[...]} or [...]'
                value={fbCookiesText} onChange={(e) => { setFbCookiesText(e.target.value); setFbCookiesError(''); }}
                rows={5}
                className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" />
              <div onClick={() => fbFileInputRef.current?.click()} className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/10 hover:bg-muted/30 transition-colors p-3 text-center">
                <p className="text-xs text-muted-foreground"><span className="material-symbols-outlined text-sm align-middle mr-1">upload_file</span>Drop a <code>.json</code> file or click to browse</p>
                <input ref={fbFileInputRef} type="file" accept=".json" className="hidden"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) try { setFbCookiesText(await f.text()); setFbCookiesError(''); } catch { toast.error('Cannot read file'); } }} />
              </div>
              {fbCookiesError && <p className="text-[11px] text-red-600 pl-1">{fbCookiesError}</p>}
            </div>
            <button onClick={handleConnect} disabled={fbConnecting || !fbCookiesText.trim()}
              className="px-6 py-3 bg-[#0866FF] text-white font-bold rounded-xl hover:bg-[#0866FF]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {fbConnecting ? <><span className="animate-spin">⏳</span> Connecting...</> : <><span className="material-symbols-outlined text-sm">link</span> Connect</>}
            </button>
          </div>
        )}
      </div>

      {/* Account List */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-black/10 rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2 block">chat</span>
          <p className="text-muted-foreground">No accounts connected yet. Paste cookies above to connect.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Connected Accounts ({accounts.length})</h3>
          {accounts.map((acc) => (
            <div key={acc.id} className="p-4 bg-black/10 rounded-2xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-blue-400">chat</span>
                <div>
                  <p className="font-medium">{acc.display_name || 'Unnamed Account'}</p>
                  <p className="text-xs text-muted-foreground">{acc.channel_uid || 'No UID'} · {acc.connected_at ? new Date(acc.connected_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={acc.status} />
                <button onClick={handleDisconnect}
                  className="px-3 py-1.5 bg-red-500/10 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-colors border border-red-200">
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
