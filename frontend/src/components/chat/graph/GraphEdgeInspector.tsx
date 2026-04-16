import { ArrowRight, X } from 'lucide-react';

interface GraphEdgeInspectorProps {
  edgeAttrs: Record<string, any>;
  onClose: () => void;
}

export function GraphEdgeInspector({
  edgeAttrs,
  onClose,
}: GraphEdgeInspectorProps) {
  const desc = (edgeAttrs.description ?? '').split('\n')[0];
  return (
    <div
      className="border-t border-border-warm px-3 py-2.5 shrink-0 max-h-[120px] overflow-y-auto bg-warm-cream"
      role="region"
      aria-label="Selected edge details"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <ArrowRight className="size-3 text-warm-stone" aria-hidden="true" />
        <span className="text-xs font-bold text-orange-600">
          {edgeAttrs.label || 'relation'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-warm-stone hover:text-text-primary"
          aria-label="Close edge inspector"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {desc && (
        <p className="text-[11px] leading-relaxed text-warm-stone">{desc}</p>
      )}
    </div>
  );
}
