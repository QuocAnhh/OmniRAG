import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

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
    } catch (error) {
      alert('Failed to delete bot');
    }
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Bots' }]}>
      <div className="p-8 bg-background-light dark:bg-background-dark min-h-full">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Chatbots</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your RAG-powered AI assistants</p>
            </div>
            <Link to="/bots/new">
              <Button variant="primary">
                <span className="material-symbols-outlined text-[20px] mr-2">add</span>
                Create Bot
              </Button>
            </Link>
          </div>

          {/* Bots Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">smart_toy</span>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No bots yet</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Create your first RAG chatbot to get started</p>
              <Link to="/bots/new">
                <Button variant="primary">Create Your First Bot</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bots.map((bot) => (
                <div key={bot.id} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">smart_toy</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{bot.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${bot.is_active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {bot.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{bot.description || 'No description'}</p>
                  <div className="flex gap-2">
                    <Link to={`/bots/${bot.id}/chat`} className="flex-none">
                      <Button variant="secondary" className="px-3" title="Open Full Screen Chat">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                      </Button>
                    </Link>
                    <Link to={`/bots/${bot.id}/config`} className="flex-1">
                      <Button variant="secondary" className="w-full">Config</Button>
                    </Link>
                    <Button variant="danger" onClick={() => handleDelete(bot.id)}>
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </Button>
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
