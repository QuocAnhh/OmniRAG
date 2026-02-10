import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';

export default function BotFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    welcome_message: '',
    fallback_message: '',
    temperature: 0.7,
    max_tokens: 2000,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit && id) {
      loadBot(id);
    }
  }, [id, isEdit]);

  const loadBot = async (botId: string) => {
    try {
      const bot = await botsApi.get(botId);
      setFormData({
        name: bot.name,
        description: bot.description || '',
        welcome_message: bot.config?.welcome_message || '',
        fallback_message: bot.config?.fallback_message || '',
        temperature: bot.config?.temperature || 0.7,
        max_tokens: bot.config?.max_tokens || 2000,
      });
    } catch (error) {
      setError('Failed to load bot');
      console.error('Failed to load bot:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const botData = {
        name: formData.name,
        description: formData.description,
        config: {
          welcome_message: formData.welcome_message,
          fallback_message: formData.fallback_message,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
        },
      };

      if (isEdit && id) {
        await botsApi.update(id, botData);
        window.dispatchEvent(new CustomEvent('bot-updated'));
        navigate('/bots');
      } else {
        const newBot = await botsApi.create(botData);
        window.dispatchEvent(new CustomEvent('bot-created'));
        navigate(`/bots/${newBot.id}/config?tab=knowledge`);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to save bot');
      console.error('Failed to save bot:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout breadcrumbs={[
      { label: 'Home', path: '/' },
      { label: 'Agents', path: '/bots' },
      { label: isEdit ? 'Edit Agent' : 'Deploy Agent' }
    ]}>
      <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">

        {/* Header */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            AI Agent
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isEdit ? 'Modify Agent' : 'Create New Agent'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Define the identity, personality, and operational parameters of your AI assistant.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Identity Card */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Agent Identity</h2>
                <p className="text-xs text-muted-foreground">Core identification details</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Agent Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Customer Support Alpha"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the agent's role and purpose..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm placeholder:text-muted-foreground/50 resize-none"
                />
                <div className="flex justify-end">
                  <span className="text-xs text-muted-foreground">{formData.description.length}/200 characters</span>
                </div>
              </div>
            </div>
          </div>

          {/* Behavior Configuration */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent-600">
                <span className="material-symbols-outlined text-[20px]">psychology</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Behavior & Personality</h2>
                <p className="text-xs text-muted-foreground">How the agent interacts with users</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Welcome Message</label>
                <textarea
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="Hello! How can I assist you today?"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Fallback Message</label>
                <textarea
                  value={formData.fallback_message}
                  onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
                  placeholder="I'm not sure I understand. Could you rephrase that?"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-sm font-semibold text-foreground">Temperature</label>
                    <span className="text-xs font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">{formData.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    <span>Precise</span>
                    <span>Balanced</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Max Tokens</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      max="4000"
                      step="100"
                      value={formData.max_tokens}
                      onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm placeholder:text-muted-foreground/50"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-muted-foreground text-xs">tokens</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Controls maximum length of the response.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Preview - Optional, keep simple */}
          <div className="bg-gradient-to-br from-muted/50 to-muted/10 rounded-2xl border border-border/50 p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">Estimated Performance</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Avg Latency</p>
                <p className="text-sm font-bold text-foreground">
                  ~{Math.floor(50 + formData.max_tokens / 20)}ms
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cost Efficiency</p>
                <p className="text-sm font-bold text-foreground">
                  High
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Response Style</p>
                <p className={`text-sm font-bold ${formData.temperature < 0.5 ? 'text-blue-500' : formData.temperature > 1.0 ? 'text-orange-500' : 'text-green-500'}`}>
                  {formData.temperature < 0.5 ? 'Analytical' : formData.temperature > 1.0 ? 'Imaginative' : 'Balanced'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  processing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">{isEdit ? 'save' : 'rocket_launch'}</span>
                  {isEdit ? 'Save Changes' : 'Deploy Agent'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/bots')}
              disabled={loading}
              className="px-6 py-3 bg-background border border-border text-foreground font-semibold rounded-xl hover:bg-muted/50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
