import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildGraphology,
  DEFAULT_HIDDEN_TYPES,
  DEFAULT_TOP_N,
  GraphCanvas,
  GraphEdgeInspector,
  GraphFilters,
  GraphNodeInspector,
  GraphToolbar,
  MAX_STORED,
  useGraphData,
  type KnowledgeGraphPanelProps,
} from './graph';

export default function KnowledgeGraphPanel({
  botId,
  activeEntities = [],
  onExpandClick,
  defaultTopN,
  onAskAboutEntity,
}: KnowledgeGraphPanelProps) {
  const { rawNodes, rawLinks, isLoading, typeCounts, graphSummary } =
    useGraphData(botId);

  const [topN, setTopN] = useState(defaultTopN ?? DEFAULT_TOP_N);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(
    new Set(DEFAULT_HIDDEN_TYPES),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, any> | null>(
    null,
  );
  const [selectedEdge, setSelectedEdge] = useState<Record<string, any> | null>(
    null,
  );
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const navigateCameraRef = useRef<((nodeId: string) => void) | null>(null);
  const maxSlider = Math.min(rawNodes.length || DEFAULT_TOP_N, MAX_STORED);

  const activeSet = useMemo(
    () => new Set(activeEntities.map((e) => e.toLowerCase())),
    [activeEntities],
  );
  const activeHitCount = useMemo(() => {
    if (!activeSet.size || !rawNodes.length) return 0;
    return rawNodes.filter(
      (n) =>
        activeSet.has(n.name.toLowerCase()) ||
        activeSet.has(n.id.toLowerCase()),
    ).length;
  }, [activeSet, rawNodes]);

  const graph = useMemo(
    () => buildGraphology(rawNodes, rawLinks, topN, activeSet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawNodes, rawLinks, topN],
  );

  const searchHighlights = useMemo<Set<string>>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || graph.order === 0) return new Set();
    const hits = new Set<string>();
    graph.forEachNode((nodeId, attrs) => {
      const label = ((attrs.label as string) ?? '').toLowerCase();
      if (label.includes(q)) hits.add(nodeId);
    });
    return hits;
  }, [searchQuery, graph]);

  useEffect(() => {
    if (searchHighlights.size > 0 && navigateCameraRef.current) {
      const firstHit = searchHighlights.values().next().value;
      if (firstHit) navigateCameraRef.current(firstHit);
    }
  }, [searchHighlights]);

  const handleNodeClick = useCallback(
    (id: string | null, attrs: Record<string, any> | null) => {
      setSelectedId(id);
      setSelectedAttrs(attrs);
      setSelectedEdge(null);
      if (id === null) setFocusedNodeId(null);
    },
    [],
  );

  const handleEdgeClick = useCallback(
    (attrs: Record<string, any> | null) => {
      setSelectedEdge(attrs);
      setSelectedId(null);
      setSelectedAttrs(null);
    },
    [],
  );

  // Stable callbacks for GraphController props
  const nodeClickRef = useRef(handleNodeClick);
  const edgeClickRef = useRef(handleEdgeClick);
  const hoveredRef = useRef(setHoveredLabel);

  nodeClickRef.current = handleNodeClick;
  edgeClickRef.current = handleEdgeClick;
  hoveredRef.current = setHoveredLabel;

  const stableNodeClick = useCallback(
    (id: string | null, attrs: Record<string, any> | null) =>
      nodeClickRef.current(id, attrs),
    [],
  );
  const stableEdgeClick = useCallback(
    (attrs: Record<string, any> | null) => edgeClickRef.current(attrs),
    [],
  );
  const stableSetHovered = useCallback(
    (l: string | null) => hoveredRef.current(l),
    [],
  );
  const stableRegisterNavigate = useCallback(
    (fn: (nodeId: string) => void) => {
      navigateCameraRef.current = fn;
    },
    [],
  );

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleToggleFocus = useCallback(() => {
    if (!selectedId) return;
    setFocusedNodeId((prev) => (prev === selectedId ? null : selectedId));
  }, [selectedId]);

  const isFocused = focusedNodeId === selectedId && selectedId !== null;

  return (
    <div className="flex flex-col h-full bg-card text-text-primary overflow-hidden">
      <GraphToolbar
        focusedNodeId={focusedNodeId}
        onExitFocus={() => setFocusedNodeId(null)}
        activeHitCount={activeHitCount}
        onExpandClick={onExpandClick}
      />
      <GraphFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchHitCount={searchHighlights.size}
        topN={topN}
        onTopNChange={setTopN}
        maxSlider={maxSlider}
        hoveredLabel={hoveredLabel}
        graphOrder={graph.order}
        graphSize={graph.size}
        typeCounts={typeCounts}
        hiddenTypes={hiddenTypes}
        onToggleType={toggleType}
      />
      {graphSummary && !selectedAttrs && !selectedEdge && (
        <div className="px-3 py-1 border-b border-border-warm shrink-0 text-[10px] leading-relaxed text-warm-olive">
          {graphSummary}
        </div>
      )}
      <GraphCanvas
        botId={botId}
        graph={graph}
        isLoading={isLoading}
        hasNodes={rawNodes.length > 0}
        hiddenTypes={hiddenTypes}
        selectedId={selectedId}
        focusedNodeId={focusedNodeId}
        searchHighlights={searchHighlights}
        onNodeClick={stableNodeClick}
        onEdgeClick={stableEdgeClick}
        setHovered={stableSetHovered}
        onRegisterNavigate={stableRegisterNavigate}
      />
      {selectedId && selectedAttrs && (
        <GraphNodeInspector
          selectedId={selectedId}
          selectedAttrs={selectedAttrs}
          isFocused={isFocused}
          onClose={() => handleNodeClick(null, null)}
          onToggleFocus={handleToggleFocus}
          onAskAboutEntity={onAskAboutEntity}
        />
      )}
      {selectedEdge && (
        <GraphEdgeInspector
          edgeAttrs={selectedEdge}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </div>
  );
}
