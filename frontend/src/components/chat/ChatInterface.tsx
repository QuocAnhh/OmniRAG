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
                <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center text-xs font-bold shadow-ring ${isUser ? 'bg-primary text-warm-ivory' : 'bg-warm-cream text-primary border border-border-warm'}`}>
                    {isUser ? <span className="material-symbols-outlined text-[16px]">person</span> : <span className="material-symbols-outlined text-[16px]">smart_toy</span>}
                </div>
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`relative px-4 py-3 rounded-feature text-[13.5px] leading-relaxed transition-all ${isUser ? 'bg-primary text-warm-ivory rounded-br-none shadow-ring-primary' : 'bg-white border border-border-warm text-text-primary rounded-bl-none shadow-whisper hover:border-warm-sand'}`}>
                        <div className="markdown-content">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                    ul: ({ ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                    ol: ({ ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                    li: ({ ...props }) => <li className="marker:text-primary/50" {...props} />,
                                    strong: ({ ...props }) => <strong className="font-bold text-primary" {...props} />,
                                    code: ({ ...props }) => (
                                        <code className="bg-warm-cream px-1.5 py-0.5 rounded text-[12px] font-mono border border-border-warm" {...props} />
                                    ),
                                    pre: ({ ...props }) => (
                                        <div className="bg-warm-cream p-3 rounded-comfort border border-border-warm my-2 overflow-x-auto">
                                            <pre className="text-[12px] font-mono" {...props} />
                                        </div>
                                    ),
                                    table: ({ ...props }) => (
                                        <div className="overflow-x-auto my-3 rounded-comfort border border-border-warm">
                                            <table className="min-w-full divide-y divide-border-warm" {...props} />
                                        </div>
                                    ),
                                    th: ({ ...props }) => <th className="px-3 py-2 bg-warm-cream text-left font-bold text-xs" {...props} />,
                                    td: ({ ...props }) => <td className="px-3 py-2 border-t border-border-warm text-xs" {...props} />,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 mt-1 text-[10px] opacity-70 ${isUser ? 'text-text-tertiary flex-row-reverse' : 'text-text-tertiary'}`}>
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {!isUser && message.message_id && onFeedback && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleFeedback(1)} className={`p-1 rounded hover:bg-warm-cream transition-colors ${feedbackState === 'like' ? 'text-green-600' : 'text-text-tertiary'}`} title="Good response"><span className={`material-symbols-outlined text-[14px] ${feedbackState === 'like' ? 'filled' : ''}`}>thumb_up</span></button>
                                <button onClick={() => handleFeedback(-1)} className={`p-1 rounded hover:bg-warm-cream transition-colors ${feedbackState === 'dislike' ? 'text-brand-crimson' : 'text-text-tertiary'}`} title="Bad response"><span className={`material-symbols-outlined text-[14px] ${feedbackState === 'dislike' ? 'filled' : ''}`}>thumb_down</span></button>
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
        <form onSubmit={handleSubmit} className="flex gap-2 items-center w-full bg-white p-2 rounded-feature border border-border-warm shadow-whisper focus-within:border-primary/40 focus-within:shadow-ring-primary transition-all">
            <button
                type="button"
                className="p-2 text-text-tertiary hover:text-primary hover:bg-primary/10 rounded-comfort transition-colors"
                title="Attach file"
                disabled={disabled}
            >
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>

            <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-text-primary placeholder:text-text-muted px-2"
                placeholder={placeholder}
                disabled={disabled}
            />

            <button
                type="submit"
                disabled={disabled}
                className="p-2 bg-primary text-warm-ivory rounded-comfort shadow-ring-primary hover:bg-brand-coral disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                <div className="flex-shrink-0 size-8 rounded-full flex items-center justify-center bg-warm-cream text-primary border border-border-warm shadow-ring">
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                </div>
                <div className="px-5 py-3 rounded-feature rounded-bl-none bg-white border border-border-warm shadow-whisper flex items-center gap-2 min-h-[44px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-feature"></div>
                    <div className="flex space-x-1.5 z-10 py-1 px-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
