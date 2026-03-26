import { useState } from 'react';
import { ChevronDown, ChevronUp, Bug, Zap, Clock, Database } from 'lucide-react';

interface DebugData {
  query_original: string;
  query_rewritten: string;
  hyde_hypothesis: string;
  multi_query_variants: string[];
  retrieved_chunks: Array<{
    rank: number;
    text: string;
    source: string;
    vector_score: number;
    bm25_score: number;
    rrf_score: number;
    reranker_score: number;
    hybrid_score: number;
    highlights?: string[];
  }>;
  crag_verdict: string;
  lightrag_entities: string[];
  agent_logs: Array<{
    step: string;
    description: string;
    timestamp: string;
    status?: string;
  }>;
  total_latency_ms: number;
  bot_config: {
    domain: string;
    top_k: number;
    enable_multi_query: boolean;
    enable_knowledge_graph: boolean;
  };
}

interface DebugPanelProps {
  data: DebugData | null;
  loading?: boolean;
}

export default function DebugPanel({ data, loading }: DebugPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['query', 'chunks'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.7) return 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400';
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400';
    return 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400';
  };

  const getCRAGColor = (verdict: string): string => {
    if (verdict === 'relevant') return 'text-green-600 bg-green-50 dark:bg-green-950';
    if (verdict === 'ambiguous') return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
    return 'text-red-600 bg-red-50 dark:bg-red-950';
  };

  if (loading) {
    return (
      <div className="p-4 bg-background/80 backdrop-blur-sm border-l-2 border-primary-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="text-sm text-muted-foreground">Loading debug data...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-background/80 backdrop-blur-sm border-l-2 border-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Send a message to see debug information</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Debug Mode</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{data.total_latency_ms}ms</span>
        </div>
      </div>

      {/* Query Processing Section */}
      <div className="border rounded-lg overflow-hidden bg-background/50">
        <button
          onClick={() => toggleSection('query')}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Query Processing</span>
          </div>
          {expandedSections.has('query') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedSections.has('query') && (
          <div className="p-3 space-y-3 border-t">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Original Query</label>
              <p className="text-sm mt-1 p-2 bg-muted/30 rounded">{data.query_original}</p>
            </div>

            {data.query_rewritten !== data.query_original && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rewritten Query</label>
                <p className="text-sm mt-1 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded border-l-2 border-blue-500">
                  {data.query_rewritten}
                </p>
              </div>
            )}

            {data.hyde_hypothesis && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">HyDE Hypothesis</label>
                <p className="text-sm mt-1 p-2 bg-purple-50/50 dark:bg-purple-950/30 rounded border-l-2 border-purple-500">
                  {data.hyde_hypothesis}
                </p>
              </div>
            )}

            {data.multi_query_variants.length > 1 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Query Variants</label>
                <ul className="text-sm mt-1 space-y-1">
                  {data.multi_query_variants.map((variant, idx) => (
                    <li key={idx} className="p-2 bg-muted/30 rounded">
                      <span className="text-xs text-muted-foreground mr-2">#{idx + 1}</span>
                      {variant}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Retrieved Chunks Section */}
      <div className="border rounded-lg overflow-hidden bg-background/50">
        <button
          onClick={() => toggleSection('chunks')}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">Retrieved Chunks ({data.retrieved_chunks.length})</span>
          </div>
          {expandedSections.has('chunks') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedSections.has('chunks') && (
          <div className="border-t overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Text Preview</th>
                  <th className="px-3 py-2 text-center font-medium">Vector</th>
                  <th className="px-3 py-2 text-center font-medium">BM25</th>
                  <th className="px-3 py-2 text-center font-medium">RRF</th>
                  <th className="px-3 py-2 text-center font-medium">Rerank</th>
                  <th className="px-3 py-2 text-center font-medium">Hybrid</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.retrieved_chunks.map((chunk) => (
                  <tr key={chunk.rank} className="hover:bg-muted/30">
                    <td className="px-3 py-2">{chunk.rank}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[150px] truncate">{chunk.source}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate" title={chunk.text}>
                      {chunk.text.substring(0, 100)}...
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${getScoreColor(chunk.vector_score)}`}>
                        {chunk.vector_score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${getScoreColor(chunk.bm25_score)}`}>
                        {chunk.bm25_score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${getScoreColor(chunk.rrf_score)}`}>
                        {chunk.rrf_score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${getScoreColor(chunk.reranker_score)}`}>
                        {chunk.reranker_score.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${getScoreColor(chunk.hybrid_score)}`}>
                        {chunk.hybrid_score.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRAG & Logs Section */}
      <div className="border rounded-lg overflow-hidden bg-background/50">
        <button
          onClick={() => toggleSection('logs')}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">Pipeline Logs</span>
          </div>
          {expandedSections.has('logs') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedSections.has('logs') && (
          <div className="p-3 space-y-2 border-t text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CRAG Verdict</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getCRAGColor(data.crag_verdict)}`}>
                {data.crag_verdict.toUpperCase()}
              </span>
            </div>

            {data.lightrag_entities.length > 0 && (
              <div>
                <span className="text-muted-foreground">KG Entities: </span>
                <span className="text-xs">{data.lightrag_entities.slice(0, 5).join(', ')}</span>
                {data.lightrag_entities.length > 5 && <span className="text-xs text-muted-foreground"> +{data.lightrag_entities.length - 5} more</span>}
              </div>
            )}

            <div className="space-y-1 pt-2">
              {data.agent_logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="font-medium">{log.step}:</span>
                  <span className="text-muted-foreground">{log.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
