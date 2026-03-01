import { Panel as ResizablePanel, PanelGroup as ResizablePanelGroup, PanelResizeHandle as ResizableHandle } from "react-resizable-panels";
import { Link, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import React, { type ReactNode, useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
    Bot,
    Settings,
    Database,
    Menu,
    X,
    ChevronLeft,
    Search,
    Plus,
    Trash2
} from "lucide-react";
import { cn } from "../../lib/utils";
import ParticleBackground from "../ui/ParticleBackground";

interface ChatLayoutProps {
    children: ReactNode;
    rightPanel?: ReactNode;
    sessions?: any[];
    currentSessionId?: string | null;
    onSelectSession?: (id: string) => void;
    onDeleteSession?: (id: string) => void;
    onClearHistory?: () => void;
    onNewChat?: () => void;
    botName?: string;
    botModel?: string;
    embedded?: boolean;
}

export default function ChatLayout({
    children,
    rightPanel,
    sessions = [],
    currentSessionId,
    onSelectSession,
    onDeleteSession,
    onClearHistory,
    onNewChat,
    botName = "Bot Configuration",
    botModel = "GPT-4o",
    embedded = false
}: ChatLayoutProps) {
    const { id } = useParams<{ id: string }>();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isDesktop = useMediaQuery("(min-width: 1024px)");
    const { user } = useAuthStore();

    // Panel sizes state (persisted)
    const [leftSize, setLeftSize] = useState(20);
    const [rightSize, setRightSize] = useState(25);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    // Toggle Right Panel
    const toggleRightPanel = () => {
        setIsRightCollapsed(!isRightCollapsed);
    }

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col font-sans relative">
            <div className="absolute inset-0 pointer-events-none z-0">
                <ParticleBackground />
            </div>

            <div className="flex flex-col h-full w-full relative z-10">
                {/* Mobile Header */}
                {!isDesktop && !embedded && (
                    <div className="h-14 border-b flex items-center px-4 justify-between bg-card">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            <Menu className="h-5 w-5" />
                        </button>
                        <span className="font-semibold">OmniRAG Chat</span>
                        <div className="w-5" /> {/* Spacer */}
                    </div>
                )}

                {/* Main Layout */}
                <div className="flex-1 h-full overflow-hidden relative">
                    <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border">

                        {/* Left Panel: Sidebar / History */}
                        {!embedded && (isDesktop || isMobileMenuOpen) && (
                            <ResizablePanel
                                defaultSize={leftSize}
                                minSize={15}
                                maxSize={30}
                                className={cn(
                                    "bg-background/40 backdrop-blur-2xl border-r border-white/5 flex flex-col transition-all duration-300",
                                    !isDesktop && "absolute inset-0 z-50 bg-background/95 w-3/4 shadow-2xl"
                                )}
                                onResize={setLeftSize}
                            >
                                <div className="flex flex-col h-full">
                                    {/* Sidebar Header */}
                                    <div className="h-14 px-4 border-b flex items-center justify-between">
                                        <Link to="/bots" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                                            <ChevronLeft className="h-4 w-4" />
                                            <span className="font-medium text-sm">Back to Bots</span>
                                        </Link>
                                        {!isDesktop && (
                                            <button onClick={() => setIsMobileMenuOpen(false)}>
                                                <X className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* New Chat Button */}
                                    <div className="p-4">
                                        <button
                                            onClick={onNewChat}
                                            className="w-full flex items-center gap-2 justify-center bg-primary text-primary-foreground py-2.5 rounded-xl font-medium shadow-sm hover:shadow-md transition-all active:scale-95"
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span>New Chat</span>
                                        </button>
                                    </div>

                                    {/* History List */}
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                        {sessions.length > 0 ? (
                                            <>
                                                <div className="px-3 py-2 flex items-center justify-between group/header">
                                                    <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">History</div>
                                                    {onClearHistory && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onClearHistory();
                                                            }}
                                                            className="opacity-0 group-hover/header:opacity-100 text-[10px] font-bold text-red-500 hover:underline uppercase transition-opacity"
                                                        >
                                                            Clear All
                                                        </button>
                                                    )}
                                                </div>
                                                {sessions.map((session) => (
                                                    <div key={session.id} className="relative group/item">
                                                        <button
                                                            onClick={() => onSelectSession?.(session.id)}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors flex items-center gap-2 pr-8",
                                                                currentSessionId === session.id
                                                                    ? "bg-primary/10 text-primary font-medium"
                                                                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            <span className="truncate">{session.title}</span>
                                                        </button>
                                                        {onDeleteSession && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeleteSession(session.id);
                                                                }}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover/item:opacity-100 hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div className="px-3 py-8 text-center text-xs text-muted-foreground italic">
                                                No conversations yet
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom User Profile */}
                                    <div className="p-4 border-t border-white/5 bg-background/20 backdrop-blur-md">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold ring-2 ring-background shadow-sm">
                                                {user?.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium truncate">{user?.full_name || 'User'}</span>
                                                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ResizablePanel>
                        )}

                        {!embedded && isDesktop && <ResizableHandle withHandle />}

                        {/* Center Panel: Chat Interface */}
                        <ResizablePanel defaultSize={100 - leftSize - (isRightCollapsed ? 0 : rightSize)} minSize={30}>
                            <div className="h-full flex flex-col bg-transparent relative">
                                {/* Chat Header */}
                                <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-background/40 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                                            <Bot className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h1 className="font-semibold text-sm">{botName}</h1>
                                            <div className="flex items-center gap-1.5">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                                <span className="text-xs text-muted-foreground">{botModel}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleRightPanel}
                                            className={cn("p-2 rounded-lg hover:bg-muted transition-colors", !isRightCollapsed && "bg-muted text-primary")}
                                            title="Toggle Evidence Panel"
                                        >
                                            <Database className="h-5 w-5" />
                                        </button>
                                        <Link to={`/bots/${id}/config`} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Settings">
                                            <Settings className="h-5 w-5" />
                                        </Link>
                                    </div>
                                </div>

                                {/* Main Content Area */}
                                <div className="flex-1 overflow-hidden relative">
                                    {children}
                                </div>
                            </div>
                        </ResizablePanel>

                        {/* Right Panel: Evidence / Preview */}
                        {!isRightCollapsed && (
                            <>
                                {isDesktop && <ResizableHandle withHandle />}
                                <ResizablePanel
                                    defaultSize={rightSize}
                                    minSize={20}
                                    maxSize={45}
                                    onResize={setRightSize}
                                    className="bg-background/40 backdrop-blur-2xl border-l border-white/5"
                                >
                                    <div className="h-full flex flex-col relative overflow-hidden bg-background/30">
                                        {rightPanel ? (
                                            <div className="absolute inset-0 z-0 flex flex-col">
                                                {rightPanel}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="h-14 border-b border-white/5 flex items-center px-4 bg-background/30 backdrop-blur-md relative z-10">
                                                    <span className="font-semibold text-sm text-primary uppercase tracking-widest text-[11px]">Knowledge Graph</span>
                                                </div>
                                                <div className="flex-1 bg-grid-white/[0.02] flex items-center justify-center p-4 relative z-10">
                                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 text-center">
                                                        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                                            <Search className="h-8 w-8 text-primary" strokeWidth={1.5} />
                                                        </div>
                                                        <p className="font-medium text-foreground tracking-wide">Analysis Engine Standby</p>
                                                        <p className="text-xs max-w-[200px] mt-2 leading-relaxed">System will map documents when a query is processed.</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </ResizablePanel>
                            </>
                        )}

                    </ResizablePanelGroup>
                </div>
            </div>
        </div>
    );
}
