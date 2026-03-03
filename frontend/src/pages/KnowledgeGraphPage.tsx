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
        <div className="flex flex-col h-screen w-screen bg-[#020617] overflow-hidden">
            {/* Top bar */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#020617]/80 backdrop-blur-sm z-30">
                {/* Back */}
                <button
                    onClick={() => navigate(`/bots/${id}/chat`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all text-xs font-medium"
                >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to chat
                </button>

                <div className="w-px h-5 bg-white/10" />

                {/* Bot name + badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="size-6 rounded-md shrink-0 flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)' }}
                    >
                        <span className="material-symbols-outlined text-[13px] text-indigo-400">hub</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-200 truncate leading-tight">
                            {bot?.name ?? 'Loading…'}
                        </p>
                        <p className="text-[9px] text-slate-500 leading-tight uppercase tracking-wider">Knowledge Graph</p>
                    </div>
                </div>

                <div className="flex-1" />

                {/* Hint */}
                <p className="text-[9px] text-slate-600 hidden sm:block">
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
