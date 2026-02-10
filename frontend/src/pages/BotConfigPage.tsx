import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import { documentsApi } from '../api/documents';
import { ChatMessage, ChatInput, TypingIndicator } from '../components/chat/ChatInterface';
import type { Bot, Document } from '../types/api';


type TabType = 'playground' | 'basic' | 'knowledge' | 'channels' | 'advanced';


export default function BotConfigPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'basic');
  const [bot, setBot] = useState<Bot | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Playground State
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Form data for basic settings
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    welcome_message: '',
    fallback_message: '',
    temperature: 0.7,
    max_tokens: 2000,
  });

  useEffect(() => {
    if (id) {
      loadBot(id);
      loadDocuments(id);
    }
  }, [id]);

  const loadBot = async (botId: string) => {
    try {
      const botData = await botsApi.get(botId);
      setBot(botData);
      setFormData({
        name: botData.name,
        description: botData.description || '',
        welcome_message: botData.config?.welcome_message || '',
        fallback_message: botData.config?.fallback_message || '',
        temperature: botData.config?.temperature || 0.7,
        max_tokens: botData.config?.max_tokens || 2000,
      });
    } catch (error) {
      setError('Failed to load bot');
      console.error('Failed to load bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (botId: string) => {
    try {
      const docs = await documentsApi.list(botId);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleSaveBasicSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setLoading(true);
    setError('');

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

      await botsApi.update(id, botData);
      setActiveTab('knowledge'); // Move to knowledge base tab after saving
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to save bot');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      await documentsApi.upload(id, file);
      await loadDocuments(id);
    } catch (error) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?') || !id) return;
    try {
      await documentsApi.delete(id, docId);
      setDocuments(documents.filter(doc => doc.id !== docId));
    } catch (error) {
      alert('Delete failed');
    }
  };

  const handleSendMessage = async (text: string) => {
    // Add user message immediately
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate AI response (Replace with real API call later)
    setTimeout(() => {
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${text}". As an AI agent, I am ready to process this request based on my configuration.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const tabs = [
    { id: 'basic' as TabType, label: 'Basic Settings', icon: 'tune' },
    { id: 'knowledge' as TabType, label: 'Knowledge Base', icon: 'library_books' },
    { id: 'channels' as TabType, label: 'Channels', icon: 'hub' },
    { id: 'advanced' as TabType, label: 'Advanced', icon: 'settings_suggest' },
  ];

  if (loading && !bot) {
    return (
      <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Agents', path: '/bots' }, { label: 'Config' }]}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground mt-4 text-sm font-medium">Loading configuration...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Agents', path: '/bots' }, { label: bot?.name || 'Config' }]}>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">

        {/* Top Header Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-5 border-b border-border/50 gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">settings</span>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">
                    {bot?.name || 'Agent Configuration'}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${bot?.is_active
                    ? 'bg-success-50 text-success-700 border-success-200'
                    : 'bg-muted text-muted-foreground border-border'
                    }`}>
                    {bot?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">Manage behavior, knowledge, and integrations</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/bots')}
              className="px-4 py-2 bg-background border border-border text-foreground hover:bg-muted/50 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Fleet
            </button>
          </div>


          {/* Connected Tabs */}
          <div className="px-2 bg-muted/20">
            <nav className="flex gap-2 overflow-x-auto scrollbar-hide p-2">
              <button
                onClick={() => setActiveTab('playground' as TabType)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'playground'
                  ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
              >
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                <span className="whitespace-nowrap">Playground</span>
              </button>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${activeTab === tab.id
                    ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <form onSubmit={handleSaveBasicSettings} className="space-y-6">

              <div className="grid md:grid-cols-3 gap-6">
                {/* Identity Column */}
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6 md:col-span-1 h-fit">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">badge</span>
                    Identity
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Agent Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Behavior Column */}
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6 md:col-span-2">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent-600">psychology</span>
                    Behavior Engine
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Welcome Message</label>
                      <textarea
                        value={formData.welcome_message}
                        onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Fallback Message</label>
                      <textarea
                        value={formData.fallback_message}
                        onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm resize-none"
                      />
                    </div>

                    <div className="p-4 bg-muted/20 rounded-xl border border-border/50 grid sm:grid-cols-2 gap-6 mt-2">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-sm font-semibold text-foreground">Temperature</label>
                          <span className="text-xs font-mono font-bold text-primary">{formData.temperature}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={formData.temperature}
                          onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-muted-foreground/20 rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          <span>Logic</span>
                          <span>Creative</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Max Tokens</label>
                        <input
                          type="number"
                          min="100"
                          max="4000"
                          step="100"
                          value={formData.max_tokens}
                          onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && id && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Knowledge Base Registry</h3>
                  <p className="text-sm text-muted-foreground">Manage the documents this agent uses for context.</p>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border">
                  Supported: PDF, DOCX, TXT • Max: 25MB
                </div>
              </div>

              {/* Upload Zone */}
              <label className="group relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-all cursor-pointer py-10 bg-muted/10 hover:bg-muted/30">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleUpload}
                  accept=".pdf,.docx,.txt"
                  disabled={uploading}
                />
                <div className="flex flex-col items-center gap-3 text-center pointer-events-none group-hover:-translate-y-1 transition-transform duration-300">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-foreground">
                      {uploading ? 'Uploading...' : 'Drop files to ingest'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                </div>
              </label>

              {/* Documents Table */}
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-foreground">Indexed Documents</h4>
                  <span className="bg-background text-xs font-semibold px-2 py-0.5 rounded border border-border">{documents.length} files</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-muted/10">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Filename</th>
                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Size</th>
                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Uploaded</th>
                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-sm">
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2 opacity-60">
                              <span className="material-symbols-outlined text-3xl">folder_off</span>
                              <p>No documents indexed yet</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl text-red-500/80">picture_as_pdf</span>
                                <span className="font-medium text-foreground">{doc.filename}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${doc.status === 'completed'
                                ? 'bg-success-50 text-success-700 border-success-200'
                                : 'bg-warning-50 text-warning-700 border-warning-200'
                                }`}>
                                {doc.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                              {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                            </td>
                            <td className="px-6 py-3 text-muted-foreground text-xs">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Delete Document"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center">
              <div className="size-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <span className="material-symbols-outlined text-3xl">hub</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Channel Integrations</h3>
              <p className="text-muted-foreground max-w-md mx-auto">Connecting this agent to external platforms (Slack, Telegram) is currently under development.</p>
              <button className="mt-6 px-6 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-colors">
                View Roadmap
              </button>
            </div>
          )}


          {/* Playground Tab */}
          {activeTab === 'playground' && (
            <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
              {/* Chat Area */}
              <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-success-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">Live Preview</span>
                  </div>
                  <button
                    onClick={() => setMessages([])}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    Reset
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-muted/5">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <span className="material-symbols-outlined text-3xl">forum</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">Start a conversation</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        Test your agent's responses, tone, and knowledge retrieval in real-time.
                      </p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                      ))}
                      {isTyping && <TypingIndicator />}
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-border bg-card">
                  <ChatInput onSend={handleSendMessage} disabled={isTyping} placeholder={`Message ${bot?.name || 'Agent'}...`} />
                  <p className="text-[10px] text-center text-muted-foreground mt-2">
                    AI can make mistakes. Please verify important information.
                  </p>
                </div>
              </div>

              {/* Debug / Info Panel */}
              <div className="hidden lg:flex flex-col gap-6">
                <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex-1">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">bug_report</span>
                    Debug Context
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Active Model</p>
                      <div className="p-2 bg-muted/30 rounded-lg border border-border text-xs font-mono text-foreground">
                        gpt-4o-mini
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">System Prompt</p>
                      <div className="p-2 bg-muted/30 rounded-lg border border-border text-xs font-mono text-muted-foreground h-32 overflow-y-auto custom-scrollbar">
                        {bot?.description || 'No system prompt configured.'}
                        <br />
                        Bot name: {bot?.name}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Retrieved Chunks</p>
                      <div className="p-8 border-2 border-dashed border-border rounded-xl text-center">
                        <p className="text-xs text-muted-foreground">No retrieval data active</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center">
              <div className="size-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <span className="material-symbols-outlined text-3xl">settings_suggest</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Advanced Configuration</h3>
              <p className="text-muted-foreground max-w-md mx-auto">Fine-tuning options for RAG retrieval strategies and prompt engineering are coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
