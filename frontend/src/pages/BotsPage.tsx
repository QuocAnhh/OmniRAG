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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if button is inside a link
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
      <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Chatbots
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your RAG-powered AI assistants
            </p>
          </div>
          <Link
            to="/bots/new"
            className="
              inline-flex items-center justify-center gap-2
              w-full sm:w-auto px-6 py-3
              bg-primary text-primary-foreground
              hover:bg-primary/90
              font-semibold
              rounded-xl
              shadow-lg shadow-primary/20
              hover:-translate-y-0.5
              transition-all duration-200
            "
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Bot
          </Link>
        </div>

        {/* Bots Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border shadow-sm flex flex-col h-[220px] overflow-hidden animate-pulse">
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-xl bg-muted"></div>
                      <div className="space-y-2">
                        <div className="h-5 w-24 bg-muted rounded"></div>
                        <div className="h-4 w-16 bg-muted rounded"></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-4 w-full bg-muted rounded"></div>
                    <div className="h-4 w-4/5 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="p-4 border-t border-border bg-muted/5 flex gap-2">
                  <div className="h-10 w-10 bg-muted rounded-xl"></div>
                  <div className="flex-1 h-10 bg-muted rounded-xl"></div>
                  <div className="h-10 w-10 bg-muted rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border dashed border-2 p-12 text-center flex flex-col items-center justify-center gap-4">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-muted-foreground">smart_toy</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">No bots yet</h3>
              <p className="text-muted-foreground mt-1 max-w-xs mx-auto">Create your first RAG chatbot to get started with AI assistance.</p>
            </div>
            <Link
              to="/bots/new"
              className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all"
            >
              Create Your First Bot
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="
                  group
                  bg-card
                  rounded-2xl
                  border border-border
                  hover:border-primary/30
                  shadow-sm hover:shadow-lg hover:shadow-primary/5
                  transition-all duration-300
                  hover:-translate-y-1
                  flex flex-col
                  h-full
                "
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined text-2xl">smart_toy</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground line-clamp-1">{bot.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${bot.is_active
                          ? 'bg-success-50 text-success-600 border-success-400/20'
                          : 'bg-muted text-muted-foreground border-border'
                          }`}>
                          {bot.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 mb-6 bg-muted/10 p-3 rounded-lg border border-border/50 min-h-[5rem]">
                    {bot.description || 'No description provided.'}
                  </p>
                </div>

                <div className="p-4 border-t border-border bg-muted/5 rounded-b-2xl flex gap-2">
                  <Link
                    to={`/bots/${bot.id}`}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Open Chat Studio"
                  >
                    <span className="material-symbols-outlined text-[20px]">responsive_layout</span>
                  </Link>
                  <Link
                    to={`/bots/${bot.id}/config`}
                    className="flex-1 px-4 py-2.5 bg-background border border-border text-foreground hover:bg-muted font-medium rounded-xl text-sm transition-all text-center flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    Config
                  </Link>
                  <button
                    onClick={(e) => handleDelete(bot.id, e)}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete Bot"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

