import { useState, useEffect } from 'react';
import { botTemplatesApi } from '../../api/botTemplates';
import type { BotTemplate } from '../../api/botTemplates';
import { getDomainMeta, DOMAIN_KEYS } from '../../utils/domainHelpers';
import type { DomainKey } from '../../utils/domainHelpers';

// ─── Blueprint Card ────────────────────────────────────────────────────────────

function BlueprintCard({ domain }: { domain: DomainKey }) {
    const meta = getDomainMeta(domain);
    return (
        <div className="mt-4 rounded-2xl border border-white/8 bg-background/30 backdrop-blur-md p-5">
            <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[18px] text-muted-foreground/60">auto_fix_high</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Domain Blueprint</span>
            </div>
            <div className="flex flex-col gap-3">
                {meta.blueprint.map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                        <span className={`material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5 ${item.active ? meta.iconColor : 'text-muted-foreground/25'}`}>
                            {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-semibold text-muted-foreground/45 uppercase tracking-wider leading-tight">
                                {item.label}
                            </div>
                            <div className={`text-xs font-medium mt-0.5 ${item.active ? 'text-foreground/75' : 'text-muted-foreground/30 line-through'}`}>
                                {item.value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onSelect }: { template: BotTemplate; onSelect: (t: BotTemplate) => void }) {
    const dm = getDomainMeta(template.domain);
    return (
        <button
            onClick={() => onSelect(template)}
            className="group w-full text-left rounded-2xl border border-white/8 bg-background/30 hover:bg-background/50 hover:border-white/20 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="size-9 rounded-xl bg-background/50 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-white/20 transition-colors">
                    <span className={`material-symbols-outlined text-[18px] ${dm.iconColor}`}>
                        {template.icon || dm.icon}
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {template.name}
                    </h4>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${dm.badge}`}>
                        <span className="material-symbols-outlined text-[11px]">{dm.icon}</span>
                        {dm.label}
                    </span>
                </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{template.description}</p>
            {Object.keys(template.features).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.keys(template.features).slice(0, 3).map((f) => (
                        <span key={f} className="px-2 py-0.5 bg-white/5 text-[10px] font-medium rounded-full text-muted-foreground/70">
                            {f.replace(/_/g, ' ')}
                        </span>
                    ))}
                    {Object.keys(template.features).length > 3 && (
                        <span className="px-2 py-0.5 bg-white/5 text-[10px] font-medium rounded-full text-muted-foreground/50">
                            +{Object.keys(template.features).length - 3}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
}

// ─── Main TemplateSelector ─────────────────────────────────────────────────────

export default function TemplateSelector({ onSelect }: { onSelect: (template: BotTemplate) => void }) {
    const [templates, setTemplates] = useState<BotTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDomain, setSelectedDomain] = useState<DomainKey>('general');

    useEffect(() => {
        botTemplatesApi.list()
            .then(setTemplates)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filteredTemplates = templates.filter((t) => {
        const tDomain = (['education', 'legal', 'sales'].includes(t.domain) ? t.domain : 'general') as DomainKey;
        return tDomain === selectedDomain;
    });

    const blankTemplate: BotTemplate = {
        id: 'blank',
        name: 'Start from Scratch',
        description: 'Build a fully custom agent without a predefined template.',
        domain: 'general',
        icon: 'edit_note',
        features: {},
        system_prompt: '',
        welcome_message: 'Hello! How can I help you?',
        temperature: 0.7,
        personality: 'professional',
        fallback_message: "I'm sorry, I don't understand.",
        max_tokens: 1000,
        tone_formality: 0.5,
        verbosity: 'concise',
        suggested_categories: [],
        sample_queries: [],
        required_metadata_fields: [],
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    Step 1 of 4 — Choose Template & Domain
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Pick a Starting Point</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Select a domain, then choose a template — or start from scratch.
                </p>
            </div>

            {/* 2-Panel Layout */}
            <div className="flex gap-5 min-h-[520px]">

                {/* LEFT: Domain Sidebar */}
                <div className="w-52 flex-shrink-0 flex flex-col gap-2">
                    <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-1 mb-1">Domain</div>
                    {DOMAIN_KEYS.map((key) => {
                        const meta = getDomainMeta(key);
                        const isSelected = selectedDomain === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setSelectedDomain(key)}
                                className={`group flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl border transition-all duration-200 ${
                                    isSelected
                                        ? 'border-white/15 bg-background/60 shadow-sm'
                                        : 'border-transparent hover:border-white/8 hover:bg-background/30'
                                }`}
                            >
                                <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isSelected ? 'bg-background/80 border border-white/10' : 'bg-transparent'
                                }`}>
                                    <span className={`material-symbols-outlined text-[18px] transition-colors ${
                                        isSelected ? meta.iconColor : 'text-muted-foreground/40 group-hover:text-muted-foreground/70'
                                    }`}>
                                        {meta.icon}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <div className={`text-sm font-semibold truncate transition-colors ${
                                        isSelected ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-muted-foreground'
                                    }`}>
                                        {meta.label}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground/40 truncate mt-0.5">
                                        {meta.chunkingHint}
                                    </div>
                                </div>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-[14px] text-muted-foreground/40 ml-auto flex-shrink-0">chevron_right</span>
                                )}
                            </button>
                        );
                    })}

                    {/* Blueprint Card in sidebar below domain list */}
                    <div className="mt-2">
                        <BlueprintCard domain={selectedDomain} />
                    </div>
                </div>

                {/* RIGHT: Template Grid */}
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-1 mb-3">
                        Templates for {getDomainMeta(selectedDomain).label}
                    </div>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
                            {/* Template cards */}
                            {filteredTemplates.length > 0 ? (
                                filteredTemplates.map((t) => (
                                    <TemplateCard key={t.id} template={t} onSelect={onSelect} />
                                ))
                            ) : (
                                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-muted-foreground/50">
                                    No templates for this domain yet
                                </div>
                            )}

                            {/* Blank template always at bottom */}
                            <button
                                onClick={() => onSelect({ ...blankTemplate, domain: selectedDomain })}
                                className="group w-full text-left rounded-2xl border border-dashed border-white/10 hover:border-white/20 bg-transparent hover:bg-background/30 p-5 transition-all duration-200"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="size-9 rounded-xl bg-background/30 border border-white/8 flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-[18px] text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
                                            edit_note
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                                            Start from Scratch
                                        </div>
                                        <div className="text-xs text-muted-foreground/40 mt-0.5">
                                            Custom agent, {getDomainMeta(selectedDomain).label} domain settings applied
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-[16px] text-muted-foreground/30 ml-auto group-hover:text-muted-foreground/60 transition-colors">
                                        arrow_forward
                                    </span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
