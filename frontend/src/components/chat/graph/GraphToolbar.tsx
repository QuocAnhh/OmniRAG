import { Maximize2, Network, X } from 'lucide-react';

interface GraphToolbarProps {
  focusedNodeId: string | null;
  onExitFocus: () => void;
  activeHitCount: number;
  onExpandClick?: () => void;
}

export function GraphToolbar({
  focusedNodeId,
  onExitFocus,
  activeHitCount,
  onExpandClick,
}: GraphToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-warm shrink-0">
      <Network className="size-4 text-primary" aria-hidden="true" />
      <span className="text-xs font-semibold text-warm-stone flex-1">
        Knowledge Graph
      </span>
      {focusedNodeId && (
        <button
          type="button"
          onClick={onExitFocus}
          className="inline-flex items-center gap-1 rounded-comfort border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 hover:bg-orange-500/20 transition-colors"
          title="Exit focus mode"
        >
          <X className="size-2.5" aria-hidden="true" />
          Exit focus
        </button>
      )}
      {activeHitCount > 0 && (
        <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">
          {activeHitCount} active
        </span>
      )}
      {onExpandClick && (
        <button
          type="button"
          onClick={onExpandClick}
          className="rounded p-1 text-warm-stone hover:bg-warm-cream transition-colors"
          title="Full screen"
          aria-label="Open fullscreen graph view"
        >
          <Maximize2 className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
