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
        // Dispatch event to refresh dashboard stats
        window.dispatchEvent(new CustomEvent('bot-updated'));
        navigate('/bots');
      } else {
        // Create new bot and redirect to config page
        const newBot = await botsApi.create(botData);
        // Dispatch event to refresh dashboard stats
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
      { label: 'Bots', path: '/bots' },
      { label: isEdit ? 'Edit Bot' : 'New Bot' }
    ]}>
      <div className="p-8 bg-background-off dark:bg-[#0a0b14] min-h-full">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-2 mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isEdit ? 'Edit Bot Configuration' : 'Create New Bot'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Customize your bot's identity, appearance, and core behavior.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity Card */}
            <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">badge</span>
                Identity
              </h3>
              <div className="space-y-6">
                {/* Bot Name */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Bot Name <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Help Desk Bot"
                    required
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-400"
                  />
                </label>

                {/* Description */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </span>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what your bot does..."
                    rows={3}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white min-h-[100px] p-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-400 resize-none"
                  />
                  <span className="text-xs text-slate-500 text-right">
                    {formData.description.length}/200 characters
                  </span>
                </label>
              </div>
            </div>

            {/* Behavior Configuration Card */}
            <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">psychology</span>
                Behavior Configuration
              </h3>
              <div className="space-y-6">
                {/* Welcome Message */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Welcome Message
                  </span>
                  <textarea
                    value={formData.welcome_message}
                    onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                    placeholder="Hi! How can I help you today?"
                    rows={2}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white p-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-400 resize-none"
                  />
                </label>

                {/* Fallback Message */}
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Fallback Message
                  </span>
                  <textarea
                    value={formData.fallback_message}
                    onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
                    placeholder="I'm sorry, I don't have enough information to answer that question."
                    rows={2}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white p-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-400 resize-none"
                  />
                </label>

                {/* Model Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Temperature */}
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Temperature
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                    <span className="text-xs text-slate-500">
                      Controls randomness (0-2). Higher values make output more creative.
                    </span>
                  </label>

                  {/* Max Tokens */}
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Max Tokens
                    </span>
                    <input
                      type="number"
                      step="100"
                      min="100"
                      max="4000"
                      value={formData.max_tokens}
                      onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                      className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                    <span className="text-xs text-slate-500">
                      Maximum response length
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/bots')}
                disabled={loading}
                className="flex items-center justify-center rounded-lg h-10 px-6 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                    Saving...
                  </>
                ) : (
                  <>{isEdit ? 'Save Changes' : 'Create Bot'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
