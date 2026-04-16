import {
  Panel as ResizablePanel,
  PanelGroup as ResizablePanelGroup,
  PanelResizeHandle as ResizableHandle,
} from 'react-resizable-panels';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { type ReactNode, useState } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatHeader } from './chat/ChatHeader';
import { ChatRightPanel } from './chat/ChatRightPanel';

interface Session {
  id: string;
  title: string;
}

interface ChatLayoutProps {
  children: ReactNode;
  rightPanel?: ReactNode;
  sessions?: Session[];
  currentSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onClearHistory?: () => void;
  onNewChat?: () => void;
  botName?: string;
  botModel?: string;
  botDomain?: string;
  embedded?: boolean;
  headerActions?: ReactNode;
}

export default function ChatLayout({
  children,
  rightPanel,
  sessions = [],
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClearHistory,
  onNewChat,
  botName = 'Bot Configuration',
  botModel = 'GPT-4o',
  botDomain,
  embedded = false,
  headerActions,
}: ChatLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { user } = useAuthStore();

  const [leftSize, setLeftSize] = useState(20);
  const [rightSize, setRightSize] = useState(25);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const toggleRightPanel = () => setIsRightCollapsed((v) => !v);

  return (
    <div className="h-dvh w-full bg-background overflow-hidden flex flex-col font-sans relative">
      <div className="flex flex-col h-full w-full relative">
        {/* Mobile Header */}
        {!isDesktop && !embedded && (
          <div className="h-14 border-b border-border-warm flex items-center px-4 justify-between bg-white">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5 text-warm-charcoal" aria-hidden="true" />
            </button>
            <span className="font-semibold text-text-primary">
              OmniRAG Chat
            </span>
            <div className="w-5" aria-hidden="true" />
          </div>
        )}

        {/* Main Layout */}
        <div className="flex-1 h-full overflow-hidden relative">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full rounded-lg border border-border-warm"
          >
            {/* Left: Sidebar */}
            {!embedded && (isDesktop || isMobileMenuOpen) && (
              <ResizablePanel
                defaultSize={leftSize}
                minSize={15}
                maxSize={30}
                className={cn(
                  'bg-card border-r border-border-warm flex flex-col transition-all duration-300',
                  !isDesktop &&
                    'absolute inset-0 z-50 bg-white w-3/4 shadow-whisper',
                )}
                onResize={setLeftSize}
              >
                <ChatSidebar
                  user={user}
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onNewChat={onNewChat}
                  onSelectSession={onSelectSession}
                  onDeleteSession={onDeleteSession}
                  onClearHistory={onClearHistory}
                  isDesktop={isDesktop}
                  onCloseMobile={() => setIsMobileMenuOpen(false)}
                />
              </ResizablePanel>
            )}

            {!embedded && isDesktop && <ResizableHandle className="w-1.5 flex items-center justify-center bg-border-warm hover:bg-primary/20 transition-colors group" />}

            {/* Center: Chat Main */}
            <ResizablePanel
              defaultSize={
                100 - leftSize - (isRightCollapsed ? 0 : rightSize)
              }
              minSize={30}
            >
              <div className="h-full flex flex-col bg-white relative">
                <ChatHeader
                  botId={id}
                  botName={botName}
                  botModel={botModel}
                  botDomain={botDomain}
                  headerActions={headerActions}
                  isRightCollapsed={isRightCollapsed}
                  onToggleRight={toggleRightPanel}
                />
                <div className="flex-1 overflow-hidden relative">{children}</div>
              </div>
            </ResizablePanel>

            {/* Right: Evidence / KG */}
            {!isRightCollapsed && (
              <>
                {isDesktop && <ResizableHandle className="w-1.5 flex items-center justify-center bg-border-warm hover:bg-primary/20 transition-colors group" />}
                <ResizablePanel
                  defaultSize={rightSize}
                  minSize={20}
                  maxSize={45}
                  onResize={setRightSize}
                  className="bg-card border-l border-border-warm"
                >
                  <ChatRightPanel content={rightPanel} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
