import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import { documentsApi } from '../api/documents';
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
  const [tableLoading, setTableLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');



  // Form data for settings
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model: 'openai/gpt-4o-mini',
    system_prompt: '',
    welcome_message: '',
    fallback_message: '',
    temperature: 0.7,
    max_tokens: 2000,
    top_k: 5,
    similarity_threshold: 0,
    zalo_integration: {
      account_id: '',
      is_active: false
    }
  });

  const loadBot = async (botId: string) => {
    try {
      const botData = await botsApi.get(botId);
      setBot(botData);
      setFormData({
        name: botData.name,
        description: botData.description || '',
        model: botData.config?.model || 'openai/gpt-4o-mini',
        system_prompt: botData.config?.system_prompt || '',
        welcome_message: botData.config?.welcome_message || '',
        fallback_message: botData.config?.fallback_message || '',
        temperature: botData.config?.temperature || 0.7,
        max_tokens: botData.config?.max_tokens || 2000,
        top_k: botData.config?.top_k || 5,
        similarity_threshold: botData.config?.similarity_threshold || 0.6,
        zalo_integration: botData.config?.zalo_integration || {
          account_id: '',
          is_active: false
        }
      });
    } catch (error) {
      setError('Failed to load bot');
      console.error('Failed to load bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (botId: string) => {
    setTableLoading(true);
    try {
      const docs = await documentsApi.list(botId);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadBot(id);
      loadDocuments(id);
    }
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['playground', 'basic', 'knowledge', 'channels', 'advanced'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

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
          model: formData.model,
          system_prompt: formData.system_prompt,
          welcome_message: formData.welcome_message,
          fallback_message: formData.fallback_message,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          top_k: formData.top_k,
          similarity_threshold: formData.similarity_threshold,
          zalo_integration: formData.zalo_integration
        },
      };

      await botsApi.update(id, botData);
      window.dispatchEvent(new CustomEvent('bot-updated'));
      toast.success('Settings saved successfully');
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to save bot');
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    const uploadToast = toast.loading('Uploading document...');
    try {
      await documentsApi.upload(id, file);
      await loadDocuments(id);
      toast.success('Document uploaded', { id: uploadToast });
    } catch (error) {
      toast.error('Upload failed', { id: uploadToast });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?') || !id) return;
    try {
      await documentsApi.delete(id, docId);
      setDocuments(documents.filter(doc => doc.id !== docId));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/bots/${id}/chat`)}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                Open Playground
              </button>
              <button
                onClick={() => navigate('/bots')}
                className="px-4 py-2 bg-background border border-border text-foreground hover:bg-muted/50 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>
            </div>
          </div>


          {/* Connected Tabs */}
          <div className="px-2 bg-muted/20">
            <nav className="flex gap-2 overflow-x-auto scrollbar-hide p-2">
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
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Model</label>
                        <div className="relative">
                          <select
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm appearance-none cursor-pointer"
                          >
                            <optgroup label="OpenAI (Next Gen)">
                              <option value="openai/gpt-5-mini">GPT-5 Mini (New!)</option>
                              <option value="openai/gpt-4.1-mini">GPT-4.1 Mini</option>
                              <option value="openai/gpt-4o">GPT-4o (Stable)</option>
                              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                            </optgroup>
                            <optgroup label="Google">
                              <option value="google/gemini-2.5-flash-lite-preview-09-2025">Gemini 2.5 Flash Lite (Preview)</option>
                              <option value="google/gemini-flash-1.5">Gemini 1.5 Flash</option>
                              <option value="google/gemini-pro-1.5">Gemini 1.5 Pro</option>
                            </optgroup>
                            <optgroup label="Meta & Open Source">
                              <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                              <option value="meta-llama/llama-3.1-405b-instruct">Llama 3.1 405B</option>
                              <option value="qwen/qwen-2.5-72b-instruct">Qwen 2.5 72B</option>
                              <option value="deepseek/deepseek-chat">DeepSeek V3</option>
                              <option value="mistralai/mistral-large">Mistral Large 2</option>
                            </optgroup>
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground material-symbols-outlined text-sm">expand_more</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Role</label>
                        <input
                          type="text"
                          value="Assistant"
                          disabled
                          className="w-full px-4 py-2.5 rounded-xl bg-muted/10 border border-border text-muted-foreground text-sm cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <label className="text-sm font-semibold text-foreground">System Prompt</label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.name && !formData.description) {
                              toast.error('Please enter a name or description first');
                              return;
                            }
                            const toastId = toast.loading('Generating prompt...');
                            try {
                              // Pass 'id' (botId from params) if available to make prompt context-aware
                              const prompt = await botsApi.generatePrompt(formData.name, formData.description, id);
                              setFormData(prev => ({ ...prev, system_prompt: prompt }));
                              toast.success('Prompt generated with document context!', { id: toastId });
                            } catch (err) {
                              toast.error('Failed to generate prompt', { id: toastId });
                            }
                          }}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                          Auto-Write
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Define the agent's personality, constraints, and instructions.</p>
                      <textarea
                        value={formData.system_prompt}
                        onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                        rows={6}
                        placeholder="You are a helpful assistant..."
                        className="w-full px-4 py-2.5 rounded-xl bg-muted/20 border border-border focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm resize-none font-mono"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
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
                          <span>Determinstic</span>
                          <span>Creative</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Max Tokens</label>
                        <input
                          type="number"
                          min="100"
                          max="32000"
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
                      {tableLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                            <td className="px-6 py-4"><Skeleton className="h-8 w-8 ml-auto rounded-lg" /></td>
                          </tr>
                        ))
                      ) : documents.length === 0 ? (
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
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <span className="material-symbols-outlined text-3xl">chat</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Zalo Integration</h3>
                      <p className="text-sm text-muted-foreground">Power your Zalo OA or Personal Account with OmniRAG AI.</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${formData.zalo_integration?.is_active ? 'bg-success-50 text-success-600 border border-success-200' : 'bg-muted text-muted-foreground border border-border'}`}>
                    <span className={`size-2 rounded-full ${formData.zalo_integration?.is_active ? 'bg-success-500 animate-pulse' : 'bg-muted-foreground'}`}></span>
                    {formData.zalo_integration?.is_active ? 'AI ACTIVE' : 'INACTIVE'}
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-10">
                  {/* Step 1: Connection Info */}
                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-muted/20 border border-border border-dashed">
                      <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">1</span>
                        Connect to Zalo Hub
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        To use Zalo with OmniRAG, you first need to connect your Zalo account to our central integration hub on Func.vn.
                      </p>

                      <div className="bg-white p-4 rounded-xl border border-border w-fit mx-auto shadow-sm group relative overflow-hidden">
                        {/* Placeholder for QR - In a real app this would be a dynamic QR or link */}
                        <div className="size-32 bg-muted/50 rounded flex items-center justify-center text-muted-foreground border border-border border-dashed group-hover:bg-primary/5 transition-colors">
                          <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform">qr_code_2</span>
                        </div>
                        <div className="absolute inset-0 bg-primary/80 text-primary-foreground flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <span className="material-symbols-outlined mb-1">open_in_new</span>
                          <span className="text-[10px] font-bold">OPEN HUB</span>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-[11px] text-primary-700 font-medium">
                          <strong>Note:</strong> After connecting on Func.vn, note down your <strong>Zalo Account ID</strong> or <strong>OA ID</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">2</span>
                        Configure Integration
                      </h4>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Zalo Account / OA ID</label>
                          <input
                            type="text"
                            placeholder="e.g. 182736455243"
                            value={formData.zalo_integration?.account_id || ''}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                zalo_integration: {
                                  ...formData.zalo_integration,
                                  account_id: e.target.value
                                }
                              });
                            }}
                            className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                          <div>
                            <p className="text-sm font-bold text-foreground">Enable AI Auto-Reply</p>
                            <p className="text-xs text-muted-foreground">Bot will automatically reply to Zalo messages.</p>
                          </div>
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                zalo_integration: {
                                  ...formData.zalo_integration,
                                  is_active: !formData.zalo_integration?.is_active
                                }
                              });
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.zalo_integration?.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.zalo_integration?.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar/Docs */}
                  <div className="space-y-6">
                    <div className="bg-muted/10 rounded-2xl p-6 border border-border">
                      <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">info</span>
                        How it works
                      </h4>
                      <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex gap-3">
                          <span className="font-bold text-primary">1.</span>
                          <p>Messages from Zalo users are sent to our central Hub on Func.vn.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="font-bold text-primary">2.</span>
                          <p>Our Hub forwards the message to your specific OmniRAG bot based on your <strong>Account ID</strong>.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="font-bold text-primary">3.</span>
                          <p>The AI analyzes your knowledge base and generates a response.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="font-bold text-primary">4.</span>
                          <p>OmniRAG sends the response back to Zalo instantly using our verified API.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-warning-600 text-[18px]">warning</span>
                        <div>
                          <p className="text-[11px] font-bold text-warning-800">Prerequisite</p>
                          <p className="text-[10px] text-warning-700 leading-tight mt-0.5">
                            Make sure your Zalo account is correctly linked to our Hub. Contact support if you haven't received the Hub connection invitation.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-border flex justify-end">
                  <button
                    onClick={handleSaveBasicSettings}
                    disabled={loading || !formData.zalo_integration?.account_id}
                    className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? 'Saving...' : 'Save & Activate Integration'}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* Playground Tab - Redirect to Full Experience */}
          {activeTab === 'playground' && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in zoom-in duration-500">
              <div className="size-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-8 animate-bounce transition-all">
                <span className="material-symbols-outlined text-5xl">rocket_launch</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Professional Playground</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
                Experience your agent in a high-performance, 3-column workspace inspired by Kotaemon.
                Includes real-time citations, agent logs, and document preview.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <button
                  onClick={() => navigate(`/bots/${id}/chat`)}
                  className="flex-1 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-1 flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined">forum</span>
                  Go to Playground
                </button>
                <button
                  onClick={() => setActiveTab('basic')}
                  className="px-8 py-4 bg-muted text-foreground font-semibold rounded-2xl hover:bg-muted/80 transition-all flex items-center justify-center gap-2"
                >
                  Stay in Config
                </button>
              </div>

              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-50">
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-primary">view_column</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">3-Column Layout</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-primary">search_check</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Visual Citations</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-primary">terminal</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Agent Logs</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-primary">history</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Full History</span>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                    <span className="material-symbols-outlined">science</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Retrieval Configuration</h3>
                    <p className="text-sm text-muted-foreground">Fine-tune how the agent searches its knowledge base.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-sm font-semibold text-foreground">Top K Results</label>
                        <span className="text-xs font-mono font-bold text-primary">{formData.top_k} chunks</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={formData.top_k}
                        onChange={(e) => setFormData({ ...formData, top_k: parseInt(e.target.value) })}
                        className="w-full h-2 bg-muted-foreground/20 rounded-full appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of document chunks to retrieve and feed into the context window. Higher values provide more context but increase costs and latency.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-sm font-semibold text-foreground">Similarity Threshold</label>
                        <span className="text-xs font-mono font-bold text-primary">{formData.similarity_threshold}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.similarity_threshold}
                        onChange={(e) => setFormData({ ...formData, similarity_threshold: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-muted-foreground/20 rounded-full appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum similarity score required for a chunk to be considered relevant. set to 0 to retrieve everything.
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/10 rounded-xl p-4 text-xs text-muted-foreground space-y-2 h-fit">
                    <p className="font-semibold text-foreground mb-2">Recommendation:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Top K:</strong> 3-5 is usually sufficient for specific answers. Use 10+ for summarization tasks.</li>
                      <li><strong>Threshold:</strong> 0.6-0.7 filters out irrelevant noise. 0.0 relies purely on Top K rankings.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveBasicSettings}
                  disabled={loading}
                  className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Saving...' : 'Save Advanced Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout >
  );
}
