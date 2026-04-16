import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import KnowledgeGraphPanel from '../components/chat/KnowledgeGraphPanel';

interface Bot { id: string; name: string; description?: string; }

export default function KnowledgeGraphPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [bot, setBot] = useState<Bot | null>(null);

    useEffect(() => {
        if (!id) return;
        import('../api/bots').then(({ botsApi }) => {
            botsApi.get(id).then(setBot).catch(() => {});
        });
    }, [id]);

    return (
        <div className="flex flex-col h-screen w-screen bg-warm-parchment overflow-hidden">
            {/* Top bar */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border-warm bg-white z-30">
                <button
                    onClick={() => navigate(`/bots/${id}/chat`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-comfort text-text-tertiary hover:text-text-primary hover:bg-warm-cream transition-all text-xs font-medium"
                >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to chat
                </button>

                <div className="w-px h-5 bg-border-warm" />

                <div className="flex items-center gap-2 min-w-0">
                    <div className="size-6 rounded-subtle shrink-0 flex items-center justify-center bg-primary/10 border border-primary/25">
                        <span className="material-symbols-outlined text-[13px] text-primary">hub</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-text-primary truncate leading-tight">
                            {bot?.name ?? 'Loading…'}
                        </p>
                        <p className="text-[9px] text-text-tertiary leading-tight uppercase tracking-wider">Knowledge Graph</p>
                    </div>
                </div>

                <div className="flex-1" />

                <p className="text-[9px] text-text-muted hidden sm:block">
                    Click a node to explore &nbsp;·&nbsp; Drag to pan &nbsp;·&nbsp; Scroll to zoom
                </p>
            </div>

            {/* Full-screen graph */}
            <div className="flex-1 min-h-0">
                <KnowledgeGraphPanel
                    botId={id!}
                    activeEntities={[]}
                    defaultTopN={60}
                />
            </div>
        </div>
    );
}
