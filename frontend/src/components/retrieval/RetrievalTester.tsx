import { useState } from 'react';
import { retrievalApi } from '../../api/retrieval';
import type { RetrievalResult } from '../../api/retrieval';
import toast from 'react-hot-toast';

interface RetrievalTesterProps {
    botId: string;
}

export default function RetrievalTester({ botId }: RetrievalTesterProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<RetrievalResult[]>([]);
    const [hydeDoc, setHydeDoc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [topK, setTopK] = useState(5);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const data = await retrievalApi.retrieve(botId, query, topK);
            setResults(data.results);
            setHydeDoc(data.hyde_document || null);
        } catch (error) {
            console.error('Retrieval failed', error);
            toast.error('Retrieval failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">science</span>
                    Retrieval Tester
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Debug RAG retrieval performance</p>
            </div>

            <div className="p-4 border-b border-border space-y-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter test query..."
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <select
                        value={topK}
                        onChange={(e) => setTopK(Number(e.target.value))}
                        className="bg-background border border-border rounded-lg px-2 py-2 text-sm"
                    >
                        <option value={3}>Top 3</option>
                        <option value={5}>Top 5</option>
                        <option value={10}>Top 10</option>
                    </select>
                    <button
                        onClick={handleSearch}
                        disabled={loading || !query.trim()}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <span className="animate-spin material-symbols-outlined text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">search</span>}
                        Test
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {hydeDoc && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3">
                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            Generated HyDE Document (Hypothetical Answer)
                        </div>
                        <p className="text-xs text-muted-foreground italic line-clamp-3 hover:line-clamp-none cursor-pointer transition-all">
                            "{hydeDoc}"
                        </p>
                    </div>
                )}

                {results.length > 0 ? (
                    <div className="space-y-4">
                        {results.map((result, idx) => (
                            <div key={idx} className="bg-muted/30 border border-border rounded-lg p-3 hover:border-primary/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                                            #{idx + 1}
                                        </span>
                                        <div className="text-xs font-medium text-muted-foreground truncate max-w-[200px]" title={result.source}>
                                            {result.source}
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                        Score: {result.score.toFixed(4)}
                                    </div>
                                </div>
                                <p className="text-sm text-foreground/80 leading-relaxed font-mono bg-background/50 p-2 rounded border border-border/50 text-wrap break-words">
                                    {result.text}
                                </p>
                                {Object.keys(result.metadata).length > 0 && (
                                    <details className="mt-2 text-xs">
                                        <summary className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">Metadata</summary>
                                        <pre className="mt-1 bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
                                            {JSON.stringify(result.metadata, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    !loading && (
                        <div className="text-center py-10 text-muted-foreground">
                            <span className="material-symbols-outlined text-4xl opacity-30 mb-2">find_in_page</span>
                            <p>Enter a query to see what chunks are retrieved</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
