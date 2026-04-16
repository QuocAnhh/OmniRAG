export interface RawNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  source_id?: string;
  file_path?: string;
}

export interface RawLink {
  source: string;
  target: string;
  relation?: string;
  description?: string;
  weight?: number;
}

export interface KnowledgeGraphPanelProps {
  botId: string;
  activeEntities?: string[];
  onExpandClick?: () => void;
  defaultTopN?: number;
  onAskAboutEntity?: (query: string) => void;
}

export const DEFAULT_TOP_N = 20;
export const MAX_STORED = 300;

export const TYPE_META: Record<string, { solid: string; label: string }> = {
  concept: { solid: '#e3493b', label: 'Concept' },
  method: { solid: '#b71c1c', label: 'Method' },
  organization: { solid: '#00cc00', label: 'Org' },
  person: { solid: '#4169E1', label: 'Person' },
  location: { solid: '#cf6d17', label: 'Location' },
  event: { solid: '#00bfa0', label: 'Event' },
  artifact: { solid: '#4421af', label: 'Artifact' },
  data: { solid: '#0000ff', label: 'Data' },
  content: { solid: '#0f558a', label: 'Content' },
  naturalobject: { solid: '#b2e061', label: 'Nature' },
  other: { solid: '#f4d371', label: 'Other' },
  unknown: { solid: '#b0b0b0', label: 'Unknown' },
  entity: { solid: '#5D6D7E', label: 'Entity' },
  creature: { solid: '#bd7ebe', label: 'Creature' },
  policy: { solid: '#ff9800', label: 'Policy' },
};

export const DEFAULT_HIDDEN_TYPES = new Set([
  'person',
  'content',
  'data',
  'unknown',
  'naturalobject',
  'creature',
]);

export const BORDER_DEFAULT = '#EEEEEE';
export const BORDER_ACTIVE = '#F57F17';
export const BORDER_SEARCH = '#FFD700';
export const MIN_NODE_SIZE = 4;
export const MAX_NODE_SIZE = 20;

export function typeColor(type: string) {
  return TYPE_META[type.toLowerCase()]?.solid ?? TYPE_META.entity.solid;
}

export function typeLabel(type: string) {
  return TYPE_META[type.toLowerCase()]?.label ?? type;
}
