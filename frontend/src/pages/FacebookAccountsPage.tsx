import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { channelAccountsApi } from '../api/channelAccounts';
import { botsApi } from '../api/bots';
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

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/bots/${botId}/config?tab=channels`} className="text-sm text-muted-foreground hover:text-primary mb-1 block">
            ← Back to {botName || 'Bot'} settings
          </Link>
          <h1 className="text-2xl font-bold">Facebook Messenger Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Facebook accounts connected to this bot. Connect new accounts from the Channels tab.
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 bg-black/10 rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-4xl text-muted-foreground mb-3 block">chat</span>
          <p className="text-muted-foreground">No Facebook accounts connected yet.</p>
          <Link
            to={`/bots/${botId}/config?tab=channels`}
            className="inline-block mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Connect Facebook Account
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="p-4 bg-black/10 rounded-2xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-blue-400">chat</span>
                <div>
                  <p className="font-medium">{acc.display_name || 'Unnamed Account'}</p>
                  <p className="text-xs text-muted-foreground">{acc.channel_uid || 'No UID'} · Connected {acc.connected_at ? new Date(acc.connected_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <StatusBadge status={acc.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
