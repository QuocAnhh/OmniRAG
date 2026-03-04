import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { SigmaContainer, useRegisterEvents, useSigma, useLoadGraph } from '@react-sigma/core'
import { NodeBorderProgram } from '@sigma/node-border'
import { createEdgeCurveProgram } from '@sigma/edge-curve'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import '@react-sigma/core/lib/style.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface RawNode {
    id: string;
    name: string;
    type: string;
    description?: string;
    source_id?: string;
    file_path?: string;
}
interface RawLink {
    source: string;
    target: string;
    relation?: string;
    description?: string;
    weight?: number;
}
interface KnowledgeGraphPanelProps {
    botId: string;
    activeEntities?: string[];
    onExpandClick?: () => void;
    defaultTopN?: number;
    onAskAboutEntity?: (query: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_TOP_N = 20;
const MAX_STORED    = 300;

const TYPE_META: Record<string, { solid: string; label: string }> = {
    concept:       { solid: '#e3493b', label: 'Concept'   },
    method:        { solid: '#b71c1c', label: 'Method'    },
    organization:  { solid: '#00cc00', label: 'Org'       },
    person:        { solid: '#4169E1', label: 'Person'    },
    location:      { solid: '#cf6d17', label: 'Location'  },
    event:         { solid: '#00bfa0', label: 'Event'     },
    artifact:      { solid: '#4421af', label: 'Artifact'  },
    data:          { solid: '#0000ff', label: 'Data'      },
    content:       { solid: '#0f558a', label: 'Content'   },
    naturalobject: { solid: '#b2e061', label: 'Nature'    },
    other:         { solid: '#f4d371', label: 'Other'     },
    unknown:       { solid: '#b0b0b0', label: 'Unknown'   },
    entity:        { solid: '#5D6D7E', label: 'Entity'    },
    creature:      { solid: '#bd7ebe', label: 'Creature'  },
    policy:        { solid: '#ff9800', label: 'Policy'    },
};
const DEFAULT_HIDDEN_TYPES = new Set(['person', 'content', 'data', 'unknown', 'naturalobject', 'creature']);

const BORDER_DEFAULT  = '#EEEEEE';
const BORDER_ACTIVE   = '#F57F17';
const BORDER_SEARCH   = '#FFD700';
const MIN_NODE_SIZE   = 4;
const MAX_NODE_SIZE   = 20;

function typeColor(type: string) {
    return TYPE_META[type.toLowerCase()]?.solid ?? TYPE_META.entity.solid;
}
function typeLabel(type: string) {
    return TYPE_META[type.toLowerCase()]?.label ?? type;
}

// ── Build graphology graph ────────────────────────────────────────────────────
function buildGraphology(
    rawNodes: RawNode[],
    rawLinks: RawLink[],
    topN: number,
    activeSet: Set<string>,
): Graph {
    const degMap: Record<string, number> = {};
    rawNodes.forEach(n => { degMap[n.id] = 0; });
    rawLinks.forEach(l => {
        if (degMap[l.source] !== undefined) degMap[l.source]++;
        if (degMap[l.target] !== undefined) degMap[l.target]++;
    });

    const activeMatches = rawNodes.filter(n => {
        const lbl = n.name.toLowerCase();
        const id  = n.id.toLowerCase();
        return activeSet.has(lbl) || activeSet.has(id);
    });
    const pinned    = new Set(activeMatches.map(n => n.id));
    const others    = rawNodes
        .filter(n => !pinned.has(n.id))
        .sort((a, b) => (degMap[b.id] ?? 0) - (degMap[a.id] ?? 0));
    const remaining = Math.max(0, topN - pinned.size);
    const topNodes  = [...activeMatches, ...others.slice(0, remaining)];
    const nodeSet   = new Set(topNodes.map(n => n.id));

    const degrees = topNodes.map(n => degMap[n.id] ?? 0);
    const minDeg  = degrees.length ? Math.min(...degrees) : 0;
    const maxDeg  = degrees.length ? Math.max(...degrees) : 1;
    const range   = maxDeg - minDeg || 1;
    const scale   = MAX_NODE_SIZE - MIN_NODE_SIZE;

    const graph = new Graph({ multi: false, type: 'undirected' });

    topNodes.forEach(n => {
        const deg    = degMap[n.id] ?? 0;
        const size   = Math.round(MIN_NODE_SIZE + scale * Math.pow((deg - minDeg) / range, 0.5));
        const type   = n.type.toLowerCase();
        const active = pinned.has(n.id);
        graph.addNode(n.id, {
            label:       n.name,
            color:       typeColor(type),
            size:        active ? Math.max(size, MIN_NODE_SIZE + 4) : size,
            borderColor: active ? BORDER_ACTIVE : BORDER_DEFAULT,
            borderSize:  active ? 0.25 : 0.15,
            nodeType:    type,
            description: n.description ?? '',
            filePath:    n.file_path ?? '',
            isActiveEntity: active,
            x: Math.random(),
            y: Math.random(),
        });
    });

    const seen = new Set<string>();
    rawLinks.forEach(l => {
        if (!nodeSet.has(l.source) || !nodeSet.has(l.target)) return;
        const key = [l.source, l.target].sort().join('\x00');
        if (seen.has(key)) return;
        seen.add(key);
        try {
            graph.addEdge(l.source, l.target, {
                label: l.relation ?? '',
                size:  l.weight ? Math.min(Math.max(l.weight * 0.8, 0.5), 4) : 1,
                color: '#888888',
                type:  'curvedNoArrow',
            });
        } catch { /* dup guard */ }
    });

    return graph;
}

// ── Inner controller – inside SigmaContainer ─────────────────────────────────
interface ControllerProps {
    graph:            Graph;
    hiddenTypes:      Set<string>;
    selectedId:       string | null;
    focusedNodeId:    string | null;
    searchHighlights: Set<string>;
    onNodeClick:      (id: string | null, attrs: Record<string, any> | null) => void;
    onEdgeClick:      (attrs: Record<string, any> | null) => void;
    setHovered:       (label: string | null) => void;
    onRegisterNavigate: (fn: (nodeId: string) => void) => void;
}

function GraphController({
    graph, hiddenTypes, selectedId, focusedNodeId, searchHighlights,
    onNodeClick, onEdgeClick, setHovered, onRegisterNavigate,
}: ControllerProps) {
    const sigma          = useSigma();
    const loadGraph      = useLoadGraph();
    const registerEvents = useRegisterEvents();

    // Register camera navigation function
    useEffect(() => {
        onRegisterNavigate((nodeId: string) => {
            const g = sigma.getGraph();
            if (!g.hasNode(nodeId)) return;
            const x = g.getNodeAttribute(nodeId, 'x');
            const y = g.getNodeAttribute(nodeId, 'y');
            if (x != null && y != null) {
                sigma.getCamera().animate({ x, y, ratio: 0.3 }, { duration: 500 });
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sigma]);

    // Load graph + ForceAtlas2 layout
    useEffect(() => {
        loadGraph(graph);
        if (graph.order === 0) return;
        try {
            forceAtlas2.assign(graph, {
                iterations: 200,
                settings: {
                    gravity:           1,
                    scalingRatio:      10,
                    slowDown:          5,
                    barnesHutOptimize: graph.order > 150,
                    barnesHutTheta:    0.5,
                    adjustSizes:       false,
                    linLogMode:        false,
                    outboundAttractionDistribution: false,
                },
            });
        } catch (e) { console.warn('FA2:', e); }
        graph.forEachNode((nodeId, attrs) => {
            graph.setNodeAttribute(nodeId, 'hidden', hiddenTypes.has(attrs.nodeType ?? ''));
        });
        sigma.refresh();
        sigma.getCamera().animatedReset({ duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graph, loadGraph]);

    // Visibility: hidden types + ego-network focus mode
    useEffect(() => {
        const g = sigma.getGraph();
        if (g.order === 0) return;
        let neighbors: Set<string> | null = null;
        if (focusedNodeId && g.hasNode(focusedNodeId)) {
            neighbors = new Set(g.neighbors(focusedNodeId));
        }
        g.forEachNode((nodeId, attrs) => {
            let hidden = hiddenTypes.has(attrs.nodeType ?? '');
            if (neighbors && nodeId !== focusedNodeId && !neighbors.has(nodeId)) {
                hidden = true;
            }
            g.setNodeAttribute(nodeId, 'hidden', hidden);
        });
        sigma.refresh();
    }, [hiddenTypes, focusedNodeId, sigma]);

    // Unified border: selected > search > active-entity > default
    useEffect(() => {
        const g = sigma.getGraph();
        if (g.order === 0) return;
        g.forEachNode((nodeId, attrs) => {
            if (nodeId === selectedId) {
                g.setNodeAttribute(nodeId, 'borderColor', BORDER_ACTIVE);
                g.setNodeAttribute(nodeId, 'borderSize', 0.3);
            } else if (searchHighlights.size > 0 && searchHighlights.has(nodeId)) {
                g.setNodeAttribute(nodeId, 'borderColor', BORDER_SEARCH);
                g.setNodeAttribute(nodeId, 'borderSize', 0.28);
            } else if (attrs.isActiveEntity) {
                g.setNodeAttribute(nodeId, 'borderColor', BORDER_ACTIVE);
                g.setNodeAttribute(nodeId, 'borderSize', 0.25);
            } else {
                g.setNodeAttribute(nodeId, 'borderColor', BORDER_DEFAULT);
                g.setNodeAttribute(nodeId, 'borderSize', 0.15);
            }
        });
        sigma.refresh();
    }, [selectedId, searchHighlights, sigma]);

    // Events
    useEffect(() => {
        registerEvents({
            clickNode:  (e) => {
                const attrs = sigma.getGraph().getNodeAttributes(e.node);
                onNodeClick(e.node, attrs);
            },
            clickEdge:  (e) => {
                const attrs = sigma.getGraph().getEdgeAttributes(e.edge);
                onEdgeClick(attrs);
            },
            clickStage: () => { onNodeClick(null, null); onEdgeClick(null); },
            enterNode:  (e) => {
                setHovered(sigma.getGraph().getNodeAttribute(e.node, 'label') ?? e.node);
                sigma.getCanvas().style.cursor = 'pointer';
            },
            leaveNode: () => { setHovered(null); sigma.getCanvas().style.cursor = ''; },
        });
    }, [registerEvents, sigma, onNodeClick, onEdgeClick, setHovered]);

    return null;
}

// ── Sigma settings (module-level – never recreated) ───────────────────────────
const SIGMA_SETTINGS = {
    allowInvalidContainer: true,
    defaultNodeType:  'border',
    defaultEdgeType:  'curvedNoArrow',
    renderEdgeLabels: false,
    enableEdgeEvents: true,
    edgeProgramClasses: {
        curvedNoArrow: createEdgeCurveProgram(),
    },
    nodeProgramClasses: {
        border: NodeBorderProgram,
    },
    labelRenderedSizeThreshold: 8,
    labelGridCellSize:  60,
    labelSize:          12,
    labelColor:         { color: '#ffffff' },
    edgeLabelSize:      8,
    defaultDrawNodeHover: (
        ctx:      CanvasRenderingContext2D,
        data:     Record<string, any>,
        settings: Record<string, any>,
    ) => {
        const x      = data.x    as number;
        const y      = data.y    as number;
        const size   = (data.size as number) || 6;
        const label  = data.label as string | undefined;
        const color  = (data.color as string) || '#6366f1';
        const fs     = (settings.labelSize as number) || 12;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size + 5, 0, Math.PI * 2);
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.restore();

        if (label) {
            ctx.save();
            ctx.font = `600 ${fs}px sans-serif`;
            const tw  = ctx.measureText(label).width;
            const pad = 6;
            const px  = x + size + 8;
            const py  = y + fs * 0.35;
            const rx  = px - pad;
            const ry  = py - fs;
            const rw  = tw + pad * 2;
            const rh  = fs + pad;
            const r   = 4;
            ctx.fillStyle = 'rgba(10,12,18,0.90)';
            ctx.beginPath();
            ctx.moveTo(rx + r, ry);
            ctx.lineTo(rx + rw - r, ry);
            ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
            ctx.lineTo(rx + rw, ry + rh - r);
            ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
            ctx.lineTo(rx + r, ry + rh);
            ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
            ctx.lineTo(rx, ry + r);
            ctx.quadraticCurveTo(rx, ry, rx + r, ry);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#f1f5f9';
            ctx.fillText(label, px, py);
            ctx.restore();
        }
    },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function KnowledgeGraphPanel({
    botId,
    activeEntities = [],
    onExpandClick,
    defaultTopN,
    onAskAboutEntity,
}: KnowledgeGraphPanelProps) {
    const [rawNodes,        setRawNodes]        = useState<RawNode[]>([]);
    const [rawLinks,        setRawLinks]        = useState<RawLink[]>([]);
    const [isLoading,       setIsLoading]       = useState(false);
    const [topN,            setTopN]            = useState(defaultTopN ?? DEFAULT_TOP_N);
    const [hiddenTypes,     setHiddenTypes]     = useState<Set<string>>(new Set(DEFAULT_HIDDEN_TYPES));
    const [typeCounts,      setTypeCounts]      = useState<Record<string, number>>({});
    const [selectedId,      setSelectedId]      = useState<string | null>(null);
    const [selectedAttrs,   setSelectedAttrs]   = useState<Record<string, any> | null>(null);
    const [selectedEdge,    setSelectedEdge]    = useState<Record<string, any> | null>(null);
    const [hoveredLabel,    setHoveredLabel]    = useState<string | null>(null);
    // New state
    const [searchQuery,     setSearchQuery]     = useState('');
    const [focusedNodeId,   setFocusedNodeId]   = useState<string | null>(null);
    const [graphSummary,    setGraphSummary]    = useState<string>('');
    const navigateCameraRef = useRef<((nodeId: string) => void) | null>(null);

    const maxSlider = Math.min(rawNodes.length || DEFAULT_TOP_N, MAX_STORED);

    const activeSet = useMemo(
        () => new Set(activeEntities.map(e => e.toLowerCase())),
        [activeEntities],
    );
    const activeHitCount = useMemo(() => {
        if (!activeSet.size || !rawNodes.length) return 0;
        return rawNodes.filter(n =>
            activeSet.has(n.name.toLowerCase()) || activeSet.has(n.id.toLowerCase())
        ).length;
    }, [activeSet, rawNodes]);

    // Search: derive matching node IDs from the current graph
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
            const label = (attrs.label as string ?? '').toLowerCase();
            if (label.includes(q)) hits.add(nodeId);
        });
        return hits;
    }, [searchQuery, graph]);

    // Navigate camera to first search result
    useEffect(() => {
        if (searchHighlights.size > 0 && navigateCameraRef.current) {
            const firstHit = searchHighlights.values().next().value;
            if (firstHit) navigateCameraRef.current(firstHit);
        }
    }, [searchHighlights]);

    // Fetch
    useEffect(() => {
        if (!botId) return;
        setIsLoading(true);
        import('../../api/bots').then(({ botsApi }) => {
            botsApi.getKnowledgeGraph(botId)
                .then(data => {
                    const nodes = (data.nodes ?? []).slice(0, MAX_STORED) as RawNode[];
                    const links = (data.links ?? []) as RawLink[];
                    setRawNodes(nodes);
                    setRawLinks(links);
                    const counts: Record<string, number> = {};
                    for (const n of nodes) {
                        const t = n.type?.toLowerCase() ?? 'unknown';
                        counts[t] = (counts[t] ?? 0) + 1;
                    }
                    setTypeCounts(counts);

                    // Build graph summary
                    if (nodes.length > 0) {
                        const degMap: Record<string, number> = {};
                        nodes.forEach(n => { degMap[n.id] = 0; });
                        links.forEach(l => {
                            if (degMap[l.source] !== undefined) degMap[l.source]++;
                            if (degMap[l.target] !== undefined) degMap[l.target]++;
                        });
                        const topNames = nodes
                            .slice()
                            .sort((a, b) => (degMap[b.id] ?? 0) - (degMap[a.id] ?? 0))
                            .slice(0, 3)
                            .map(n => n.name);
                        setGraphSummary(`${nodes.length} entities · ${links.length} connections · Key: ${topNames.join(', ')}`);
                    }
                })
                .catch(err => console.error('graph fetch:', err))
                .finally(() => setIsLoading(false));
        });
    }, [botId]);

    const nodeClickRef = useRef<(id: string | null, attrs: Record<string, any> | null) => void>(null!);
    const edgeClickRef = useRef<(attrs: Record<string, any> | null) => void>(null!);
    const hoveredRef   = useRef(setHoveredLabel);

    const handleNodeClick = useCallback((id: string | null, attrs: Record<string, any> | null) => {
        setSelectedId(id);
        setSelectedAttrs(attrs);
        setSelectedEdge(null);
        // Exit focus mode if clicking empty or a different node not in focus
        if (id === null) setFocusedNodeId(null);
    }, []);
    const handleEdgeClick = useCallback((attrs: Record<string, any> | null) => {
        setSelectedEdge(attrs); setSelectedId(null); setSelectedAttrs(null);
    }, []);

    nodeClickRef.current = handleNodeClick;
    edgeClickRef.current = handleEdgeClick;
    hoveredRef.current   = setHoveredLabel;

    const stableNodeClick  = useCallback((id: string | null, attrs: Record<string, any> | null) => nodeClickRef.current(id, attrs), []);
    const stableEdgeClick  = useCallback((attrs: Record<string, any> | null) => edgeClickRef.current(attrs), []);
    const stableSetHovered = useCallback((l: string | null) => hoveredRef.current(l), []);
    const stableRegisterNavigate = useCallback((fn: (nodeId: string) => void) => {
        navigateCameraRef.current = fn;
    }, []);

    const toggleType = useCallback((type: string) => {
        setHiddenTypes(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type); else next.add(type);
            return next;
        });
    }, []);

    const handleFocusNode = useCallback(() => {
        if (!selectedId) return;
        setFocusedNodeId(prev => prev === selectedId ? null : selectedId);
    }, [selectedId]);

    const selType     = selectedAttrs?.nodeType ?? '';
    const selColor    = typeColor(selType);
    const selDesc     = (selectedAttrs?.description ?? '').split('\n')[0];
    const selFile     = selectedAttrs?.filePath ?? '';
    const selFileName = selFile && selFile !== 'unknown_source'
        ? selFile.split(/[\\/]/).pop()
        : null;
    const selName     = selectedAttrs?.label ?? selectedId ?? '';
    const isFocused   = focusedNodeId === selectedId && selectedId !== null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0f14', color: '#e2e8f0', overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/></svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', flex: 1 }}>Knowledge Graph</span>
                {focusedNodeId && (
                    <button onClick={() => setFocusedNodeId(null)} title="Exit focus mode" style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 700, color: '#f97316',
                        background: '#f9731620', border: '1px solid #f9731640',
                        borderRadius: 8, padding: '2px 8px', cursor: 'pointer',
                    }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Exit focus
                    </button>
                )}
                {activeHitCount > 0 && (
                    <span style={{ fontSize: 11, background: '#F57F17', color: '#000', borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>
                        {activeHitCount} active
                    </span>
                )}
                {onExpandClick && (
                    <button onClick={onExpandClick} title="Full screen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                    </button>
                )}
            </div>

            {/* Search bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                    type="text"
                    placeholder="Search entities..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 11, color: '#e2e8f0', placeholder: '#4b5563',
                    }}
                />
                {searchHighlights.size > 0 && (
                    <span style={{ fontSize: 10, color: '#FFD700', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {searchHighlights.size} found
                    </span>
                )}
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1, fontSize: 12 }}>
                        ✕
                    </button>
                )}
            </div>

            {/* Density slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Density</span>
                <input type="range" min={1} max={maxSlider} value={topN}
                    onChange={e => setTopN(+e.target.value)}
                    style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {graph.order}n / {graph.size}e
                </span>
                {hoveredLabel && (
                    <span style={{ fontSize: 11, color: '#f97316', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hoveredLabel}
                    </span>
                )}
            </div>

            {/* Type filter pills */}
            {Object.keys(typeCounts).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 10px', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
                    {Object.entries(typeCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => {
                            const hidden = hiddenTypes.has(type);
                            const color  = typeColor(type);
                            const label  = typeLabel(type);
                            return (
                                <button key={type} onClick={() => toggleType(type)} style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '2px 7px', borderRadius: 12, border: 'none',
                                    cursor: 'pointer', fontSize: 10, fontWeight: 600,
                                    background: hidden ? '#1e2330' : `${color}22`,
                                    color:      hidden ? '#4b5563' : color,
                                    opacity:    hidden ? 0.55 : 1,
                                    transition: 'all 0.15s',
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hidden ? '#4b5563' : color, flexShrink: 0 }} />
                                    {label} <span style={{ opacity: 0.7 }}>{count}</span>
                                </button>
                            );
                        })}
                </div>
            )}

            {/* Graph summary */}
            {graphSummary && !selectedAttrs && !selectedEdge && (
                <div style={{
                    padding: '5px 12px', borderBottom: '1px solid #1e2330', flexShrink: 0,
                    fontSize: 10, color: '#4b5563', lineHeight: 1.5,
                }}>
                    {graphSummary}
                </div>
            )}

            {/* Graph canvas */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {isLoading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', zIndex: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 28, height: 28, border: '3px solid #1e2330', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'kgspin 0.8s linear infinite' }} />
                            <span style={{ fontSize: 12, color: '#6b7280' }}>Loading graph…</span>
                        </div>
                    </div>
                )}
                {!isLoading && rawNodes.length === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.5"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/></svg>
                        <span style={{ fontSize: 12, color: '#4b5563' }}>No graph data</span>
                        <span style={{ fontSize: 11, color: '#374151' }}>Upload documents to build the graph</span>
                    </div>
                )}
                {!isLoading && graph.order > 0 && (
                    <SigmaContainer
                        key={`sigma-${botId}`}
                        settings={SIGMA_SETTINGS as any}
                        style={{ width: '100%', height: '100%', background: '#0d0f14' }}
                    >
                        <GraphController
                            graph={graph}
                            hiddenTypes={hiddenTypes}
                            selectedId={selectedId}
                            focusedNodeId={focusedNodeId}
                            searchHighlights={searchHighlights}
                            onNodeClick={stableNodeClick}
                            onEdgeClick={stableEdgeClick}
                            setHovered={stableSetHovered}
                            onRegisterNavigate={stableRegisterNavigate}
                        />
                    </SigmaContainer>
                )}
            </div>

            {/* Selected node panel */}
            {selectedAttrs && (
                <div style={{ borderTop: '1px solid #1e2330', padding: '10px 12px', flexShrink: 0, maxHeight: 200, overflowY: 'auto', background: '#0a0c10' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: selColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selName}
                        </span>
                        <span style={{ fontSize: 10, background: `${selColor}22`, color: selColor, borderRadius: 8, padding: '1px 6px' }}>
                            {typeLabel(selType)}
                        </span>
                        <button onClick={() => handleNodeClick(null, null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                            ✕
                        </button>
                    </div>
                    {selDesc && <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.5 }}>{selDesc}</p>}
                    {selFileName && <p style={{ fontSize: 10, color: '#4b5563', margin: '0 0 8px' }}>Src: {selFileName}</p>}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Focus neighborhood */}
                        <button onClick={handleFocusNode} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 600,
                            color: isFocused ? '#f97316' : '#94a3b8',
                            background: isFocused ? '#f9731620' : '#1e2330',
                            border: isFocused ? '1px solid #f9731640' : '1px solid #2d3748',
                            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeDasharray="4 2"/></svg>
                            {isFocused ? 'Unfocus' : 'Focus neighborhood'}
                        </button>

                        {/* Ask AI */}
                        {onAskAboutEntity && (
                            <button
                                onClick={() => {
                                    onAskAboutEntity(`Tell me more about "${selName}"`);
                                    handleNodeClick(null, null);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 10, fontWeight: 600,
                                    color: '#a5b4fc',
                                    background: '#6366f120',
                                    border: '1px solid #6366f140',
                                    borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Ask AI about this
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Selected edge panel */}
            {selectedEdge && (
                <div style={{ borderTop: '1px solid #1e2330', padding: '10px 12px', flexShrink: 0, maxHeight: 120, overflowY: 'auto', background: '#0a0c10' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{selectedEdge.label || 'relation'}</span>
                        <button onClick={() => setSelectedEdge(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 'auto' }}>✕</button>
                    </div>
                    {selectedEdge.description?.split('\n')[0] && (
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                            {selectedEdge.description.split('\n')[0]}
                        </p>
                    )}
                </div>
            )}

            <style>{'@keyframes kgspin { to { transform: rotate(360deg); } }'}</style>
        </div>
    );
}
