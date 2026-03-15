export type DomainKey = 'general' | 'education' | 'legal' | 'sales';

export interface BlueprintItem {
  icon: string;   // Material Symbol name
  label: string;
  value: string;
  active: boolean; // true = highlighted (feature ON), false = muted (OFF)
}

export interface DomainMeta {
  label: string;
  icon: string;         // Material Symbol name (NOT emoji)
  iconColor: string;    // Tailwind text color class for the icon
  badge: string;        // Tailwind classes for the badge pill
  description: string;  // Short description shown in domain selector cards
  chunkingHint: string; // Human-readable chunking strategy description
  blueprint: BlueprintItem[];
}

export const DOMAIN_META: Record<DomainKey, DomainMeta> = {
  general: {
    label: 'General',
    icon: 'public',
    iconColor: 'text-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    description: 'Balanced defaults for any use case.',
    chunkingHint: 'Recursive chunking · 512 tokens',
    blueprint: [
      { icon: 'account_tree', label: 'Knowledge Graph', value: 'Disabled', active: false },
      { icon: 'content_cut',  label: 'Chunking',        value: 'Recursive · 512 tokens', active: true },
      { icon: 'travel_explore', label: 'Retrieval',     value: 'Top 10 chunks', active: true },
      { icon: 'chat_bubble',  label: 'Tone',            value: 'Balanced & neutral', active: true },
    ],
  },
  education: {
    label: 'Education',
    icon: 'school',
    iconColor: 'text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    description: 'Sentence-aware chunking preserving paragraph coherence. KG enabled for concept relationships.',
    chunkingHint: 'Sentence chunking · 384 tokens',
    blueprint: [
      { icon: 'account_tree', label: 'Knowledge Graph', value: 'ON · local mode', active: true },
      { icon: 'content_cut',  label: 'Chunking',        value: 'Sentence-aware · 384 tokens', active: true },
      { icon: 'travel_explore', label: 'Retrieval',     value: 'Top 12 chunks', active: true },
      { icon: 'chat_bubble',  label: 'Tone',            value: 'Explanatory & pedagogical', active: true },
    ],
  },
  legal: {
    label: 'Legal',
    icon: 'balance',
    iconColor: 'text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    description: 'Article-boundary chunking (Điều N) for Vietnamese legal docs. Hybrid KG mode.',
    chunkingHint: 'Article chunking · 1024 tokens',
    blueprint: [
      { icon: 'account_tree', label: 'Knowledge Graph', value: 'ON · hybrid mode', active: true },
      { icon: 'content_cut',  label: 'Chunking',        value: 'Article (Điều N) · 1024 tokens', active: true },
      { icon: 'travel_explore', label: 'Retrieval',     value: 'Top 8 chunks', active: true },
      { icon: 'chat_bubble',  label: 'Tone',            value: 'Formal & citation-heavy', active: true },
    ],
  },
  sales: {
    label: 'Sales',
    icon: 'storefront',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    description: 'Small dense chunks with wide retrieval net. Persuasion-focused prompts.',
    chunkingHint: 'Recursive chunking · 256 tokens',
    blueprint: [
      { icon: 'account_tree', label: 'Knowledge Graph', value: 'Disabled', active: false },
      { icon: 'content_cut',  label: 'Chunking',        value: 'Dense recursive · 256 tokens', active: true },
      { icon: 'travel_explore', label: 'Retrieval',     value: 'Top 15 chunks (wide net)', active: true },
      { icon: 'chat_bubble',  label: 'Tone',            value: 'Persuasive & outcome-driven', active: true },
    ],
  },
};

export function getDomainMeta(domain?: string): DomainMeta {
  return DOMAIN_META[(domain as DomainKey) ?? 'general'] ?? DOMAIN_META.general;
}

export const DOMAIN_KEYS: DomainKey[] = ['general', 'education', 'legal', 'sales'];
