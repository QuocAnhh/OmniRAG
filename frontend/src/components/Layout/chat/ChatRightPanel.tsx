import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

interface ChatRightPanelProps {
  /** Content to render — usually KnowledgeGraphPanel or DebugPanel. */
  content?: ReactNode;
}

export function ChatRightPanel({ content }: ChatRightPanelProps) {
  if (content) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden bg-card">
        <div className="absolute inset-0 z-0 flex flex-col">{content}</div>
      </div>
    );
  }

  // Default placeholder
  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-card">
      <div className="h-14 border-b border-border-warm flex items-center px-4 bg-white relative z-10">
        <span className="font-semibold text-[11px] text-primary uppercase tracking-widest">
          Knowledge Graph
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="flex flex-col items-center justify-center h-full text-warm-stone text-center">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Search
              className="h-8 w-8 text-primary"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
          <p className="font-medium text-text-primary tracking-wide">
            Analysis Engine Standby
          </p>
          <p className="text-xs max-w-[200px] mt-2 leading-relaxed text-warm-stone">
            System will map documents when a query is processed.
          </p>
        </div>
      </div>
    </div>
  );
}
