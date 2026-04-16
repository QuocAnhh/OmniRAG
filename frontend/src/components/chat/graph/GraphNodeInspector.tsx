import { Crosshair, MessageSquare, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { typeColor, typeLabel } from './types';

interface GraphNodeInspectorProps {
  selectedId: string;
  selectedAttrs: Record<string, any>;
  isFocused: boolean;
  onClose: () => void;
  onToggleFocus: () => void;
  onAskAboutEntity?: (query: string) => void;
}

export function GraphNodeInspector({
  selectedId,
  selectedAttrs,
  isFocused,
  onClose,
  onToggleFocus,
  onAskAboutEntity,
}: GraphNodeInspectorProps) {
  const selType = selectedAttrs.nodeType ?? '';
  const selColor = typeColor(selType);
  const selDesc = (selectedAttrs.description ?? '').split('\n')[0];
  const selFile = selectedAttrs.filePath ?? '';
  const selFileName =
    selFile && selFile !== 'unknown_source'
      ? selFile.split(/[\\/]/).pop()
      : null;
  const selName = selectedAttrs.label ?? selectedId ?? '';

  return (
    <div
      className="border-t border-border-warm px-3 py-2.5 shrink-0 max-h-[200px] overflow-y-auto bg-warm-cream"
      role="region"
      aria-label="Selected node details"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ background: selColor }}
        />
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-text-primary">
          {selName}
        </span>
        <span
          className="rounded-comfort px-1.5 py-0.5 text-[10px]"
          style={{ background: `${selColor}22`, color: selColor }}
        >
          {typeLabel(selType)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-warm-stone hover:text-text-primary"
          aria-label="Close inspector"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {selDesc && (
        <p className="mb-2 text-[11px] leading-relaxed text-warm-stone">
          {selDesc}
        </p>
      )}
      {selFileName && (
        <p className="mb-2 text-[10px] text-warm-olive">Src: {selFileName}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onToggleFocus}
          className={cn(
            'inline-flex items-center gap-1 rounded-comfort px-2.5 py-1 text-[10px] font-semibold transition-colors',
            isFocused
              ? 'border border-orange-500/40 bg-orange-500/10 text-orange-600'
              : 'border border-border-warm bg-warm-cream text-slate-400 hover:text-warm-charcoal',
          )}
        >
          <Crosshair className="size-2.5" aria-hidden="true" />
          {isFocused ? 'Unfocus' : 'Focus neighborhood'}
        </button>

        {onAskAboutEntity && (
          <button
            type="button"
            onClick={() => {
              onAskAboutEntity(`Tell me more about "${selName}"`);
              onClose();
            }}
            className="inline-flex items-center gap-1 rounded-comfort border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <MessageSquare className="size-2.5" aria-hidden="true" />
            Ask AI about this
          </button>
        )}
      </div>
    </div>
  );
}
