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
    if (score >= 0.7) return 'text-green-700 bg-green-50';
    if (score >= 0.4) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  const getCRAGColor = (verdict: string): string => {
    if (verdict === 'relevant') return 'text-green-700 bg-green-50';
    if (verdict === 'ambiguous') return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  if (loading) {
    return (
      <div className="p-4 bg-warm-ivory border-l-2 border-primary/30 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="text-sm text-text-tertiary">Loading debug data...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-warm-ivory border-l-2 border-border-warm rounded-lg">
        <p className="text-sm text-text-tertiary">Send a message to see debug information</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-text-primary">Debug Mode</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span>{data.total_latency_ms}ms</span>
        </div>
      </div>

      {/* Query Processing Section */}
      <div className="border border-border-warm rounded-lg overflow-hidden bg-white">
        <button
          onClick={() => toggleSection('query')}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-warm-cream transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-text-primary">Query Processing</span>
          </div>
          {expandedSections.has('query') ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>

        {expandedSections.has('query') && (
          <div className="p-3 space-y-3 border-t border-border-warm">
            <div>
              <label className="text-xs font-medium text-text-tertiary">Original Query</label>
              <p className="text-sm mt-1 p-2 bg-warm-cream rounded">{data.query_original}</p>
            </div>

            {data.query_rewritten !== data.query_original && (
              <div>
                <label className="text-xs font-medium text-text-tertiary">Rewritten Query</label>
                <p className="text-sm mt-1 p-2 bg-[#fdf2ee] rounded border-l-2 border-primary">
                  {data.query_rewritten}
                </p>
              </div>
            )}

            {data.hyde_hypothesis && (
              <div>
                <label className="text-xs font-medium text-text-tertiary">HyDE Hypothesis</label>
                <p className="text-sm mt-1 p-2 bg-purple-50 rounded border-l-2 border-purple-500">
                  {data.hyde_hypothesis}
                </p>
              </div>
            )}

            {data.multi_query_variants.length > 1 && (
              <div>
                <label className="text-xs font-medium text-text-tertiary">Query Variants</label>
                <ul className="text-sm mt-1 space-y-1">
                  {data.multi_query_variants.map((variant, idx) => (
                    <li key={idx} className="p-2 bg-warm-cream rounded">
                      <span className="text-xs text-text-tertiary mr-2">#{idx + 1}</span>
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
      <div className="border border-border-warm rounded-lg overflow-hidden bg-white">
        <button
          onClick={() => toggleSection('chunks')}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-warm-cream transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-text-primary">Retrieved Chunks ({data.retrieved_chunks.length})</span>
          </div>
          {expandedSections.has('chunks') ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>

        {expandedSections.has('chunks') && (
          <div className="border-t border-border-warm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-cream">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-warm-charcoal">#</th>
                  <th className="px-3 py-2 text-left font-medium text-warm-charcoal">Source</th>
                  <th className="px-3 py-2 text-left font-medium text-warm-charcoal">Text Preview</th>
                  <th className="px-3 py-2 text-center font-medium text-warm-charcoal">Vector</th>
                  <th className="px-3 py-2 text-center font-medium text-warm-charcoal">BM25</th>
                  <th className="px-3 py-2 text-center font-medium text-warm-charcoal">RRF</th>
                  <th className="px-3 py-2 text-center font-medium text-warm-charcoal">Rerank</th>
                  <th className="px-3 py-2 text-center font-medium text-warm-charcoal">Hybrid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {data.retrieved_chunks.map((chunk) => (
                  <tr key={chunk.rank} className="hover:bg-warm-cream">
                    <td className="px-3 py-2 text-text-primary">{chunk.rank}</td>
                    <td className="px-3 py-2 text-xs text-text-tertiary max-w-[150px] truncate">{chunk.source}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate text-text-primary" title={chunk.text}>
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
      <div className="border border-border-warm rounded-lg overflow-hidden bg-white">
        <button
          onClick={() => toggleSection('logs')}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-warm-cream transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-text-primary">Pipeline Logs</span>
          </div>
          {expandedSections.has('logs') ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>

        {expandedSections.has('logs') && (
          <div className="p-3 space-y-2 border-t border-border-warm text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">CRAG Verdict</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getCRAGColor(data.crag_verdict)}`}>
                {data.crag_verdict.toUpperCase()}
              </span>
            </div>

            {data.lightrag_entities.length > 0 && (
              <div>
                <span className="text-text-tertiary">KG Entities: </span>
                <span className="text-xs text-text-primary">{data.lightrag_entities.slice(0, 5).join(', ')}</span>
                {data.lightrag_entities.length > 5 && <span className="text-xs text-text-tertiary"> +{data.lightrag_entities.length - 5} more</span>}
              </div>
            )}

            <div className="space-y-1 pt-2">
              {data.agent_logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-text-tertiary font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="font-medium text-text-primary">{log.step}:</span>
                  <span className="text-text-secondary">{log.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
