/**
 * Query key factory — single source of truth for TanStack Query cache keys.
 * Usage: useQuery({ queryKey: keys.bots.detail(id), ... })
 */
export const keys = {
  bots: {
    all: ['bots'] as const,
    detail: (id: string) => ['bots', id] as const,
  },
  docs: {
    byBot: (botId: string) => ['docs', botId] as const,
    detail: (botId: string, docId: string) => ['docs', botId, docId] as const,
  },
  chat: {
    session: (botId: string, sessionId: string) => ['chat', botId, sessionId] as const,
    sessions: (botId: string) => ['chat', botId, 'sessions'] as const,
  },
  analytics: {
    stats: ['analytics', 'stats'] as const,
    conversations: (limit?: number) => ['analytics', 'conversations', limit] as const,
  },
} as const;
