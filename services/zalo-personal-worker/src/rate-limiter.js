/**
 * Per-bot rate limiter — prevents Zalo from blocking accounts.
 * Ported from ZaloCRM zalo-rate-limiter.ts.
 */

const DAILY_LIMIT = 200;
const BURST_LIMIT = 5;
const BURST_WINDOW_MS = 30_000;

const dailyCounts = new Map();
const recentSends = new Map();

export function checkLimits(botId) {
  const today = new Date().toISOString().split("T")[0];
  const daily = dailyCounts.get(botId);
  if (daily && daily.date === today && daily.count >= DAILY_LIMIT) {
    return { allowed: false, reason: `daily_limit: ${DAILY_LIMIT}/day reached` };
  }

  const now = Date.now();
  const recent = (recentSends.get(botId) || []).filter(
    (t) => now - t < BURST_WINDOW_MS,
  );
  if (recent.length >= BURST_LIMIT) {
    return { allowed: false, reason: `burst_limit: ${BURST_LIMIT}/30s reached` };
  }

  return { allowed: true };
}

export function recordSend(botId) {
  const now = Date.now();

  const recent = (recentSends.get(botId) || []).filter(
    (t) => now - t < 60_000,
  );
  recent.push(now);
  recentSends.set(botId, recent);

  const today = new Date().toISOString().split("T")[0];
  const daily = dailyCounts.get(botId);
  if (daily && daily.date === today) {
    daily.count += 1;
  } else {
    dailyCounts.set(botId, { count: 1, date: today });
  }
}

export function getDailyCount(botId) {
  const today = new Date().toISOString().split("T")[0];
  const daily = dailyCounts.get(botId);
  return daily && daily.date === today ? daily.count : 0;
}

export function resetLimits(botId) {
  dailyCounts.delete(botId);
  recentSends.delete(botId);
}
