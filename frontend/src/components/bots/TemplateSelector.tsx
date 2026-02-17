import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { botTemplatesApi } from '../../api/botTemplates';
import type { BotTemplate } from '../../api/botTemplates';

interface TemplateCardProps {
    template: BotTemplate;
    onSelect: (template: BotTemplate) => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
    const domainColors = {
        education: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20 hover:border-blue-500/40',
        sales: 'from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40',
        legal: 'from-amber-500/10 to-yellow-500/10 border-amber-500/20 hover:border-amber-500/40',
        other: 'from-gray-500/10 to-slate-500/10 border-gray-500/20 hover:border-gray-500/40',
    };

    const domainIcons = {
        education: 'text-blue-500',
        sales: 'text-green-500',
        legal: 'text-amber-500',
        other: 'text-gray-500',
    };

    return (
        <div
            onClick={() => onSelect(template)}
            className={`group relative bg-gradient-to-br ${domainColors[template.domain]} 
        rounded-2xl p-6 border-2 transition-all duration-300 cursor-pointer
        hover:shadow-xl hover:-translate-y-1`}
        >
            {/* Icon */}
            <div className={`size-14 rounded-xl bg-white/80 flex items-center justify-center mb-4 
        group-hover:scale-110 transition-transform duration-300`}>
                <span className={`material-symbols-outlined text-3xl ${domainIcons[template.domain]}`}>
                    {template.icon}
                </span>
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {template.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {template.description}
            </p>

            {/* Features Pills */}
            <div className="flex flex-wrap gap-2">
                {Object.keys(template.features).slice(0, 3).map((feature) => (
                    <span
                        key={feature}
                        className="px-2 py-0.5 bg-background/60 text-xs font-medium rounded-full text-foreground/70"
                    >
                        {feature.replace('_', ' ')}
                    </span>
                ))}
                {Object.keys(template.features).length > 3 && (
                    <span className="px-2 py-0.5 bg-background/60 text-xs font-medium rounded-full text-foreground/70">
                        +{Object.keys(template.features).length - 3} more
                    </span>
                )}
            </div>

            {/* Hover arrow */}
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-primary">arrow_forward</span>
            </div>
        </div>
    );
}

export default function TemplateSelector({ onSelect }: { onSelect?: (template: BotTemplate) => void }) {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<BotTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDomain, setSelectedDomain] = useState<'all' | 'education' | 'sales' | 'legal'>('all');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const data = await botTemplatesApi.list();
            setTemplates(data);
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTemplates = selectedDomain === 'all'
        ? templates
        : templates.filter((t) => t.domain === selectedDomain);

    const handleTemplateSelect = (template: BotTemplate) => {
        if (onSelect) {
            onSelect(template);
        } else {
            // Navigate to bot creation with template
            navigate(`/bots/new?template=${template.id}`);
        }
    };

    const domainTabs = [
        { id: 'all' as const, label: 'All Templates', icon: 'apps' },
        { id: 'education' as const, label: 'Education', icon: 'school' },
        { id: 'sales' as const, label: 'Sales', icon: 'trending_up' },
        { id: 'legal' as const, label: 'Legal', icon: 'gavel' },
    ];

    return (
        <div className="flex flex-col gap-8">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    Start with a Template
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                    Choose Your Starting Point
                </h2>
                <p className="text-muted-foreground mt-2">
                    Pre-configured templates optimized for specific industries and use cases
                </p>
            </div>

            {/* Domain Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {domainTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setSelectedDomain(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${selectedDomain === tab.id
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.id !== 'all' && (
                            <span className="ml-1 px-1.5 py-0.5 bg-background/20 rounded text-xs">
                                {templates.filter((t) => t.domain === tab.id).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Start from Scratch Option */}
            <div className="p-6 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => {
                    const blankTemplate: BotTemplate = {
                        id: 'blank',
                        name: 'Blank Bot',
                        description: 'Start from scratch with a clean slate.',
                        domain: 'other',
                        icon: 'edit_note',
                        features: {},
                        system_prompt: '',
                        welcome_message: 'Hello! I am a new bot.',
                        temperature: 0.7,
                        personality: 'neutral',
                        fallback_message: "I'm sorry, I don't understand.",
                        max_tokens: 1000,
                        tone_formality: 0.5,
                        verbosity: 'concise',
                        suggested_categories: [],
                        sample_queries: [],
                        required_metadata_fields: []
                    };
                    if (onSelect) {
                        onSelect(blankTemplate);
                    } else {
                        navigate('/bots/new?template=blank');
                    }
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Start from Scratch</h3>
                            <p className="text-sm text-muted-foreground">
                                Build a custom bot without using a template
                            </p>
                        </div>
                    </div>
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                </div>
            </div>

            {/* Templates Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="inline-block size-10 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="text-muted-foreground ml-4">Loading templates...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
                    <p className="text-muted-foreground">No templates found for this domain</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            onSelect={onSelect ? onSelect : handleTemplateSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

