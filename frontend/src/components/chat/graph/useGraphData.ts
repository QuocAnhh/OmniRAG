import { useEffect, useState } from 'react';
import { type RawLink, type RawNode, MAX_STORED } from './types';

interface GraphData {
  rawNodes: RawNode[];
  rawLinks: RawLink[];
  isLoading: boolean;
  typeCounts: Record<string, number>;
  graphSummary: string;
}

/**
 * Fetch knowledge graph data for a bot, with derived type counts + summary.
 */
export function useGraphData(botId: string): GraphData {
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawLinks, setRawLinks] = useState<RawLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [graphSummary, setGraphSummary] = useState('');

  useEffect(() => {
    if (!botId) return;
    setIsLoading(true);
    import('../../../api/bots')
      .then(({ botsApi }) => {
        return botsApi.getKnowledgeGraph(botId).then((data) => {
          const nodes = (data.nodes ?? []).slice(0, MAX_STORED) as RawNode[];
          const links = (data.links ?? []) as RawLink[];
          setRawNodes(nodes);
          setRawLinks(links);

          const counts: Record<string, number> = {};
          for (const n of nodes) {
            const t = n.type?.toLowerCase() ?? 'unknown';
            counts[t] = (counts[t] ?? 0) + 1;
          }
          setTypeCounts(counts);

          if (nodes.length > 0) {
            const degMap: Record<string, number> = {};
            nodes.forEach((n) => {
              degMap[n.id] = 0;
            });
            links.forEach((l) => {
              if (degMap[l.source] !== undefined) degMap[l.source]++;
              if (degMap[l.target] !== undefined) degMap[l.target]++;
            });
            const topNames = nodes
              .slice()
              .sort((a, b) => (degMap[b.id] ?? 0) - (degMap[a.id] ?? 0))
              .slice(0, 3)
              .map((n) => n.name);
            setGraphSummary(
              `${nodes.length} entities · ${links.length} connections · Key: ${topNames.join(', ')}`,
            );
          } else {
            setGraphSummary('');
          }
        });
      })
      .catch((err) => console.error('graph fetch:', err))
      .finally(() => setIsLoading(false));
  }, [botId]);

  return { rawNodes, rawLinks, isLoading, typeCounts, graphSummary };
}
