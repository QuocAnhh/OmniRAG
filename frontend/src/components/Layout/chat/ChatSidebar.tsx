import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ChatSessionList } from './ChatSessionList';
import type { User } from '../../../types/api';

interface Session {
  id: string;
  title: string;
}

interface ChatSidebarProps {
  user: User | null;
  sessions: Session[];
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onClearHistory?: () => void;
  isDesktop: boolean;
  onCloseMobile?: () => void;
}

export function ChatSidebar({
  user,
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onClearHistory,
  isDesktop,
  onCloseMobile,
}: ChatSidebarProps) {
  return (
    <div className={cn('flex flex-col h-full')}>
      {/* Sidebar Header */}
      <div className="h-14 px-4 border-b border-border-warm flex items-center justify-between">
        <Link
          to="/bots"
          className="flex items-center gap-2 text-warm-stone hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium text-sm">Back to Bots</span>
        </Link>
        {!isDesktop && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="text-warm-charcoal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center gap-2 justify-center bg-primary text-primary-foreground py-2.5 rounded-lg font-medium shadow-ring hover:bg-terracotta-light transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New Chat</span>
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        <ChatSessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onClearHistory={onClearHistory}
        />
      </div>

      {/* Bottom User Profile */}
      <div className="p-4 border-t border-border-warm bg-warm-cream">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-warm-sand flex items-center justify-center text-xs font-bold text-warm-charcoal ring-2 ring-white shadow-sm">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate text-text-primary">
              {user?.full_name || 'User'}
            </span>
            <span className="text-xs text-warm-stone truncate">
              {user?.email}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
