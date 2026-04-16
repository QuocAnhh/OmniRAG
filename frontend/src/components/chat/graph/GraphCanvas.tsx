import { SigmaContainer } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import { Network } from 'lucide-react';
import type Graph from 'graphology';
import { GraphController } from './GraphController';
import { SIGMA_SETTINGS } from './sigmaSettings';

interface GraphCanvasProps {
  botId: string;
  graph: Graph;
  isLoading: boolean;
  hasNodes: boolean;
  hiddenTypes: Set<string>;
  selectedId: string | null;
  focusedNodeId: string | null;
  searchHighlights: Set<string>;
  onNodeClick: (id: string | null, attrs: Record<string, any> | null) => void;
  onEdgeClick: (attrs: Record<string, any> | null) => void;
  setHovered: (label: string | null) => void;
  onRegisterNavigate: (fn: (nodeId: string) => void) => void;
}

export function GraphCanvas({
  botId,
  graph,
  isLoading,
  hasNodes,
  hiddenTypes,
  selectedId,
  focusedNodeId,
  searchHighlights,
  onNodeClick,
  onEdgeClick,
  setHovered,
  onRegisterNavigate,
}: GraphCanvasProps) {
  return (
    <div className="flex-1 relative min-h-0">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
          <div className="flex flex-col items-center gap-2.5">
            <div
              className="size-7 rounded-full border-[3px] border-border-warm animate-spin"
              style={{ borderTopColor: 'var(--primary, #c96442)' }}
            />
            <span className="text-xs text-warm-stone">Loading graph…</span>
          </div>
        </div>
      )}
      {!isLoading && !hasNodes && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Network
            className="size-10 text-warm-sand"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className="text-xs text-warm-olive">No graph data</span>
          <span className="text-[11px] text-warm-stone">
            Upload documents to build the graph
          </span>
        </div>
      )}
      {!isLoading && graph.order > 0 && (
        <SigmaContainer
          key={`sigma-${botId}`}
          settings={SIGMA_SETTINGS as any}
          style={{ width: '100%', height: '100%', background: 'var(--color-warm-ivory, #faf9f5)' }}
        >
          <GraphController
            graph={graph}
            hiddenTypes={hiddenTypes}
            selectedId={selectedId}
            focusedNodeId={focusedNodeId}
            searchHighlights={searchHighlights}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            setHovered={setHovered}
            onRegisterNavigate={onRegisterNavigate}
          />
        </SigmaContainer>
      )}
    </div>
  );
}
