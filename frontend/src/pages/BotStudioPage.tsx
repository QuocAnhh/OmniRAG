import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Panel as ResizablePanel, PanelGroup as ResizablePanelGroup, PanelResizeHandle as ResizableHandle } from "react-resizable-panels";
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';

import ChatPage from './ChatPage';
import Sidebar from '../components/Layout/Sidebar';

export default function BotStudioPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [bots, setBots] = useState<Bot[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBots();

        const handleRefresh = () => loadBots();
        window.addEventListener('bot-updated', handleRefresh);
        window.addEventListener('bot-created', handleRefresh);
        window.addEventListener('bot-deleted', handleRefresh);

        return () => {
            window.removeEventListener('bot-updated', handleRefresh);
            window.removeEventListener('bot-created', handleRefresh);
            window.removeEventListener('bot-deleted', handleRefresh);
        };
    }, []);

    const loadBots = async () => {
        try {
            const data = await botsApi.list();
            setBots(data);
        } catch (error) {
            console.error('Failed to load bots:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* 1. Main System Sidebar */}
            <Sidebar />

            {/* 2. Studio Workspace */}
            <div className="flex-1 flex overflow-hidden">
                <ResizablePanelGroup direction="horizontal">

                    {/* BOT LIST PANEL */}
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="border-r border-border bg-muted/10 flex flex-col relative z-20">
                        <div className="h-16 border-b border-border/40 flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm">
                            <h2 className="font-bold text-sm tracking-wide">WORKSPACE AGENTS</h2>
                            <Link to="/bots/new" className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors shadow-sm" title="Create New Bot">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </Link>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                            {loading ? (
                                <div className="animate-pulse space-y-2">
                                    <div className="h-12 bg-muted/50 rounded-xl w-full"></div>
                                    <div className="h-12 bg-muted/50 rounded-xl w-full"></div>
                                </div>
                            ) : bots.length === 0 ? (
                                <div className="text-center text-xs text-muted-foreground p-6 bg-card rounded-xl border border-dashed border-border mt-4">
                                    <span className="material-symbols-outlined text-2xl mb-2 opacity-50">smart_toy</span>
                                    <p>No agents yet.</p>
                                </div>
                            ) : (
                                bots.map(bot => (
                                    <button
                                        key={bot.id}
                                        onClick={() => navigate(`/bots/${bot.id}`)}
                                        className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center gap-3 transition-all outline-none focus:ring-2 focus:ring-primary/30 ${id === bot.id
                                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02] border border-primary/20'
                                            : 'hover:bg-card hover:border-border border border-transparent text-foreground hover:shadow-sm'
                                            }`}
                                    >
                                        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${id === bot.id ? 'bg-black/10 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                                            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                                        </div>
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold truncate leading-tight">{bot.name}</span>
                                                {bot.is_active && <span className={`size-1.5 rounded-full shrink-0 ${id === bot.id ? 'bg-primary-foreground' : 'bg-success-500'}`}></span>}
                                            </div>
                                            <span className={`text-[10px] truncate leading-tight mt-0.5 ${id === bot.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                {bot.config?.model || 'gpt-4o-mini'}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle className="w-1.5 bg-border/40 hover:bg-primary/50 transition-colors z-30" />

                    {/* WORKSPACE AREA */}
                    <ResizablePanel defaultSize={80} className="bg-background">
                        {id ? (
                            <div className="h-full w-full relative z-10">
                                <ChatPage embedded={true} />
                            </div>
                        ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center bg-muted/5 text-center px-6">
                                <div className="size-24 rounded-3xl bg-card border border-border shadow-sm flex items-center justify-center text-primary mb-8 relative
                                 before:absolute before:inset-0 before:bg-primary/5 before:rounded-3xl before:animate-pulse">
                                    <span className="material-symbols-outlined text-[48px]">dashboard_customize</span>
                                </div>
                                <h2 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">OmniRAG Studio</h2>
                                <p className="text-muted-foreground max-w-sm mb-8 text-sm leading-relaxed">
                                    The ultimate split-view IDE for your RAG applications. Select an agent from the sidebar or craft a new one.
                                </p>
                                <Link to="/bots/new" className="px-8 py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:-translate-y-1">
                                    Create New Agent
                                </Link>
                            </div>
                        )}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
