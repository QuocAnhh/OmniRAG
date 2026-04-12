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
        <div className="flex flex-col h-screen w-screen bg-[#f5f4ed] overflow-hidden">
            {/* Top bar */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[#e8e6dc] bg-white z-30">
                {/* Back */}
                <button
                    onClick={() => navigate(`/bots/${id}/chat`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#87867f] hover:text-[#141413] hover:bg-[#f0eee6] transition-all text-xs font-medium"
                >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to chat
                </button>

                <div className="w-px h-5 bg-[#e8e6dc]" />

                {/* Bot name + badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="size-6 rounded-md shrink-0 flex items-center justify-center"
                        style={{ background: 'rgba(201,100,66,0.1)', border: '1px solid rgba(201,100,66,0.25)' }}
                    >
                        <span className="material-symbols-outlined text-[13px] text-[#c96442]">hub</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#141413] truncate leading-tight">
                            {bot?.name ?? 'Loading…'}
                        </p>
                        <p className="text-[9px] text-[#87867f] leading-tight uppercase tracking-wider">Knowledge Graph</p>
                    </div>
                </div>

                <div className="flex-1" />

                {/* Hint */}
                <p className="text-[9px] text-[#b0aea5] hidden sm:block">
                    Click a node to explore &nbsp;·&nbsp; Drag to pan &nbsp;·&nbsp; Scroll to zoom
                </p>
            </div>

            {/* Full-screen graph — panel fills remaining height */}
            <div className="flex-1 min-h-0">
                <KnowledgeGraphPanel
                    botId={id}
                    activeEntities={[]}
                    defaultTopN={60}
                />
            </div>
        </div>
    );
}
