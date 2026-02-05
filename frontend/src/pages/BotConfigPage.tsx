import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import { documentsApi } from '../api/documents';
import type { Bot, Document } from '../types/api';

type TabType = 'basic' | 'knowledge' | 'channels' | 'advanced';

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

  const tabs = [
    { id: 'basic' as TabType, label: 'Basic Settings', icon: 'tune' },
    { id: 'knowledge' as TabType, label: 'Knowledge Base', icon: 'library_books' },
    { id: 'channels' as TabType, label: 'Channels', icon: 'hub' },
    { id: 'advanced' as TabType, label: 'Advanced', icon: 'settings_suggest' },
  ];

  if (loading && !bot) {
    return (
      <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Bots', path: '/bots' }, { label: 'Config' }]}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Bots', path: '/bots' }, { label: bot?.name || 'Config' }]}>
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-[#101122] border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 lg:px-10 py-3">
          <div className="flex items-center gap-4">
            <div className="size-8 text-primary">
              <svg className="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight">OmniRAG</h2>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2"></div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Editor</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-slate-900 dark:text-white font-medium">{bot?.name || 'Bot'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/bots')}
              className="flex items-center justify-center rounded-lg h-9 px-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] mr-2">arrow_back</span>
              Back to Bots
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <nav className="flex gap-8 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-[3px] pb-3 pt-4 px-1 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                <p className="text-sm font-bold whitespace-nowrap">{tab.label}</p>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-[#f8f8fc] dark:bg-[#0a0b14] py-8 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <form onSubmit={handleSaveBasicSettings} className="space-y-6">
              <div className="flex flex-col gap-2 mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Bot Configuration</h1>
                <p className="text-slate-500 dark:text-slate-400">Customize your bot's identity and behavior.</p>
              </div>

              {/* Identity Card */}
              <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  Identity
                </h3>
                <div className="space-y-6">
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
                      className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</span>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what your bot does..."
                      rows={3}
                      className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white min-h-[100px] p-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                    />
                  </label>
                </div>
              </div>

              {/* Behavior Card */}
              <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  Behavior
                </h3>
                <div className="space-y-6">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Welcome Message</span>
                    <textarea
                      value={formData.welcome_message}
                      onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                      placeholder="Hi! How can I help you today?"
                      rows={2}
                      className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white p-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fallback Message</span>
                    <textarea
                      value={formData.fallback_message}
                      onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
                      placeholder="I'm sorry, I don't have enough information to answer that."
                      rows={2}
                      className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white p-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                    />
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Temperature</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      />
                      <span className="text-xs text-slate-500">Controls randomness (0-2)</span>
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Max Tokens</span>
                      <input
                        type="number"
                        step="100"
                        min="100"
                        max="4000"
                        value={formData.max_tokens}
                        onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#101122] text-slate-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      />
                      <span className="text-xs text-slate-500">Maximum response length</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save & Continue to Knowledge Base'}
                </button>
              </div>
            </form>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && id && (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Knowledge Base</h1>
                <p className="text-slate-500 dark:text-slate-400">Upload documents to train your RAG model. Supported formats: .pdf, .docx, .txt</p>
              </div>

              {/* Upload Zone */}
              <div className="group relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border-light dark:border-border-dark bg-white dark:bg-[#16182e] hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer py-12 px-4">
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUpload} accept=".pdf,.docx,.txt" disabled={uploading} />
                <div className="flex flex-col items-center gap-4 text-center pointer-events-none">
                  <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-primary group-hover:bg-white dark:group-hover:bg-surface-dark shadow-sm transition-all">
                    <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {uploading ? 'Uploading...' : 'Drag and drop your files here'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      or click to browse from your computer (max 25MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Documents Table */}
              <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-6 py-4 w-[40%]">Name</th>
                      <th className="px-6 py-4 w-[20%]">Status</th>
                      <th className="px-6 py-4 w-[15%]">Size</th>
                      <th className="px-6 py-4 w-[15%]">Uploaded</th>
                      <th className="px-6 py-4 w-[10%] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-200 dark:divide-slate-800">
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                          No documents uploaded yet
                        </td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">{doc.filename}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                              doc.status === 'completed'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400 tabular-nums font-mono text-xs">
                            {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400 tabular-nums">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">hub</span>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Channel Integrations</h3>
              <p className="text-slate-500 dark:text-slate-400">Coming soon...</p>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="bg-white dark:bg-[#16182e] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">settings_suggest</span>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Advanced Settings</h3>
              <p className="text-slate-500 dark:text-slate-400">Coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
