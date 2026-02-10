import { useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

interface ChatMessageProps {
    message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                {/* Avatar */}
                <div className={`
          flex-shrink-0 size-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm
          ${isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent/10 text-accent-600 border border-accent/20'}
        `}>
                    {isUser ? (
                        <span className="material-symbols-outlined text-[16px]">person</span>
                    ) : (
                        <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    )}
                </div>

                {/* Bubble */}
                <div className={`
          relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
          ${isUser
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-card border border-border text-foreground rounded-bl-none'}
        `}>
                    {message.content}

                    {/* Timestamp */}
                    <div className={`
            text-[10px] mt-1 opacity-70 text-right
            ${isUser ? 'text-primary-foreground/80' : 'text-muted-foreground'}
          `}>
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        </div>
    );
}

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
        <div className="flex w-full mb-4 justify-start">
            <div className="flex max-w-[80%] flex-row items-end gap-2">
                <div className="flex-shrink-0 size-8 rounded-full flex items-center justify-center bg-accent/10 text-accent-600 border border-accent/20">
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-card border border-border shadow-sm flex items-center gap-1.5 min-h-[44px]">
                    <span className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
            </div>
        </div>
    );
}
