import Graph from 'graphology';
import {
  type RawLink,
  type RawNode,
  BORDER_ACTIVE,
  BORDER_DEFAULT,
  MAX_NODE_SIZE,
  MIN_NODE_SIZE,
  typeColor,
} from './types';

/**
 * Build a graphology Graph instance from raw nodes + links.
 * Picks top-N by degree centrality, with active entities always pinned.
 */
export function buildGraphology(
  rawNodes: RawNode[],
  rawLinks: RawLink[],
  topN: number,
  activeSet: Set<string>,
): Graph {
  const degMap: Record<string, number> = {};
  rawNodes.forEach((n) => {
    degMap[n.id] = 0;
  });
  rawLinks.forEach((l) => {
    if (degMap[l.source] !== undefined) degMap[l.source]++;
    if (degMap[l.target] !== undefined) degMap[l.target]++;
  });

  const activeMatches = rawNodes.filter((n) => {
    const lbl = n.name.toLowerCase();
    const id = n.id.toLowerCase();
    return activeSet.has(lbl) || activeSet.has(id);
  });
  const pinned = new Set(activeMatches.map((n) => n.id));
  const others = rawNodes
    .filter((n) => !pinned.has(n.id))
    .sort((a, b) => (degMap[b.id] ?? 0) - (degMap[a.id] ?? 0));
  const remaining = Math.max(0, topN - pinned.size);
  const topNodes = [...activeMatches, ...others.slice(0, remaining)];
  const nodeSet = new Set(topNodes.map((n) => n.id));

  const degrees = topNodes.map((n) => degMap[n.id] ?? 0);
  const minDeg = degrees.length ? Math.min(...degrees) : 0;
  const maxDeg = degrees.length ? Math.max(...degrees) : 1;
  const range = maxDeg - minDeg || 1;
  const scale = MAX_NODE_SIZE - MIN_NODE_SIZE;

  const graph = new Graph({ multi: false, type: 'undirected' });

  topNodes.forEach((n) => {
    const deg = degMap[n.id] ?? 0;
    const size = Math.round(
      MIN_NODE_SIZE + scale * Math.pow((deg - minDeg) / range, 0.5),
    );
    const type = n.type.toLowerCase();
    const active = pinned.has(n.id);
    graph.addNode(n.id, {
      label: n.name,
      color: typeColor(type),
      size: active ? Math.max(size, MIN_NODE_SIZE + 4) : size,
      borderColor: active ? BORDER_ACTIVE : BORDER_DEFAULT,
      borderSize: active ? 0.25 : 0.15,
      nodeType: type,
      description: n.description ?? '',
      filePath: n.file_path ?? '',
      isActiveEntity: active,
      x: Math.random(),
      y: Math.random(),
    });
  });

  const seen = new Set<string>();
  rawLinks.forEach((l) => {
    if (!nodeSet.has(l.source) || !nodeSet.has(l.target)) return;
    const key = [l.source, l.target].sort().join('\x00');
    if (seen.has(key)) return;
    seen.add(key);
    try {
      graph.addEdge(l.source, l.target, {
        label: l.relation ?? '',
        size: l.weight ? Math.min(Math.max(l.weight * 0.8, 0.5), 4) : 1,
        color: '#888888',
        type: 'curvedNoArrow',
      });
    } catch {
      /* dup guard */
    }
  });

  return graph;
}
