/**
 * Circuit breaker for Zalo session disconnects and backend failures.
 * Ported from ZaloCRM zalo-pool.ts disconnectHistory + backend failure tracking.
 */

import { settings } from "./config.js";

const DISCONNECT_THRESHOLD = settings.disconnectThreshold;
const DISCONNECT_WINDOW_MS = 300_000; // 5 minutes
const BACKEND_FAILURE_THRESHOLD = settings.backendFailureThreshold;

const disconnectHistory = new Map();
const backendFailureCount = new Map();

// ── Disconnect storm breaker ────────────────────────────────────────────

export function recordDisconnect(botId) {
  const now = Date.now();
  const history = (disconnectHistory.get(botId) || []).filter(
    (t) => now - t < DISCONNECT_WINDOW_MS,
  );
  history.push(now);
  disconnectHistory.set(botId, history);

  if (history.length >= DISCONNECT_THRESHOLD) {
    return {
      tripped: true,
      reason: `${history.length} disconnects in 5 min — stopping auto-reconnect`,
    };
  }
  return { tripped: false };
}

export function resetDisconnect(botId) {
  disconnectHistory.delete(botId);
}

export function isDisconnectTripped(botId) {
  const now = Date.now();
  const history = (disconnectHistory.get(botId) || []).filter(
    (t) => now - t < DISCONNECT_WINDOW_MS,
  );
  return history.length >= DISCONNECT_THRESHOLD;
}

// ── Backend failure breaker ─────────────────────────────────────────────

export function recordBackendFailure(botId) {
  const count = (backendFailureCount.get(botId) || 0) + 1;
  backendFailureCount.set(botId, count);
  return count >= BACKEND_FAILURE_THRESHOLD;
}

export function recordBackendSuccess(botId) {
  backendFailureCount.delete(botId);
}

export function isBackendDown(botId) {
  return (backendFailureCount.get(botId) || 0) >= BACKEND_FAILURE_THRESHOLD;
}

// ── Convenience ─────────────────────────────────────────────────────────

export function resetAll(botId) {
  resetDisconnect(botId);
  backendFailureCount.delete(botId);
}
