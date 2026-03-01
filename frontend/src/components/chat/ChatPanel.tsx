import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ChatLayout from '../components/Layout/ChatLayout';
import { ChatInput, ChatMessage, TypingIndicator } from '../components/chat/ChatInterface';
import KnowledgeGraphPanel from './KnowledgeGraphPanel';
import { chatApi } from '../api/chat';
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

function HighlightedText({ text, highlights }: { text: string; highlights?: string[] }) {
    if (!highlights || highlights.length === 0) return <>{text}</>;

    // Sort terms by length (desc) to match longer phrases first and avoid partial replacements
    const sortedTerms = [...highlights].sort((a, b) => b.length - a.length);
    // Escape special characters for regex
    const regex = new RegExp(`(${sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                highlights.some(h => h.toLowerCase() === part.toLowerCase()) ? (
                    <mark key={i} className="bg-primary/25 text-primary-foreground dark:text-primary-300 font-semibold px-0.5 rounded transition-all shadow-sm">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
}

export default function ChatPage() {
    const { id } = useParams<{ id: string }>();
    const [bot, setBot] = useState<Bot | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedEvidence, setSelectedEvidence] = useState<any[] | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    // Auto-scroll on message changes
    useEffect(() => {
        if (isTyping) {
            scrollToBottom("auto");
        }
    }, [messages, isTyping]);

    // Load Bot and Session List
    useEffect(() => {
        setSessionId(null);
        setMessages([]);
        setSelectedEvidence(null);

        const loadBotAndSessions = async () => {
            if (!id) return;
            try {
                const botData = await botsApi.get(id);
                setBot(botData);

                // Fetch sessions
                const sessionList = await chatApi.getSessions(id);
                setSessions(sessionList);

                // Default welcome message if no session active
                if (!sessionId && botData.config?.welcome_message) {
                    setMessages([{
                        id: 'welcome',
                        role: 'assistant',
                        content: botData.config.welcome_message,
                        timestamp: new Date().toISOString()
                    }]);
                }
            } catch (error) {
                console.error('Failed to load bot data:', error);
                toast.error('Failed to load bot information');
            } finally {
                setLoading(false);
            }
        };
        loadBotAndSessions();
    }, [id]);

    // Handle Session history loading
    useEffect(() => {
        const loadHistory = async () => {
            if (!id || !sessionId) return;

            // If we have messages, we probably just started this session locally
            // or we're already viewing it. Only fetch if we have no messages.
            if (messages.length > 1) return;

            try {
                const history = await chatApi.getHistory(id, sessionId);
                if (history && history.length > 0) {
                    setMessages(history);

                    const lastAiMsg = [...history].reverse().find(m => m.role === 'assistant' && m.retrieved_chunks);
                    if (lastAiMsg) {
                        setSelectedEvidence(lastAiMsg.retrieved_chunks);
                    }
                }
            } catch (error) {
                console.error('Failed to load session history:', error);
            }
        };
        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, sessionId]); // We intentionally only run this when session changes

    const handleNewChat = () => {
        setSessionId(null);
        setMessages(bot?.config?.welcome_message ? [{
            id: 'welcome',
            role: 'assistant',
            content: bot.config.welcome_message,
            timestamp: new Date().toISOString()
        }] : []);
        setSelectedEvidence(null);
    };

    const handleSelectSession = (sid: string) => {
        setMessages([]); // Clear messages immediately to trigger fresh load
        setSessionId(sid);
        setSelectedEvidence(null);
    };

    const handleDeleteSession = async (sid: string) => {
        if (!id) return;
        try {
            await chatApi.deleteSession(id, sid);
            toast.success('Conversation deleted');

            // Refresh sessions list
            const updatedSessions = await chatApi.getSessions(id);
            setSessions(updatedSessions);

            // If the deleted session was the active one, start a new chat
            if (sessionId === sid) {
                handleNewChat();
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
            toast.error('Failed to delete conversation');
        }
    };

    const handleClearHistory = async () => {
        if (!id) return;
        try {
            await chatApi.clearHistory(id);
            toast.success('All history cleared');

            setSessions([]);
            handleNewChat();
        } catch (error) {
            console.error('Failed to clear history:', error);
            toast.error('Failed to clear history');
        }
    };


    const handleSendMessage = async (text: string) => {
        if (!id) return;

        // Add user message
        const userMsg = {
            id: Date.now().toString(),
            role: 'user' as const,
            content: text,
            timestamp: new Date().toISOString()
        };

        // Add placeholder AI message
        const aiMsgId = (Date.now() + 1).toString();
        const initialAiMsg = {
            id: aiMsgId,
            role: 'assistant' as const,
            content: '',
            timestamp: new Date().toISOString(),
            agent_logs: [],
        };

        // Use or generate session ID with fallback for non-crypto environments
        let activeSessionId = sessionId;
        if (!activeSessionId) {
            activeSessionId = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            setSessionId(activeSessionId);
        }

        setMessages(prev => [...prev, userMsg, initialAiMsg]);
        setIsTyping(true);

        const historyForStream = messages.filter(m => m.id !== 'welcome').map(m => ({
            role: m.role,
            content: m.content
        })).slice(-5);

        try {
            await chatApi.stream(id, {
                message: text,
                session_id: activeSessionId,
                history: historyForStream
            }, (chunk) => {
                setMessages(prev => prev.map(msg => {
                    if (msg.id !== aiMsgId) return msg;

                    if (chunk.type === 'metadata') {
                        // Update sources, chunks, and logs from metadata
                        if (chunk.retrieved_chunks && chunk.retrieved_chunks.length > 0) {
                            setSelectedEvidence(chunk.retrieved_chunks);
                        }
                        return {
                            ...msg,
                            sources: chunk.sources,
                            retrieved_chunks: chunk.retrieved_chunks,
                            agent_logs: chunk.agent_logs,
                            reasoning: chunk.reasoning,
                            search_query: chunk.search_query,
                        };
                    } else if (chunk.type === 'content') {
                        // Append content chunk
                        return {
                            ...msg,
                            content: (msg.content || '') + chunk.content
                        };
                    } else if (chunk.type === 'done') {
                        // Stream finished
                        return msg;
                    }
                    return msg;
                }));
            });
        } catch (error: any) {
            toast.error('Failed to send message');
            console.error(error);
            // Remove the empty AI message if failed
            setMessages(prev => prev.filter(m => m.id !== aiMsgId));
        } finally {
            setIsTyping(false);
            // Refresh sessions list after message (to show new session title)
            if (id) {
                chatApi.getSessions(id).then(setSessions).catch(console.error);
            }
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <ChatLayout
            sessions={sessions}
            currentSessionId={sessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onClearHistory={handleClearHistory}
            onNewChat={handleNewChat}
            botName={bot?.name}
            botModel={bot?.config?.llm_model || bot?.config?.model}
            rightPanel={
                selectedEvidence ? (
                    <div className="flex-1 w-full h-full min-h-[500px] border-l border-border/50 bg-background/50 backdrop-blur-3xl relative overflow-hidden rounded-r-3xl flex flex-col pt-safe">
                        <KnowledgeGraphPanel chunks={selectedEvidence} />
                    </div>
                ) : null
            }
        >
            <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
                {/* Messages Area */}
                <div
                    ref={messagesContainerRef}
                    className={cn(
                        "flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar",
                        !isTyping && "scroll-smooth"
                    )}
                >
                    {messages.map((msg, idx) => (
                        <div
                            key={msg.id || idx}
                            onClick={() => {
                                if (msg.retrieved_chunks) {
                                    setSelectedEvidence(msg.retrieved_chunks);
                                }
                            }}
                            className={cn("space-y-2", msg.retrieved_chunks ? "cursor-pointer" : "")}
                        >
                            {(msg.role === 'user' || msg.content !== '') && <ChatMessage message={msg} />}
                        </div>
                    ))}
                    {isTyping && (!messages[messages.length - 1]?.content) && <TypingIndicator />}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
                {/* Input Area */}
                <div className="p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <ChatInput onSend={handleSendMessage} disabled={isTyping} placeholder={`Message ${bot?.name || 'Agent'}...`} />
                    <div className="text-center mt-2">
                        <p className="text-[10px] text-muted-foreground">
                            AI can make mistakes. Please verify important information.
                        </p>
                    </div>
                </div>
            </div>
        </ChatLayout>
    );
}
