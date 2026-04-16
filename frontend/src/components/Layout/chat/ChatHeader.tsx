import { Link } from 'react-router-dom';
import { Bot, Database, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { getDomainMeta } from '../../../utils/domainHelpers';

interface ChatHeaderProps {
  botId?: string;
  botName: string;
  botModel: string;
  botDomain?: string;
  headerActions?: ReactNode;
  isRightCollapsed: boolean;
  onToggleRight: () => void;
}

export function ChatHeader({
  botId,
  botName,
  botModel,
  botDomain,
  headerActions,
  isRightCollapsed,
  onToggleRight,
}: ChatHeaderProps) {
  const domainMeta = botDomain ? getDomainMeta(botDomain) : null;
  return (
    <div className="h-14 border-b border-border-warm flex items-center justify-between px-6 bg-white sticky top-0 z-10 shadow-ring">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm text-text-primary">
              {botName}
            </h1>
            {domainMeta && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${domainMeta.badge}`}
              >
                <span className="material-symbols-outlined text-[11px]">
                  {domainMeta.icon}
                </span>
                {domainMeta.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            <span className="text-xs text-warm-stone">{botModel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {headerActions}
        <button
          type="button"
          onClick={onToggleRight}
          className={cn(
            'p-2 rounded-lg hover:bg-warm-cream transition-colors',
            !isRightCollapsed && 'bg-warm-cream text-primary',
          )}
          title="Toggle Evidence Panel"
          aria-label="Toggle evidence panel"
          aria-pressed={!isRightCollapsed}
        >
          <Database className="h-5 w-5" aria-hidden="true" />
        </button>
        {botId && (
          <Link
            to={`/bots/${botId}/config`}
            className="p-2 rounded-lg hover:bg-warm-cream transition-colors text-warm-olive"
            title="Settings"
            aria-label="Bot settings"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
