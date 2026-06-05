import apiClient from './client';

const ZALO_PERSONAL_PREFIX = '/api/v1/channels/zalo-personal';

export const channelAccountsApi = {
  // ── Zalo Personal ──────────────────────────────────────────────────

  /** List all Zalo Personal accounts for a bot */
  listZaloAccounts: (botId: string) =>
    apiClient.get(`${ZALO_PERSONAL_PREFIX}/bots/${botId}/accounts`).then((r) => r.data),

  /** Create a new Zalo Personal account and start QR login */
  createZaloAccount: (botId: string, data: { channel_type: string; reply_policy: string; thread_whitelist?: string[] }) =>
    apiClient.post(`${ZALO_PERSONAL_PREFIX}/bots/${botId}/accounts`, data).then((r) => r.data),

  /** Get a specific account */
  getAccount: (accountId: string) =>
    apiClient.get(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}`).then((r) => r.data),

  /** Delete/disconnect an account */
  deleteAccount: (accountId: string) =>
    apiClient.delete(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}`).then((r) => r.data),

  /** Update account policy */
  updateAccount: (accountId: string, data: { reply_policy?: string; thread_whitelist?: string[] }) =>
    apiClient.put(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}`, data).then((r) => r.data),

  /** Poll QR login status */
  getAccountLoginStatus: (accountId: string) =>
    apiClient.get(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}/login-status`).then((r) => r.data),

  /** Get live account status from worker */
  getAccountStatus: (accountId: string) =>
    apiClient.get(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}/status`).then((r) => r.data),

  /** List access entries for an account */
  listAccess: (accountId: string) =>
    apiClient.get(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}/access`).then((r) => r.data),

  /** Grant user access to an account */
  grantAccess: (accountId: string, userId: string, permission: string) =>
    apiClient.post(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}/access`, { user_id: userId, permission }).then((r) => r.data),

  /** Revoke user access */
  revokeAccess: (accountId: string, accessId: string) =>
    apiClient.delete(`${ZALO_PERSONAL_PREFIX}/accounts/${accountId}/access/${accessId}`).then((r) => r.data),

  // ── Facebook Messenger ────────────────────────────────────────────────

  listFbAccounts: (botId: string) =>
    apiClient.get(`/api/v1/channels/facebook/bots/${botId}/accounts`).then((r) => r.data),

  deleteFbAccount: (accountId: string) =>
    apiClient.delete(`/api/v1/channels/facebook/accounts/${accountId}`).then((r) => r.data),

  // ── Telegram ──────────────────────────────────────────────────────────

  listTelegramAccounts: (botId: string) =>
    apiClient.get(`/api/v1/channels/telegram/bots/${botId}/accounts`).then((r) => r.data),

  deleteTelegramAccount: (accountId: string) =>
    apiClient.delete(`/api/v1/channels/telegram/accounts/${accountId}`).then((r) => r.data),
};
