import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import type { Bot } from '../types/api';
import { Link } from 'react-router-dom';
import GradientText from '../components/ui/GradientText';

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
      window.dispatchEvent(new CustomEvent('bot-deleted'));
    } catch (error) {
      alert('Failed to delete bot');
    }
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Agents' }]}>
      <div className="flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20">
              <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
              AI Workforce
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Your AI Assistants
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage and monitor your fleet of intelligent agents.
            </p>
          </div>
          <Link to="/bots/new">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Create Bot
            </button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Bots</p>
            <p className="text-3xl font-bold text-foreground">{bots.length}</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active</p>
            <p className="text-3xl font-bold text-primary">
              {bots.filter(b => b.is_active).length}
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inactive</p>
            <p className="text-3xl font-bold text-muted-foreground/60">
              {bots.filter(b => !b.is_active).length}
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Uptime</p>
            <p className="text-3xl font-bold text-accent-600">98.7%</p>
          </div>
        </div>

        {/* Bots Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block size-10 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground mt-4 text-sm font-medium">Loading ecosystem...</p>
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
            <div className="size-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-muted-foreground">smart_toy</span>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No Bots Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Your garden is empty. Plant your first seed of intelligence.
            </p>
            <Link to="/bots/new">
              <button className="px-6 py-3 bg-background border border-border hover:border-primary/50 text-foreground font-semibold rounded-xl hover:bg-muted/50 transition-all">
                Create First Bot
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot, idx) => (
              <div
                key={bot.id}
                className="group bg-card hover:bg-muted/30 border border-border hover:border-primary/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 relative"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`size-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ${bot.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <span className="material-symbols-outlined">smart_toy</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${bot.is_active ? 'bg-primary/5 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}`}>
                    {bot.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {bot.name}
                </h3>
                <p className="text-xs font-mono text-muted-foreground/60 mb-4">
                  {bot.id.slice(0, 8).toUpperCase()}
                </p>

                <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px]">
                  {bot.description || 'No description provided for this agent.'}
                </p>

                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <Link to={`/bots/${bot.id}/config`} className="flex-1">
                    <button className="w-full py-2 px-3 bg-muted/50 hover:bg-primary/10 text-foreground hover:text-primary rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-lg">tune</span>
                      Configure
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    className="p-2 rounded-lg bg-muted/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete Bot"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
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
