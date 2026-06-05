import { useState, useEffect, useCallback } from 'react';
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

export default function TelegramAccountsPage() {
  const { id: botId } = useParams<{ id: string }>();
  const [botName, setBotName] = useState('');
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState('');

  const fetchAccounts = useCallback(async () => {
    if (!botId) return;
    try {
      const data = await channelAccountsApi.listTelegramAccounts(botId);
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

  const handleDisconnect = async (accountId: string) => {
    const { confirmAction } = await import('../lib/confirmAction');
    const confirmed = await confirmAction({
      title: 'Disconnect this Telegram bot?',
      text: 'This bot will stop responding on Telegram.',
      confirmText: 'Disconnect',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/api/v1/channels/telegram/accounts/${accountId}`);
      toast.success('Disconnected');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to disconnect');
    }
  };

  const handleConnect = async () => {
    if (!botId || !telegramBotToken.trim()) { toast.error('Please enter your Bot Token'); return; }
    setTelegramConnecting(true);
    const t = toast.loading('Connecting Telegram Bot...');
    try {
      await apiClient.post('/api/v1/channels/telegram/connect', { bot_id: botId, bot_token: telegramBotToken.trim() });
      setTelegramBotToken('');
      toast.success('Connected!', { id: t });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Connection failed', { id: t });
    } finally { setTelegramConnecting(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to={`/bots/${botId}/config?tab=channels`} className="text-sm text-muted-foreground hover:text-primary mb-1 block">
          ← Back to {botName || 'Bot'} settings
        </Link>
        <h1 className="text-2xl font-bold">Telegram Bot Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect and manage Telegram bots for this agent.</p>
      </div>

      {/* Connect Form */}
      <div className="p-6 bg-black/10 rounded-2xl border border-white/5 space-y-4">
        <h3 className="text-lg font-bold">Connect New Bot</h3>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Bot Token</label>
          <input type="password" placeholder="e.g. 1234567890:ABCdefGHIJklmNOPqrstUVwxyz"
            value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)}
            className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" />
          <p className="text-[10px] text-muted-foreground pl-1">Get this from <strong>@BotFather</strong> on Telegram.</p>
        </div>
        <button onClick={handleConnect} disabled={telegramConnecting || !telegramBotToken.trim()}
          className="px-6 py-3 bg-[#24A1DE] text-white font-bold rounded-xl hover:bg-[#24A1DE]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {telegramConnecting ? <><span className="animate-spin">⏳</span> Connecting...</> : <><span className="material-symbols-outlined text-sm">link</span> Connect</>}
        </button>
      </div>

      {/* Account List */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-black/10 rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2 block">send</span>
          <p className="text-muted-foreground">No bots connected yet. Paste a token above to connect.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Connected Bots ({accounts.length})</h3>
          {accounts.map((acc) => (
            <div key={acc.id} className="p-4 bg-black/10 rounded-2xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-sky-400">send</span>
                <div>
                  <p className="font-medium">{acc.display_name || 'Unnamed Bot'}</p>
                  <p className="text-xs text-muted-foreground">{acc.channel_uid || 'No username'} · {acc.connected_at ? new Date(acc.connected_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={acc.status} />
                <button onClick={() => handleDisconnect(acc.id)}
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
