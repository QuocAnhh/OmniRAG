import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { channelAccountsApi } from '../api/channelAccounts';
import { botsApi } from '../api/bots';
import type { ChannelAccount, ChannelAccountAccess } from '../types/api';
import { confirmAction } from '../lib/confirmAction';

const STATUS_META: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-800 border-green-300' },
  connecting: { label: 'Connecting', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  qr_ready: { label: 'QR Ready', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  scanned: { label: 'Scanned', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  expired: { label: 'QR Expired', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  disconnected: { label: 'Disconnected', color: 'bg-red-100 text-red-800 border-red-300' },
  relogin_required: { label: 'Relogin Required', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  duplicate_connection: { label: 'Duplicate', color: 'bg-red-100 text-red-800 border-red-300' },
  backend_down: { label: 'Backend Down', color: 'bg-gray-100 text-gray-600 border-gray-400' },
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

export default function ZaloPersonalAccountsPage() {
  const { id: botId } = useParams<{ id: string }>();
  const [botName, setBotName] = useState('');
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // QR dialog state
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [qrAccountId, setQrAccountId] = useState('');
  const [qrStatus, setQrStatus] = useState('');
  const [qrPolling, setQrPolling] = useState<ReturnType<typeof setInterval> | null>(null);

  // Access dialog state
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [accessAccountId, setAccessAccountId] = useState('');
  const [accessEntries, setAccessEntries] = useState<ChannelAccountAccess[]>([]);

  const fetchAccounts = useCallback(async () => {
    if (!botId) return;
    try {
      const data = await channelAccountsApi.listZaloAccounts(botId);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (botId) {
      botsApi.get(botId).then((r: any) => setBotName(r.data?.name || '')).catch(() => {});
      fetchAccounts();
    }
  }, [botId, fetchAccounts]);

  const handleCreateAccount = async () => {
    if (!botId) return;
    try {
      const result = await channelAccountsApi.createZaloAccount(botId, {
        channel_type: 'zalo_personal',
        reply_policy: 'mention_only',
      });
      const accountId = result.id;
      setQrAccountId(accountId);
      setShowQrDialog(true);

      // Poll QR status every 2.5s
      const interval = setInterval(async () => {
        try {
          const status = await channelAccountsApi.getAccountLoginStatus(accountId);
          const workerData = status.worker || {};
          setQrStatus(workerData.status || '');
          if (workerData.qr_image) setQrImage(workerData.qr_image);
          if (workerData.status === 'connected') {
            clearInterval(interval);
            setQrPolling(null);
            setShowQrDialog(false);
            setQrImage('');
            setQrStatus('');
            fetchAccounts();
          }
        } catch { /* poll silently fails */ }
      }, 2500);
      setQrPolling(interval);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create account');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const confirmed = await confirmAction({
      title: 'Disconnect and delete this account?',
      text: 'This account will stop receiving messages for the selected agent.',
      confirmText: 'Delete account',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await channelAccountsApi.deleteAccount(accountId);
      fetchAccounts();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete account');
    }
  };

  const handleManageAccess = async (accountId: string) => {
    setAccessAccountId(accountId);
    try {
      const entries = await channelAccountsApi.listAccess(accountId);
      setAccessEntries(Array.isArray(entries) ? entries : []);
    } catch { setAccessEntries([]); }
    setShowAccessDialog(true);
  };

  const handleCloseQr = () => {
    if (qrPolling) clearInterval(qrPolling);
    setQrPolling(null);
    setShowQrDialog(false);
    setQrImage('');
    setQrAccountId('');
    setQrStatus('');
    fetchAccounts();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground mt-4 text-sm font-medium">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/bots" className="text-sm text-muted-foreground hover:text-foreground mb-1 block">
            &larr; Back to Bots
          </Link>
          <h1 className="text-2xl font-bold">{botName || 'Bot'} — Zalo Personal Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multiple Zalo personal accounts connected to this bot. Each account can reply to messages independently.
          </p>
        </div>
        <button
          onClick={handleCreateAccount}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add Account
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Accounts table */}
      {accounts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm mb-3">No Zalo Personal accounts connected yet.</p>
          <button
            onClick={handleCreateAccount}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            Connect Your First Account
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Connected</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Event</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{account.display_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{account.channel_uid || account.id.slice(0, 8)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <StatusBadge status={account.status} />
                      {account.last_error && (
                        <p className="text-xs text-red-500 truncate max-w-[180px]" title={account.last_error}>
                          {account.last_error}
                        </p>
                      )}
                      {account.circuit_breaker?.disconnect_tripped && (
                        <p className="text-xs text-orange-500">Circuit tripped</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {account.connected_at ? new Date(account.connected_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {account.last_event_at ? new Date(account.last_event_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {account.status === 'relogin_required' && (
                        <button
                          onClick={handleCreateAccount}
                          className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
                        >
                          Reconnect
                        </button>
                      )}
                      <button
                        onClick={() => handleManageAccess(account.id)}
                        className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted"
                        title="Manage access"
                      >
                        Access
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="px-2.5 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* QR Dialog */}
      {showQrDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold mb-4">Scan QR Code with Zalo</h2>
            <div className="flex items-center justify-center mb-4">
              {qrImage ? (
                <img
                  src={qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`}
                  alt="Zalo QR"
                  className="w-56 h-56 border border-border rounded-lg"
                />
              ) : (
                <div className="w-56 h-56 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                  Generating QR...
                </div>
              )}
            </div>
            <p className="text-sm text-center text-muted-foreground mb-4">
              {qrStatus === 'qr_ready' && 'Open Zalo app → Scan QR code'}
              {qrStatus === 'scanned' && 'Confirm login on your phone...'}
              {qrStatus === 'expired' && 'QR expired. Close and try again.'}
              {qrStatus === 'connecting' && 'Connecting...'}
              {!qrStatus && 'Preparing QR code...'}
            </p>
            <button
              onClick={handleCloseQr}
              className="w-full py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Access Dialog */}
      {showAccessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Manage Access</h2>
            {accessEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-4">No access grants yet. Owner/Admin have full access.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {accessEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                    <span className="text-muted-foreground font-mono text-xs">{entry.user_id.slice(0, 8)}...</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">{entry.permission}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowAccessDialog(false)}
              className="w-full py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
