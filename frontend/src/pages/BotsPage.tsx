import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';
import { Link } from 'react-router-dom';

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const data = await botsApi.list();
      setBots(data);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      await botsApi.delete(id);
      setBots(bots.filter(bot => bot.id !== id));

      // Dispatch custom event to refresh dashboard stats
      window.dispatchEvent(new CustomEvent('bot-deleted'));
    } catch (error) {
      alert('Failed to delete bot');
    }
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Bots' }]}>
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-20 right-10 w-96 h-96 bg-ocean-blue/10 blob-shape opacity-30 blur-3xl"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
            <div className="animate-slide-up">
              <h1 className="text-4xl font-display font-bold text-text-main dark:text-white mb-2">
                Your <span className="text-gradient-ocean">AI Assistants</span>
              </h1>
              <p className="text-text-muted dark:text-gray-400">Manage your RAG-powered chatbots</p>
            </div>
            <Link to="/bots/new" className="animate-slide-up stagger-1">
              <button className="btn-ocean inline-flex h-12 items-center justify-center px-6 shadow-xl hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px] mr-2">add_circle</span>
                Create Bot
              </button>
            </Link>
          </div>

          {/* Bots Grid */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block size-16 animate-spin rounded-full border-4 border-ocean-blue border-t-transparent"></div>
              <p className="text-text-muted mt-4 font-medium">Loading your bots...</p>
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-20 card-elevated max-w-md mx-auto animate-scale-in">
              <div className="size-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-ocean-blue/20 to-coral/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-ocean-blue">smart_toy</span>
              </div>
              <h3 className="text-2xl font-display font-bold text-text-main dark:text-white mb-3">No bots yet</h3>
              <p className="text-text-muted dark:text-gray-400 mb-8 max-w-sm mx-auto">
                Create your first RAG chatbot to start automating support and knowledge retrieval
              </p>
              <Link to="/bots/new">
                <button className="btn-ocean inline-flex h-12 items-center px-8 shadow-xl">
                  <span className="material-symbols-outlined mr-2">rocket_launch</span>
                  Create Your First Bot
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bots.map((bot, idx) => (
                <div
                  key={bot.id}
                  className="group card-elevated p-6 relative overflow-hidden animate-slide-up hover:scale-105 transition-all duration-300"
                  style={{ contentVisibility: 'auto', animationDelay: `${idx * 0.1}s` }}
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-ocean-blue/5 to-coral/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-14 rounded-2xl bg-gradient-to-br from-ocean-blue to-ocean-light flex items-center justify-center text-white shadow-lg shadow-ocean-blue/30 group-hover:scale-110 transition-transform duration-300">
                          <span className="material-symbols-outlined text-[28px]">smart_toy</span>
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-text-main dark:text-white text-lg mb-1">{bot.name}</h3>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium border ${bot.is_active
                            ? 'bg-sage/10 text-sage border-sage/20'
                            : 'bg-text-muted/10 text-text-muted border-text-muted/20'
                            }`}>
                            {bot.is_active ? '● Active' : '○ Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-text-muted dark:text-gray-400 mb-6 line-clamp-2 min-h-[40px]">
                      {bot.description || 'No description provided'}
                    </p>

                    <div className="flex gap-2">
                      <Link to={`/bots/${bot.id}/config`} className="flex-1">
                        <button className="w-full px-4 py-2.5 bg-ocean-blue text-white rounded-xl font-semibold hover:bg-ocean-light transition-colors flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">tune</span>
                          Configure
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(bot.id)}
                        className="px-3 py-2.5 bg-coral/10 text-coral rounded-xl hover:bg-coral hover:text-white transition-colors border border-coral/20"
                        aria-label="Delete bot"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
