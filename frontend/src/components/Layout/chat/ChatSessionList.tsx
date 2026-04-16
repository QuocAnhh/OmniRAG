import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface Session {
  id: string;
  title: string;
}

interface ChatSessionListProps {
  sessions: Session[];
  currentSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onClearHistory?: () => void;
}

export function ChatSessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClearHistory,
}: ChatSessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="px-3 py-8 flex flex-col items-center gap-2 text-center">
        <div className="size-8 rounded-lg bg-warm-cream border border-border-warm flex items-center justify-center mb-1">
          <Plus className="h-4 w-4 text-warm-silver" aria-hidden="true" />
        </div>
        <p className="text-xs font-medium text-warm-olive">
          No conversations yet
        </p>
        <p className="text-[10px] text-warm-stone">Start a new chat above</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 py-2 flex items-center justify-between group/header">
        <div className="text-xs font-semibold text-warm-stone uppercase tracking-wider">
          History
        </div>
        {onClearHistory && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearHistory();
            }}
            className="opacity-0 group-hover/header:opacity-100 text-[10px] font-bold text-destructive hover:underline uppercase transition-opacity"
          >
            Clear All
          </button>
        )}
      </div>
      {sessions.map((session) => (
        <div key={session.id} className="relative group/item">
          <button
            type="button"
            onClick={() => onSelectSession?.(session.id)}
            aria-current={currentSessionId === session.id ? 'true' : undefined}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors flex items-center gap-2 pr-8',
              currentSessionId === session.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-warm-cream text-warm-olive hover:text-text-primary',
            )}
          >
            <span className="truncate">{session.title}</span>
          </button>
          {onDeleteSession && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 hover:text-destructive text-warm-stone transition-all"
              aria-label="Delete session"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </>
  );
}
