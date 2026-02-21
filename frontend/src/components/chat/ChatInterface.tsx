import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

interface ChatMessageProps {
    message: Message & {
        message_id?: string;
        feedback?: 'like' | 'dislike';
    };
    onFeedback?: (messageId: string, score: number) => void;
}

export const ChatMessage = React.memo(function ChatMessage({ message, onFeedback }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const [feedbackState, setFeedbackState] = useState<'like' | 'dislike' | null>(message.feedback || null);

    const handleFeedback = (score: number) => {
        if (!onFeedback || !message.message_id) return;
        const newState = score === 1 ? 'like' : 'dislike';
        setFeedbackState(newState);
        onFeedback(message.message_id, score);
    };

    return (
        <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-transform active:scale-90 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-accent/10 text-accent-600 border border-accent/20'}`}>
                    {isUser ? <span className="material-symbols-outlined text-[16px]">person</span> : <span className="material-symbols-outlined text-[16px]">smart_toy</span>}
                </div>
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`relative px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed shadow-sm transition-all ${isUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border border-border text-foreground rounded-bl-none hover:border-primary/30'}`}>
                        <div className="markdown-content">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                    ul: ({ ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                    ol: ({ ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                    li: ({ ...props }) => <li className="marker:text-primary/50" {...props} />,
                                    strong: ({ ...props }) => <strong className="font-bold text-primary-600 dark:text-primary-400" {...props} />,
                                    code: ({ ...props }) => (
                                        <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-mono border border-border/50" {...props} />
                                    ),
                                    pre: ({ ...props }) => (
                                        <div className="bg-muted/50 p-3 rounded-xl border border-border my-2 overflow-x-auto">
                                            <pre className="text-[12px] font-mono" {...props} />
                                        </div>
                                    ),
                                    table: ({ ...props }) => (
                                        <div className="overflow-x-auto my-3 rounded-lg border border-border">
                                            <table className="min-w-full divide-y divide-border" {...props} />
                                        </div>
                                    ),
                                    th: ({ ...props }) => <th className="px-3 py-2 bg-muted text-left font-bold text-xs" {...props} />,
                                    td: ({ ...props }) => <td className="px-3 py-2 border-t border-border text-xs" {...props} />,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 mt-1 text-[10px] opacity-70 ${isUser ? 'text-primary-foreground/80 flex-row-reverse' : 'text-muted-foreground'}`}>
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {!isUser && message.message_id && onFeedback && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleFeedback(1)} className={`p-1 rounded hover:bg-muted/50 transition-colors ${feedbackState === 'like' ? 'text-green-600' : 'text-muted-foreground'}`} title="Good response"><span className={`material-symbols-outlined text-[14px] ${feedbackState === 'like' ? 'filled' : ''}`}>thumb_up</span></button>
                                <button onClick={() => handleFeedback(-1)} className={`p-1 rounded hover:bg-muted/50 transition-colors ${feedbackState === 'dislike' ? 'text-red-500' : 'text-muted-foreground'}`} title="Bad response"><span className={`material-symbols-outlined text-[14px] ${feedbackState === 'dislike' ? 'filled' : ''}`}>thumb_down</span></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputRef.current && inputRef.current.value.trim()) {
            onSend(inputRef.current.value.trim());
            inputRef.current.value = '';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2 items-center w-full bg-card p-2 rounded-2xl border border-border shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
            <button
                type="button"
                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                title="Attach file"
                disabled={disabled}
            >
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>

            <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-foreground placeholder:text-muted-foreground/50 px-2"
                placeholder={placeholder}
                disabled={disabled}
            />

            <button
                type="submit"
                disabled={disabled}
                className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
                <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
        </form>
    );
}

export function TypingIndicator() {
    return (
        <div className="flex w-full mb-4 justify-start group animate-in fade-in duration-300">
            <div className="flex max-w-[80%] flex-row items-end gap-2">
                <div className="flex-shrink-0 size-8 rounded-full flex items-center justify-center bg-accent/10 text-accent-600 border border-accent/20">
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                </div>
                <div className="px-5 py-3 rounded-2xl rounded-bl-none bg-card border border-border shadow-sm flex items-center gap-3 min-h-[44px] relative overflow-hidden">
                    {/* Background glow effect */}
                    <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-2xl"></div>

                    {/* Animated SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8 z-10" style={{ filter: 'drop-shadow(0 0 2px rgba(99, 102, 241, 0.4))' }}>
                        <defs>
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Outer rotating ring */}
                        <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="2.5"
                            strokeDasharray="30 15 10 15" className="text-primary/60" filter="url(#glow)">
                            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="2.5s" repeatCount="indefinite" />
                        </circle>

                        {/* Inner breathing core */}
                        <circle cx="50" cy="50" r="12" className="fill-primary" filter="url(#glow)">
                            <animate attributeName="r" values="10; 15; 10" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6; 1; 0.6" dur="1.5s" repeatCount="indefinite" />
                        </circle>

                        {/* Orbiting particles */}
                        <g>
                            <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="3s" repeatCount="indefinite" />
                            <circle cx="16" cy="50" r="3" className="fill-accent-500" filter="url(#glow)" />
                            <circle cx="84" cy="50" r="2.5" className="fill-primary" filter="url(#glow)" />
                            <circle cx="50" cy="16" r="3.5" className="fill-blue-400" filter="url(#glow)" />
                        </g>
                    </svg>

                    <span className="text-[13px] font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-600 animate-pulse z-10 tracking-wide">
                        AI is thinking...
                    </span>
                </div>
            </div>
        </div>
    );
}
