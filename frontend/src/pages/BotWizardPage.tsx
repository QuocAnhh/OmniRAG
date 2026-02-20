import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout/Layout';
import TemplateSelector from '../components/bots/TemplateSelector';
import { botTemplatesApi } from '../api/botTemplates';
import type { BotTemplate } from '../api/botTemplates';

// Step components
function IdentityStep({ onNext, onBack, data, updateData }: any) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-card rounded-2xl border border-border p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">badge</span>
                    Identity & Purpose
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-2">Bot Name</label>
                        <input
                            type="text"
                            value={data.name}
                            onChange={(e) => updateData({ name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-muted/20 border border-border focus:ring-2 focus:ring-primary/20"
                            placeholder="e.g. Sales Assistant"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">Description</label>
                        <textarea
                            value={data.description}
                            onChange={(e) => updateData({ description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-muted/20 border border-border focus:ring-2 focus:ring-primary/20 h-32 resize-none"
                            placeholder="What is this bot's primary role?"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-between">
                <button onClick={onBack} className="px-6 py-3 rounded-xl border border-border hover:bg-muted font-medium">
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!data.name}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50 hover:shadow-lg hover:shadow-primary/20 transition-all"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

function PersonalityStep({ onNext, onBack, data, updateData }: any) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-card rounded-2xl border border-border p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent-600">psychology</span>
                    Personality & Tone
                </h3>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-sm font-semibold">Temperature (Creativity)</label>
                            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{data.temperature}</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1" step="0.1"
                            value={data.temperature}
                            onChange={(e) => updateData({ temperature: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground uppercase font-bold">
                            <span>Precise</span>
                            <span>Creative</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Simple presets for now */}
                        {['Professional', 'Friendly', 'Technical', 'Casual'].map(p => (
                            <button
                                key={p}
                                onClick={() => updateData({ personality: p.toLowerCase() })}
                                className={`p-4 rounded-xl border text-left transition-all ${data.personality === p.toLowerCase()
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <div className="font-bold text-sm mb-1">{p}</div>
                                <div className="text-xs text-muted-foreground">Select this tone</div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between">
                <button onClick={onBack} className="px-6 py-3 rounded-xl border border-border hover:bg-muted font-medium">
                    Back
                </button>
                <button
                    onClick={onNext}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
                >
                    Review & Create
                </button>
            </div>
        </div>
    );
}

// Main Wizard Component
export default function BotWizardPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<{
        templateId: string;
        name: string;
        description: string;
        temperature: number;
        personality: string;
        templateName?: string;
    }>({
        templateId: '',
        name: '',
        description: '',
        temperature: 0.7,
        personality: 'professional'
    });

    const steps = [
        { number: 1, title: 'Template' },
        { number: 2, title: 'Identity' },
        { number: 3, title: 'Behavior' },
        { number: 4, title: 'Review' },
    ];

    const handleTemplateSelect = (template: BotTemplate) => {
        setFormData(prev => ({
            ...prev,
            templateId: template.id,
            templateName: template.name,
            name: prev.name || template.name,
            description: prev.description || template.description,
            temperature: template.temperature,
            personality: template.personality
        }));
        setStep(2);
    };

    const handleCreate = async () => {
        setLoading(true);
        const toastId = toast.loading('Creating your agent...');
        try {
            const newBot = await botTemplatesApi.createFromTemplate({
                template_id: formData.templateId,
                name: formData.name,
                description: formData.description,
                customize_config: {
                    temperature: formData.temperature,
                    personality: formData.personality
                }
            });
            toast.success('Agent created successfully!', { id: toastId });
            window.dispatchEvent(new CustomEvent('bot-created'));

            if (newBot && newBot.id) {
                navigate(`/bots/${newBot.id}`);
            } else {
                navigate('/bots');
            }
        } catch (error) {
            console.error("Failed to create bot", error);
            toast.error('Failed to create agent. Please try again.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout breadcrumbs={[
            { label: 'Home', path: '/' },
            { label: 'Agents', path: '/bots' },
            { label: 'New Agent Wizard' }
        ]}>
            <div className="max-w-5xl mx-auto px-4 pb-20">

                {/* Wizard Progress Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-foreground mb-6">Create New Agent</h1>

                    <div className="relative flex items-center justify-between max-w-2xl mx-auto">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -z-10 -translate-y-1/2 rounded-full"></div>
                        <div
                            className="absolute top-1/2 left-0 h-1 bg-primary -z-10 -translate-y-1/2 rounded-full transition-all duration-500"
                            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                        ></div>

                        {steps.map((s) => (
                            <div key={s.number} className="flex flex-col items-center gap-2 bg-background px-2">
                                <div className={`
                   size-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all
                   ${step >= s.number
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'bg-background border-muted text-muted-foreground'}
                 `}>
                                    {step > s.number ? '✓' : s.number}
                                </div>
                                <span className={`text-xs font-medium ${step >= s.number ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {s.title}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="min-h-[400px]">
                    {step === 1 && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            <TemplateSelector onSelect={handleTemplateSelect} />
                        </div>
                    )}

                    {step === 2 && (
                        <IdentityStep
                            data={formData}
                            updateData={(u: any) => setFormData(p => ({ ...p, ...u }))}
                            onNext={() => setStep(3)}
                            onBack={() => setStep(1)}
                        />
                    )}

                    {step === 3 && (
                        <PersonalityStep
                            data={formData}
                            updateData={(u: any) => setFormData(p => ({ ...p, ...u }))}
                            onNext={() => setStep(4)}
                            onBack={() => setStep(2)}
                        />
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-card rounded-2xl border border-border p-8">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-green-600">rocket_launch</span>
                                    Review & Launch
                                </h3>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Identity</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-xs text-muted-foreground">Name</div>
                                                <div className="font-medium">{formData.name}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Description</div>
                                                <div className="font-medium text-sm">{formData.description}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Template</div>
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 text-xs font-medium">
                                                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                                    {formData.templateName}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Configuration</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-xs text-muted-foreground">Personality</div>
                                                <div className="capitalize font-medium">{formData.personality}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Creativity (Temp)</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary" style={{ width: `${formData.temperature * 100}%` }}></div>
                                                    </div>
                                                    <span className="text-sm font-medium">{formData.temperature}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <button onClick={() => setStep(3)} className="px-6 py-3 rounded-xl border border-border hover:bg-muted font-medium">
                                    Back
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={loading}
                                    className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                    {loading ? (
                                        <>
                                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Creating Agent...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">rocket_launch</span>
                                            Create Agent
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </Layout>
    );
}
