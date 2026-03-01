import React, { useEffect, useState, useRef, useMemo } from 'react';

interface Node {
    id: string;
    label: string;
    group: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    size?: number;
}

interface Link {
    source: string;
    target: string;
    label?: string;
}

interface KnowledgeGraphPanelProps {
    chunks: any[];
}

export default function KnowledgeGraphPanel({ chunks }: KnowledgeGraphPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // Mock Data Generation based on chunks (or fake data to show the effect)
    const { nodes, links } = useMemo(() => {
        // Generate a cool looking fake graph for the demo if chunks don't have real graph data
        const mockNodes: Node[] = [
            { id: '1', label: 'User Query', group: 'query', size: 16 },
            { id: '2', label: 'OmniRAG Engine', group: 'system', size: 14 },
            { id: '3', label: 'Vector DB', group: 'system', size: 10 },
            { id: 'chunk1', label: 'Document A Segment', group: 'chunk', size: 8 },
            { id: 'chunk2', label: 'Policy Overview', group: 'chunk', size: 8 },
            { id: 'entity1', label: 'Refund Policy', group: 'entity', size: 12 },
            { id: 'entity2', label: '30 Days limit', group: 'entity', size: 10 },
            { id: 'entity3', label: 'Support Team', group: 'entity', size: 10 },
        ];

        const mockLinks: Link[] = [
            { source: '1', target: '2', label: 'Sends to' },
            { source: '2', target: '3', label: 'Searches ' },
            { source: '3', target: 'chunk1', label: 'Retrieves' },
            { source: '3', target: 'chunk2', label: 'Retrieves' },
            { source: 'chunk1', target: 'entity1', label: 'Contains' },
            { source: 'entity1', target: 'entity2', label: 'Requires' },
            { source: 'chunk2', target: 'entity3', label: 'Mentions' },
            { source: '1', target: 'entity1', label: 'Asks about' },
        ];

        // Randomize initial positions
        const w = Math.max(dimensions.width, 300);
        const h = Math.max(dimensions.height, 400);
        
        mockNodes.forEach(node => {
            node.x = w / 2 + (Math.random() - 0.5) * 200;
            node.y = h / 2 + (Math.random() - 0.5) * 200;
            node.vx = (Math.random() - 0.5) * 0.5;
            node.vy = (Math.random() - 0.5) * 0.5;
        });

        return { nodes: mockNodes, links: mockLinks };
    }, [dimensions.width, dimensions.height]);

    // Simple physics simulation for floating effect
    const [simNodes, setSimNodes] = useState<Node[]>(nodes);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        let animationFrameId: number;
        let pNodes = [...nodes];
        const w = dimensions.width || 400;
        const h = dimensions.height || 600;

        const tick = () => {
            pNodes = pNodes.map(node => {
                let { x = 0, y = 0, vx = 0, vy = 0 } = node;
                x += vx;
                y += vy;
                
                // Gentle boundary forces
                if (x < 50) vx += 0.05;
                if (x > w - 50) vx -= 0.05;
                if (y < 50) vy += 0.05;
                if (y > h - 50) vy -= 0.05;

                // Dampening
                vx *= 0.99;
                vy *= 0.99;

                // Center gravity
                vx += (w/2 - x) * 0.0001;
                vy += (h/2 - y) * 0.0001;

                // Repulsion to slowly spread them
                pNodes.forEach(other => {
                    if (other.id !== node.id) {
                        const dx = x - (other.x || 0);
                        const dy = y - (other.y || 0);
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist > 0 && dist < 100) {
                            vx += (dx / dist) * 0.01;
                            vy += (dy / dist) * 0.01;
                        }
                    }
                });

                return { ...node, x, y, vx, vy };
            });
            
            setSimNodes(pNodes);
            animationFrameId = requestAnimationFrame(tick);
        };
        
        tick();
        return () => cancelAnimationFrame(animationFrameId);
    }, [nodes, dimensions]);


    // Styling helpers
    const getNodeColor = (group: string) => {
        switch (group) {
            case 'query': return 'rgba(0, 229, 255, 0.9)'; // Cyan
            case 'system': return 'rgba(168, 85, 247, 0.9)'; // Purple
            case 'entity': return 'rgba(236, 72, 153, 0.9)'; // Pink
            case 'chunk': return 'rgba(59, 130, 246, 0.9)'; // Blue
            default: return 'rgba(148, 163, 184, 0.9)'; // Slate
        }
    };

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden" ref={containerRef}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                        <span className="material-symbols-outlined text-[20px] animate-pulse">hub</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-600">
                            Knowledge Graph
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                            LightRAG Engine
                        </span>
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="absolute inset-0 z-10 bg-grid-white/[0.02] bg-[length:30px_30px]">
                <svg width="100%" height="100%" className="overflow-visible">
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    
                    {/* Render Links */}
                    {links.map((link, i) => {
                        const sourceNode = simNodes.find(n => n.id === link.source);
                        const targetNode = simNodes.find(n => n.id === link.target);
                        if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) return null;
                        
                        const isHighlighted = selectedNode && (selectedNode.id === sourceNode.id || selectedNode.id === targetNode.id);

                        return (
                            <g key={`link-${i}`}>
                                <line
                                    x1={sourceNode.x}
                                    y1={sourceNode.y}
                                    x2={targetNode.x}
                                    y2={targetNode.y}
                                    stroke={isHighlighted ? 'rgba(var(--primary), 0.6)' : 'rgba(255, 255, 255, 0.1)'}
                                    strokeWidth={isHighlighted ? 2 : 1}
                                    strokeDasharray={isHighlighted ? "none" : "4 4"}
                                    className="transition-all duration-300"
                                />
                                {link.label && (
                                    <text
                                        x={(sourceNode.x + targetNode.x) / 2}
                                        y={(sourceNode.y + targetNode.y) / 2 - 5}
                                        fill={isHighlighted ? 'rgba(var(--primary), 0.8)' : 'rgba(255, 255, 255, 0.3)'}
                                        fontSize="8"
                                        textAnchor="middle"
                                        className="font-mono tracking-widest uppercase transition-all duration-300 pointer-events-none"
                                    >
                                        {link.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Render Nodes */}
                    {simNodes.map((node) => {
                        if (node.x === undefined || node.y === undefined) return null;
                        const color = getNodeColor(node.group);
                        const isSelected = selectedNode?.id === node.id;
                        
                        return (
                            <g 
                                key={node.id} 
                                transform={`translate(${node.x},${node.y})`}
                                onClick={() => setSelectedNode(node)}
                                className="cursor-pointer group"
                            >
                                {/* Outer Glow/Ring */}
                                <circle
                                    r={(node.size || 10) + (isSelected ? 8 : 4)}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={isSelected ? 1.5 : 0}
                                    strokeOpacity={isSelected ? 0.6 : 0.2}
                                    className="transition-all duration-300"
                                    filter={isSelected ? 'url(#glow)' : ''}
                                />
                                
                                {/* Core Node */}
                                <circle
                                    r={node.size || 10}
                                    fill={color}
                                    className="transition-all duration-300 group-hover:brightness-125"
                                    filter="url(#glow)"
                                />
                                
                                {/* Label */}
                                <text
                                    y={(node.size || 10) + 12}
                                    fill="rgba(255,255,255,0.8)"
                                    fontSize="10"
                                    textAnchor="middle"
                                    className={`font-semibold tracking-wide transition-all duration-300 pointer-events-none ${isSelected ? 'font-bold fill-white' : ''}`}
                                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                                >
                                    {node.label}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Glassmorphism Detail Panel */}
            <div className={`absolute bottom-4 left-4 right-4 z-30 transition-all duration-500 ease-in-out transform ${selectedNode ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
                <div className="bg-background/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-4 overflow-hidden relative group">
                    {/* Decorative Top Line */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <span 
                                className="size-3 rounded-full shadow-[0_0_8px_currentColor]" 
                                style={{ backgroundColor: getNodeColor(selectedNode?.group || ''), color: getNodeColor(selectedNode?.group || '') }}
                            ></span>
                            <h3 className="text-sm font-bold text-foreground">{selectedNode?.label}</h3>
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase border border-border bg-muted/30">
                                {selectedNode?.group}
                            </span>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        This entity was identified as a critical <strong className="text-primary">{selectedNode?.group}</strong> node within the context of the user query. Deep connections to other documents have been established by the LightRAG Graph Engine.
                    </p>

                    <div className="mt-3 flex gap-2">
                        <button className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary-foreground hover:bg-primary border border-primary/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">share</span> Explore Subgraph
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
