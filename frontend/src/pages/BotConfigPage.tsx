import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';
import Layout from '../components/Layout/Layout';
import { botsApi } from '../api/bots';
import { documentsApi } from '../api/documents';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { Bot, Document, PDFParserMode } from '../types/api';
import RetrievalTester from '../components/retrieval/RetrievalTester';
import { getDomainMeta } from '../utils/domainHelpers';
import { confirmAction } from '../lib/confirmAction';
import { BotConfigHeader } from './bot-config/BotConfigHeader';
import { useBotDocumentUpload } from './bot-config/useBotDocumentUpload';


type TabType = 'playground' | 'basic' | 'knowledge' | 'channels' | 'advanced';

const KG_STEPS = [
  'Extracting entities and relationships from document',
  'Building graph structure',
  'Saving and indexing graph',
];
const PROCESSING_STEPS = [
  'Downloading file from storage',
  'Parsing PDF (tables, images, layout)',
  'Chunking document',
  'Generating contextual prefixes',
  'Creating embeddings',
  'Indexing into vector database',
];
const getKgActiveStep = (elapsed: number) => {
  if (elapsed < 45) return 0;
  if (elapsed < 150) return 1;
  return 2;
};
const formatElapsed = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};


export default function BotConfigPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'basic');
  const [bot, setBot] = useState<Bot | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');

  // Zalo Bot connect state
  const [zaloBotConnecting, setZaloBotConnecting] = useState(false);
  const [zaloBotToken, setZaloBotToken] = useState('');

  // Zalo Personal connect state (experimental)
  const zaloPersonalEnabled = import.meta.env.VITE_ENABLE_ZALO_PERSONAL === 'true';
  const [zaloPersonalConnecting, setZaloPersonalConnecting] = useState(false);
  const [zaloPersonalPolling, setZaloPersonalPolling] = useState(false);
  const zaloPersonalPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Telegram connect state
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState('');

  // Facebook Messenger connect state
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbCookiesText, setFbCookiesText] = useState('');
  const [fbCookiesError, setFbCookiesError] = useState('');
  const fbFileInputRef = useRef<HTMLInputElement | null>(null);

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
    enable_knowledge_graph: false,
    enrich_picture_description: false,
    pdf_parser_mode: 'hybrid_auto' as PDFParserMode,
    pdf_structured_chunking: true,
    pdf_enrich_formula: false,
    pdf_sanitize: false,
    pdf_use_struct_tree: false,
    pdf_include_header_footer: false,
    pdf_detect_strikethrough: false,
    pdf_threads: 1,
    domain: 'general' as 'general' | 'education' | 'legal' | 'sales',
    zalo_bot: null as any,
    zalo_personal: null as any,
    telegram: null as any,
    facebook: null as any
  });

  const setEnableKnowledgeGraph = useCallback((enabled: boolean) => {
    setFormData(prev => ({ ...prev, enable_knowledge_graph: enabled }));
  }, []);

  const {
    dismissUploadStatus,
    handleCancelUpload,
    handleUpload,
    isLocked,
    uploading,
    uploadStatus,
  } = useBotDocumentUpload({
    botId: id,
    bot,
    documents,
    setDocuments,
    enableKnowledgeGraph: formData.enable_knowledge_graph,
    setEnableKnowledgeGraph,
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
        domain: (botData.config?.domain as 'general' | 'education' | 'legal' | 'sales') || 'general',
        enable_knowledge_graph: botData.config?.enable_knowledge_graph
          || ['education', 'legal'].includes(botData.config?.domain ?? ''),
        enrich_picture_description: botData.config?.enrich_picture_description || false,
        pdf_parser_mode: (botData.config?.pdf_parser_mode as PDFParserMode) || 'hybrid_auto',
        pdf_structured_chunking: botData.config?.pdf_structured_chunking ?? true,
        pdf_enrich_formula: botData.config?.pdf_enrich_formula || false,
        pdf_sanitize: botData.config?.pdf_sanitize || false,
        pdf_use_struct_tree: botData.config?.pdf_use_struct_tree || false,
        pdf_include_header_footer: botData.config?.pdf_include_header_footer || false,
        pdf_detect_strikethrough: botData.config?.pdf_detect_strikethrough || false,
        pdf_threads: botData.config?.pdf_threads || 1,
        zalo_bot: botData.config?.zalo_bot || null,
        zalo_personal: botData.config?.zalo_personal || null,
        telegram: botData.config?.telegram || null,
        facebook: botData.config?.facebook || null
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

  const loadMemories = useCallback(async (botId: string) => {
    if (!user?.id) return;
    setMemoriesLoading(true);
    try {
      const result = await botsApi.getMemories(botId, user.id);
      setMemories(result.memories || []);
      setMemoryEnabled(result.memory_enabled);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setMemoriesLoading(false);
    }
  }, [user?.id]);

  const handleClearMemories = async () => {
    if (!id || !user?.id) return;
    const confirmed = await confirmAction({
      title: 'Clear all memories?',
      text: 'Bot sẽ quên toàn bộ lịch sử nhớ về bạn. Không thể hoàn tác.',
      confirmText: 'Xoá hết',
      cancelText: 'Huỷ',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await botsApi.clearMemories(id, user.id);
      setMemories([]);
      toast.success('Đã xoá toàn bộ memory.');
    } catch {
      toast.error('Xoá memory thất bại.');
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

  // Auto-load memories when knowledge tab is active
  useEffect(() => {
    if (activeTab === 'knowledge' && id) {
      loadMemories(id);
    }
  }, [activeTab, id, loadMemories]);

  useEffect(() => {
    return () => {
      if (zaloPersonalPollRef.current) clearInterval(zaloPersonalPollRef.current);
    };
  }, []);

  const stopZaloPersonalPolling = () => {
    if (zaloPersonalPollRef.current) {
      clearInterval(zaloPersonalPollRef.current);
      zaloPersonalPollRef.current = null;
    }
    setZaloPersonalPolling(false);
  };

  const pollZaloPersonalLogin = () => {
    if (!id || zaloPersonalPollRef.current) return;
    setZaloPersonalPolling(true);
    zaloPersonalPollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(`/api/v1/channels/zalo-personal/login-status/${id}`);
        const worker = res.data.worker || {};
        setFormData(prev => ({
          ...prev,
          zalo_personal: {
            ...(prev.zalo_personal || {}),
            status: worker.status,
            uid: worker.uid,
            display_name: worker.name,
            connected_at: worker.connected_at,
            last_error: worker.last_error,
            qr_image: worker.qr_image,
            reply_policy: worker.reply_policy || 'mention_only',
            thread_whitelist: worker.thread_whitelist || [],
          }
        }));

        if (['connected', 'expired', 'error', 'relogin_required', 'duplicate_connection'].includes(worker.status)) {
          stopZaloPersonalPolling();
          if (worker.status === 'connected') {
            toast.success(`Zalo Personal connected${worker.name ? ` as ${worker.name}` : ''}`);
            await loadBot(id);
          }
        }
      } catch (err: any) {
        stopZaloPersonalPolling();
        toast.error(err.response?.data?.detail || 'Failed to poll Zalo Personal login');
      }
    }, 2500);
  };

  const handleSaveBasicSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const { qr_image: _zaloPersonalQrImage, ...zaloPersonalConfig } = formData.zalo_personal || {};
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
          enable_knowledge_graph: formData.enable_knowledge_graph,
          enrich_picture_description: formData.enrich_picture_description,
          pdf_parser_mode: formData.pdf_parser_mode,
          pdf_structured_chunking: formData.pdf_structured_chunking,
          pdf_enrich_formula: formData.pdf_enrich_formula,
          pdf_sanitize: formData.pdf_sanitize,
          pdf_use_struct_tree: formData.pdf_use_struct_tree,
          pdf_include_header_footer: formData.pdf_include_header_footer,
          pdf_detect_strikethrough: formData.pdf_detect_strikethrough,
          pdf_threads: formData.pdf_threads,
          domain: formData.domain,
          ...(formData.zalo_bot ? { zalo_bot: formData.zalo_bot } : {}),
          ...(formData.zalo_personal ? { zalo_personal: zaloPersonalConfig } : {}),
          ...(formData.telegram ? { telegram: formData.telegram } : {}),
          ...(formData.facebook ? { facebook: formData.facebook } : {})
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

  const handleDeleteDocument = async (docId: string) => {
    if (!id) return;
    
    const confirmed = await confirmAction({
      title: 'Delete Document?',
      text: 'You cannot undo this action.',
      confirmText: 'Delete document',
      tone: 'danger',
    });

    if (confirmed) {
      try {
        await documentsApi.delete(id, docId);
        setDocuments(documents.filter(doc => doc.id !== docId));
        toast.success('Document deleted');
      } catch (error) {
        toast.error('Failed to delete document');
      }
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
      <Layout hideSidebar={embedded} breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Agents', path: '/bots' }, { label: 'Config' }]}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground mt-4 text-sm font-medium">Loading configuration...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar={embedded} breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Agents', path: '/bots' }, { label: bot?.name || 'Config' }]}>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">

        <BotConfigHeader
          bot={bot}
          embedded={embedded}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as TabType)}
          onOpenPlayground={() => navigate(`/bots/${id}/chat`)}
          onBack={() => navigate('/bots')}
        />

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
                <div className="bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8 space-y-6 md:col-span-1 h-fit relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none"></div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-3 relative z-10">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xl">badge</span>
                    </div>
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

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Domain</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['general', 'education', 'legal', 'sales'] as const).map((d) => {
                          const dm = getDomainMeta(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                const useKg = ['education', 'legal'].includes(d);
                                const dm = getDomainMeta(d);
                                setFormData({
                                  ...formData,
                                  domain: d,
                                  enable_knowledge_graph: useKg,
                                  ...(dm.isLocked ? {
                                    temperature: d === 'education' ? 0.3 : d === 'legal' ? 0.1 : 0.5,
                                    max_tokens: d === 'education' ? 3000 : d === 'legal' ? 4000 : 2000,
                                  } : {}),
                                });
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${
                                formData.domain === d
                                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                                  : 'border-border bg-muted/10 text-muted-foreground hover:border-primary/40'
                              }`}
                            >
                              <span className={`material-symbols-outlined text-[16px] ${formData.domain === d ? '' : 'text-muted-foreground/50'}`}>{dm.icon}</span>
                              <span>{dm.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getDomainMeta(formData.domain).chunkingHint} · {getDomainMeta(formData.domain).description.split('.')[0]}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Behavior Column */}
                <div className="bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8 space-y-6 md:col-span-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none"></div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-3 relative z-10">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xl">psychology</span>
                    </div>
                    Behavior Engine
                  </h3>

                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
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

                    {!getDomainMeta(formData.domain).isLocked && (
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
                    )}

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

                    {!getDomainMeta(formData.domain).isLocked && (
                      <div className="p-6 bg-black/20 rounded-2xl border border-white/5 grid sm:grid-cols-2 gap-8 mt-4 relative z-10">
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
                            className="w-full px-4 py-2.5 rounded-xl bg-background border border-white/10 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 border border-primary/50"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && id && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-8 bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Knowledge Base Registry</h3>
                  <p className="text-sm text-muted-foreground mt-1">Manage the documents this agent uses for context.</p>
                </div>
                <div className="text-xs font-semibold text-primary bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 shadow-[inset_0_0_15px_rgba(var(--primary),0.1)]">
                  Supported: PDF, DOCX, PPTX, XLSX, CSV, MD, TXT • Max: 25MB
                </div>
              </div>

              {/* Domain / Chunking Strategy Banner */}
              {bot && (() => {
                const dm = getDomainMeta(bot.config?.domain);
                const chunkHint = bot.config?.chunking_strategy
                  ? `${bot.config.chunking_strategy} chunking · ${bot.config?.chunk_size ?? '—'} tokens`
                  : dm.chunkingHint;
                const isKgDomain = ['education', 'legal'].includes(bot.config?.domain ?? '');
                return (
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm">
                    <span className={`material-symbols-outlined text-[20px] ${dm.iconColor}`}>{dm.icon}</span>
                    <div>
                      <span className="font-semibold">{dm.label} domain</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="font-mono text-muted-foreground">{chunkHint}</span>
                    </div>
                    {!isKgDomain && (
                      <span className="ml-auto text-xs text-muted-foreground italic">
                        KG is most useful for Education and Legal domains
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Upload Settings */}
              <div className="flex items-center gap-3 px-1">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, enable_knowledge_graph: !prev.enable_knowledge_graph }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.enable_knowledge_graph ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  role="switch"
                  aria-checked={formData.enable_knowledge_graph}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.enable_knowledge_graph ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm font-medium text-foreground">Build Knowledge Graph</span>
                <span className="text-xs text-muted-foreground">(cho tài liệu phức tạp, dài — tốn thêm thời gian xử lý)</span>
              </div>

              {/* SmolVLM Picture Description Toggle */}
              <div className="rounded-xl border border-white/10 bg-background/40 backdrop-blur-xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, enrich_picture_description: !prev.enrich_picture_description }))}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.enrich_picture_description ? 'bg-violet-600' : 'bg-muted-foreground/30'}`}
                    role="switch"
                    aria-checked={formData.enrich_picture_description}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.enrich_picture_description ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-500 text-[18px]">image_search</span>
                    Enrich Picture Descriptions
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-500/10 text-violet-500 px-1.5 py-0.5 rounded">SmolVLM</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-12">
                  Dùng AI (SmolVLM) để tự động mô tả hình ảnh, biểu đồ, sơ đồ trong PDF bằng text — giúp LLM hiểu được nội dung ảnh.
                  <strong className="text-foreground"> Phù hợp:</strong> tài liệu nhiều biểu đồ, sơ đồ, ảnh minh hoạ (academic papers, báo cáo).
                  <strong className="text-foreground"> Lưu ý:</strong> xử lý chậm hơn (~30-60s thêm mỗi tài liệu) vì cần AI phân tích từng hình ảnh.
                </p>
                <div className="flex items-center gap-3 pl-12 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveBasicSettings}
                    disabled={loading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                  <span className="text-[10px] text-muted-foreground italic">Cần Save trước khi upload để áp dụng</span>
                </div>
	              </div>

              {/* OpenDataLoader PDF Settings */}
              <div className="rounded-xl border border-white/10 bg-background/40 backdrop-blur-xl px-4 py-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">document_scanner</span>
                    <span className="text-sm font-semibold text-foreground">PDF Parsing</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveBasicSettings}
                    disabled={loading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Parser Mode</span>
                    <select
                      value={formData.pdf_parser_mode}
                      onChange={(e) => setFormData(prev => ({ ...prev, pdf_parser_mode: e.target.value as PDFParserMode }))}
                      className="w-full h-10 px-3 rounded-lg bg-background border border-white/10 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="local_fast">Local Fast</option>
                      <option value="hybrid_auto">Hybrid Auto</option>
                      <option value="hybrid_full">Hybrid Full</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Threads</span>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={formData.pdf_threads}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        pdf_threads: Math.max(1, Math.min(16, parseInt(e.target.value || '1', 10))),
                      }))}
                      className="w-full h-10 px-3 rounded-lg bg-background border border-white/10 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3 px-3 h-10 mt-5 rounded-lg border border-white/10 bg-muted/10">
                    <span className="text-xs font-medium text-foreground">Structured Chunks</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, pdf_structured_chunking: !prev.pdf_structured_chunking }))}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.pdf_structured_chunking ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      role="switch"
                      aria-checked={formData.pdf_structured_chunking}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.pdf_structured_chunking ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {([
                    ['pdf_enrich_formula', 'function', 'Formula Enrichment'],
                    ['pdf_sanitize', 'policy', 'Sanitize Text'],
                    ['pdf_use_struct_tree', 'account_tree', 'Use Structure Tree'],
                    ['pdf_include_header_footer', 'vertical_align_center', 'Header/Footer'],
                    ['pdf_detect_strikethrough', 'strikethrough_s', 'Strikethrough'],
                  ] as const).map(([key, icon, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${formData[key] ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-white/10 bg-muted/10 text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[17px]">{icon}</span>
                        <span className="text-xs font-medium truncate">{label}</span>
                      </span>
                      <span className={`h-2 w-2 rounded-full ${formData[key] ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Zone */}
              <label className={`group relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed transition-all py-12 overflow-hidden ${isLocked ? 'border-primary/50 bg-primary/5 cursor-wait' : 'border-border hover:border-primary/50 bg-muted/10 hover:bg-muted/30 cursor-pointer'}`}>
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={handleUpload}
                  accept=".pdf,.txt,.md,.csv,.docx,.pptx,.xlsx"
                  disabled={isLocked}
                />

                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTEgMWgyMHYyMEgxVjF6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMTI4LDEyOCwxMjgsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-50"></div>

                <div className="flex flex-col items-center gap-4 text-center pointer-events-none z-10 w-full">
                  {uploading ? (
                    // Uploading/Scanning SVG
                    <div className="relative size-16">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                          <filter id="scanGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                          <linearGradient id="docGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" className="text-primary" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" className="text-primary" />
                          </linearGradient>
                        </defs>
                        {/* Document Base */}
                        <path d="M30 20 h30 l20 20 v40 h-50 z" fill="url(#docGrad)" stroke="currentColor" strokeWidth="2" className="text-primary/60" />
                        <path d="M60 20 v20 h20" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/60" />
                        {/* Lines */}
                        <line x1="40" y1="45" x2="70" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
                        <line x1="40" y1="55" x2="65" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
                        <line x1="40" y1="65" x2="70" y2="65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />

                        {/* Laser Scanner */}
                        <g filter="url(#scanGlow)">
                          <line x1="20" y1="20" x2="90" y2="20" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round">
                            <animate attributeName="y1" values="20; 80; 20" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="y2" values="20; 80; 20" dur="2s" repeatCount="indefinite" />
                          </line>
                          <polygon points="20,20 90,20 85,35 25,35" fill="#06b6d4" opacity="0.2">
                            <animate attributeName="points" values="20,20 90,20 85,35 25,35; 20,80 90,80 85,95 25,95; 20,20 90,20 85,35 25,35" dur="2s" repeatCount="indefinite" />
                          </polygon>
                        </g>

                        {/* Upload Particles */}
                        <circle cx="50" cy="85" r="2" fill="#8b5cf6">
                          <animate attributeName="cy" values="85; 10" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="1; 0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="35" cy="80" r="1.5" fill="#3b82f6">
                          <animate attributeName="cy" values="80; 20" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="1; 0" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="65" cy="85" r="2.5" fill="#06b6d4">
                          <animate attributeName="cy" values="85; 15" dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="1; 0" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                      </svg>
                    </div>
                  ) : (
                    // Idle Upload SVG
                    <div className="relative size-16 group-hover:-translate-y-2 transition-transform duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full text-primary">
                        <defs>
                          <filter id="idleGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Cloud Base */}
                        <path d="M25 60 a15 15 0 0 1 0 -30 a20 20 0 0 1 35 -10 a18 18 0 0 1 25 10 a15 15 0 0 1 0 30 z"
                          fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
                          className="group-hover:stroke-primary group-hover:fill-primary/20 transition-colors duration-300" />

                        {/* Floating Arrow */}
                        <g className="group-hover:animate-bounce" style={{ transformOrigin: 'center' }}>
                          <path d="M50 70 v-30 m-12 12 l12 -12 l12 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#idleGlow)" />
                        </g>

                        {/* Orbiting Plus (Group hover) */}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite" />
                          <circle cx="15" cy="50" r="3" fill="#8b5cf6" />
                          <circle cx="85" cy="50" r="2" fill="#06b6d4" />
                          <circle cx="50" cy="15" r="2.5" fill="#f43f5e" />
                        </g>
                      </svg>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mt-2">
                    <p className={`text-base font-bold ${uploading ? 'text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-400 animate-pulse' : 'text-foreground group-hover:text-primary transition-colors'}`}>
                      {uploading ? 'Vectorizing and Indexing...' : 'Drag & drop knowledge files'}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {uploading ? 'Please wait, do not close this window.' : 'or click to browse from your computer'}
                    </p>
                  </div>
                </div>
              </label>

              {/* Inline Upload Status Panel */}
              {uploadStatus && (
                <div className="rounded-2xl border border-white/10 bg-background/40 backdrop-blur-xl px-6 py-4 space-y-3 text-sm">

                  {/* --- UPLOADING --- */}
                  {uploadStatus.phase === 'uploading' && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground">Uploading "{uploadStatus.filename}"...</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Elapsed: {formatElapsed(uploadStatus.elapsedSeconds)}</p>
                        </div>
                        <button type="button" onClick={handleCancelUpload}
                          className="flex-shrink-0 text-xs font-semibold text-destructive border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 rounded-full transition-colors">
                          Huy upload
                        </button>
                      </div>
                      <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse w-3/5" />
                      </div>
                    </>
                  )}

                  {/* --- PROCESSING (Celery task running) --- */}
                  {uploadStatus.phase === 'processing' && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">Processing "{uploadStatus.filename}"</span>
                        <span className="text-xs text-muted-foreground font-mono">Elapsed: {formatElapsed(uploadStatus.elapsedSeconds)}</span>
                      </div>
                      <div className="space-y-1.5">
                        {PROCESSING_STEPS.map((step, i) => {
                          const activeStep = Math.min(Math.floor(uploadStatus.elapsedSeconds / 5), PROCESSING_STEPS.length - 1);
                          const isDone = i < activeStep;
                          const isActive = i === activeStep;
                          return (
                            <div key={i} className={`flex items-center gap-2.5 text-xs ${isActive ? 'text-foreground' : isDone ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-primary animate-pulse' : isDone ? 'bg-primary/40' : 'bg-muted/30'}`} />
                              <span>{step}</span>
                              {isActive && <span className="text-primary/70 ml-1">running...</span>}
                              {isDone && <span className="text-muted-foreground/50 ml-1">done</span>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(90, (uploadStatus.elapsedSeconds / (PROCESSING_STEPS.length * 5)) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">Estimated: 10 to 60 seconds depending on file size</p>
                    </>
                  )}

                  {/* --- KG PROCESSING --- */}
                  {uploadStatus.phase === 'kg_processing' && (
                    <>
                      <p className="font-medium text-primary">Document vectorized — ban co the chat ngay bay gio.</p>
                      <div className="border-t border-white/5 pt-3 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-foreground">Building Knowledge Graph</span>
                          <span className="text-xs text-muted-foreground font-mono">Elapsed: {formatElapsed(uploadStatus.kgElapsedSeconds)}</span>
                        </div>
                        {KG_STEPS.map((step, i) => {
                          const active = getKgActiveStep(uploadStatus.kgElapsedSeconds);
                          const isDone = i < active;
                          const isActive = i === active;
                          return (
                            <div key={i} className={`flex items-center gap-2.5 text-xs ${isActive ? 'text-foreground' : isDone ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-primary animate-pulse' : isDone ? 'bg-primary/40' : 'bg-muted/30'}`} />
                              <span>{step}</span>
                              {isActive && <span className="text-primary/70 ml-1">running...</span>}
                              {isDone && <span className="text-muted-foreground/50 ml-1">done</span>}
                            </div>
                          );
                        })}
                        <p className="text-xs text-muted-foreground pt-1">Estimated total: 2 to 5 minutes</p>
                      </div>
                    </>
                  )}

                  {/* --- DONE (no KG) --- */}
                  {uploadStatus.phase === 'done' && (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-400 text-xl flex-shrink-0">check_circle</span>
                        <div>
                          <p className="font-semibold text-foreground">"{uploadStatus.filename}" indexed and ready.</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Completed in {formatElapsed(uploadStatus.elapsedSeconds)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => navigate(`/bots/${id}/chat`)}
                          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5">
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                          Start Chatting
                        </button>
                        <button type="button" onClick={dismissUploadStatus}
                          className="text-xs text-muted-foreground hover:text-foreground border border-white/10 px-3 py-1.5 rounded-full transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* --- KG DONE --- */}
                  {uploadStatus.phase === 'kg_done' && (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-violet-400 text-xl flex-shrink-0">account_tree</span>
                        <div>
                          <p className="font-semibold text-foreground">"{uploadStatus.filename}" indexed + knowledge graph built.</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Completed in {formatElapsed(uploadStatus.kgElapsedSeconds)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => navigate(`/bots/${id}/chat`)}
                          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5">
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                          Start Chatting
                        </button>
                        <button type="button" onClick={dismissUploadStatus}
                          className="text-xs text-muted-foreground hover:text-foreground border border-white/10 px-3 py-1.5 rounded-full transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* --- CANCELLED --- */}
                  {uploadStatus.phase === 'cancelled' && (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-muted-foreground">Upload cancelled.</p>
                      <button type="button" onClick={dismissUploadStatus}
                        className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground border border-white/10 px-3 py-1.5 rounded-full transition-colors">
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* --- FAILED --- */}
                  {uploadStatus.phase === 'failed' && (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-destructive">{uploadStatus.errorMsg || 'Upload failed.'}</p>
                      <button type="button" onClick={dismissUploadStatus}
                        className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground border border-white/10 px-3 py-1.5 rounded-full transition-colors">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Documents Table */}
              <div className="bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="px-8 py-5 border-b border-white/5 bg-black/20 flex justify-between items-center">
                  <h4 className="text-base font-bold text-foreground">Indexed Documents</h4>
                  <span className="bg-background/50 backdrop-blur-md text-xs font-semibold px-3 py-1 rounded-lg border border-white/10 shadow-inner">{documents.length} files</span>
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
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
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

              {/* Conversation Memory Section */}
              <div className="bg-background/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="px-8 py-5 border-b border-white/5 bg-black/20 flex justify-between items-center">
                  <div>
                    <h4 className="text-base font-bold text-foreground">Conversation Memory</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">What the bot has learned and remembered from your conversations</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!memoryEnabled && (
                      <span className="text-xs text-muted-foreground bg-muted/20 px-3 py-1 rounded-lg border border-white/5">Memory disabled</span>
                    )}
                    <span className="bg-background/50 backdrop-blur-md text-xs font-semibold px-3 py-1 rounded-lg border border-white/10 shadow-inner">
                      {memories.length} memories
                    </span>
                    <button
                      type="button"
                      onClick={() => id && loadMemories(id)}
                      disabled={memoriesLoading}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {memoriesLoading ? 'Loading...' : 'Refresh'}
                    </button>
                    {memories.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearMemories}
                        className="text-xs font-semibold text-destructive border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {memoriesLoading ? (
                    <div className="px-8 py-6 space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-4 bg-muted/20 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                      ))}
                    </div>
                  ) : memories.length === 0 ? (
                    <div className="px-8 py-10 text-center">
                      <p className="text-sm text-muted-foreground">No memories saved yet.</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Memories are created automatically after conversations.</p>
                    </div>
                  ) : (
                    memories.map((mem: any, i: number) => (
                      <div key={mem.id || i} className="px-8 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">{mem.memory || mem.text || JSON.stringify(mem)}</p>
                          {mem.created_at && (
                            <p className="text-xs text-muted-foreground/50 mt-1">
                              {new Date(mem.created_at).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-6">

              {/* ═══ TELEGRAM BOT ═══ */}
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl bg-[#24A1DE]/10 flex items-center justify-center text-[#24A1DE]">
                      <span className="material-symbols-outlined text-3xl">send</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Telegram Bot</h3>
                      <p className="text-sm text-muted-foreground">Connect your Telegram Bot to this AI agent — instant auto-reply.</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${formData.telegram?.is_active
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                    <span className={`size-2 rounded-full ${formData.telegram?.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`}></span>
                    {formData.telegram?.is_active ? 'CONNECTED' : 'NOT CONNECTED'}
                  </div>
                </div>

                {/* Connected State */}
                {formData.telegram?.bot_token ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-300">check_circle</span>
                        <div>
                          <p className="text-sm font-bold text-emerald-200">Telegram Bot Connected</p>
                          <p className="text-xs text-emerald-300/80 mt-0.5">
                            Bot: {formData.telegram.bot_username || formData.telegram.bot_info?.username || formData.telegram.bot_info?.first_name || '(unknown)'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Webhook URL */}
                    {formData.telegram.webhook_url && (
                      <div className="p-4 bg-muted/30 border border-border rounded-xl">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Webhook URL</label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="flex-1 px-3 py-2 bg-muted/50 rounded-lg text-xs font-mono text-foreground break-all">
                            {formData.telegram.webhook_url}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(formData.telegram.webhook_url);
                              toast.success('Webhook URL copied!');
                            }}
                            className="px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active toggle + Disconnect */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-bold text-foreground">AI Auto-Reply</p>
                        <p className="text-xs text-muted-foreground">Bot will automatically reply to incoming Telegram messages.</p>
                      </div>
                      <button
                        onClick={() => {
                          setFormData({
                            ...formData,
                            telegram: { ...formData.telegram, is_active: !formData.telegram?.is_active }
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.telegram?.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.telegram?.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveBasicSettings}
                        className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
                      >
                        Save Settings
                      </button>
                      <button
                        onClick={async () => {
                          if (!id) return;
                          const confirmed = await confirmAction({
                            title: 'Disconnect Telegram Bot?',
                            text: 'Your bot will stop responding on Telegram.',
                            confirmText: 'Disconnect',
                            tone: 'danger',
                          });
                          if (!confirmed) return;
                          try {
                            await apiClient.post(`/api/v1/channels/telegram/disconnect/${id}`);
                            setFormData({ ...formData, telegram: null });
                            toast.success('Telegram Bot disconnected');
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || 'Failed to disconnect');
                          }
                        }}
                        className="px-6 py-3 bg-red-500/10 text-red-600 font-semibold rounded-xl hover:bg-red-500/20 transition-all border border-red-200"
                      >
                        <span className="material-symbols-outlined text-sm mr-1">link_off</span>
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Connected State — Connect Form */
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Bot Token</label>
                        <input
                          type="password"
                          placeholder="e.g. 1234567890:ABCdefGHIJklmNOPqrstUVwxyz"
                          value={telegramBotToken}
                          onChange={(e) => setTelegramBotToken(e.target.value)}
                          className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground pl-1">Get this from <strong>@BotFather</strong> on Telegram when you create a bot.</p>
                      </div>

                      <button
                        onClick={async () => {
                          if (!id || !telegramBotToken.trim()) {
                            toast.error('Please enter your Bot Token');
                            return;
                          }
                          setTelegramConnecting(true);
                          const connectToast = toast.loading('Connecting Telegram Bot...');
                          try {
                            const res = await apiClient.post('/api/v1/channels/telegram/connect', {
                              bot_id: id,
                              bot_token: telegramBotToken.trim(),
                            });
                            if (id) await loadBot(id);
                            setTelegramBotToken('');
                            toast.success('Telegram Bot connected successfully!', { id: connectToast });
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || 'Connection failed', { id: connectToast });
                          } finally {
                            setTelegramConnecting(false);
                          }
                        }}
                        disabled={telegramConnecting || !telegramBotToken.trim()}
                        className="w-full px-6 py-3 bg-[#24A1DE] text-white font-bold rounded-xl hover:bg-[#24A1DE]/90 transition-all shadow-lg shadow-[#24A1DE]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {telegramConnecting ? (
                          <><span className="animate-spin">⏳</span> Connecting...</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">link</span> Connect Telegram Bot</>
                        )}
                      </button>
                    </div>

                    {/* Quick Guide */}
                    <div className="bg-muted/10 rounded-2xl p-5 border border-border">
                      <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">rocket_launch</span>
                        Quick Setup (30 seconds)
                      </h4>
                      <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">1</span>
                          <p>Open <strong>@BotFather</strong> on Telegram and send <code>/newbot</code> to create a bot.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">2</span>
                          <p>Copy the <strong>Bot Token</strong> that @BotFather gives you.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">3</span>
                          <p>Paste the token above and click <strong>Connect</strong> — we'll auto-configure the webhook. Done!</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-[10px] text-primary-700 font-medium">
                          <strong>How it works:</strong> We call <code>getMe</code> + <code>setWebhook</code> on the Telegram Bot API automatically. Your bot will start responding to Telegram messages instantly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ ZALO BOT (New — Direct Integration) ═══ */}
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <span className="material-symbols-outlined text-3xl">smart_toy</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Zalo Bot</h3>
                      <p className="text-sm text-muted-foreground">Connect your Zalo Bot to this AI agent — instant auto-reply.</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${formData.zalo_bot?.is_active
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                    <span className={`size-2 rounded-full ${formData.zalo_bot?.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`}></span>
                    {formData.zalo_bot?.is_active ? 'CONNECTED' : 'NOT CONNECTED'}
                  </div>
                </div>

                {/* Connected State */}
                {formData.zalo_bot?.bot_token ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-300">check_circle</span>
                        <div>
                          <p className="text-sm font-bold text-emerald-200">Zalo Bot Connected</p>
                          <p className="text-xs text-emerald-300/80 mt-0.5">
                            Bot Info: {JSON.stringify(formData.zalo_bot.bot_info?.result || formData.zalo_bot.bot_info || {})}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Webhook URL */}
                    {formData.zalo_bot.webhook_url && (
                      <div className="p-4 bg-muted/30 border border-border rounded-xl">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Webhook URL</label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="flex-1 px-3 py-2 bg-muted/50 rounded-lg text-xs font-mono text-foreground break-all">
                            {formData.zalo_bot.webhook_url}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(formData.zalo_bot.webhook_url);
                              toast.success('Webhook URL copied!');
                            }}
                            className="px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active toggle + Disconnect */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-bold text-foreground">AI Auto-Reply</p>
                        <p className="text-xs text-muted-foreground">Bot will automatically reply to incoming Zalo messages.</p>
                      </div>
                      <button
                        onClick={() => {
                          setFormData({
                            ...formData,
                            zalo_bot: { ...formData.zalo_bot, is_active: !formData.zalo_bot?.is_active }
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.zalo_bot?.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.zalo_bot?.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveBasicSettings}
                        className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
                      >
                        Save Settings
                      </button>
                      <button
                        onClick={async () => {
                          if (!id) return;
                          const confirmed = await confirmAction({
                            title: 'Disconnect Zalo Bot?',
                            text: 'Your bot will stop responding on Zalo.',
                            confirmText: 'Disconnect',
                            tone: 'danger',
                          });
                          if (!confirmed) return;
                          try {
                            await apiClient.post(`/api/v1/channels/zalo-bot/disconnect/${id}`);
                            setFormData({ ...formData, zalo_bot: null });
                            toast.success('Zalo Bot disconnected');
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || 'Failed to disconnect');
                          }
                        }}
                        className="px-6 py-3 bg-red-500/10 text-red-600 font-semibold rounded-xl hover:bg-red-500/20 transition-all border border-red-200"
                      >
                        <span className="material-symbols-outlined text-sm mr-1">link_off</span>
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Connected State — Connect Form */
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Zalo Bot Token</label>
                        <input
                          type="password"
                          placeholder="e.g. 4045714827:FrVAleoZATgg..."
                          value={zaloBotToken}
                          onChange={(e) => setZaloBotToken(e.target.value)}
                          className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground pl-1">Get this from Zalo Bot Platform when you create a bot.</p>
                      </div>

                      <button
                        onClick={async () => {
                          if (!id || !zaloBotToken.trim()) {
                            toast.error('Please enter your Zalo Bot Token');
                            return;
                          }
                          setZaloBotConnecting(true);
                          const connectToast = toast.loading('Connecting Zalo Bot...');
                          try {
                            const res = await apiClient.post('/api/v1/channels/zalo-bot/connect', {
                              bot_id: id,
                              bot_token: zaloBotToken.trim(),
                            });
                            // Reload bot to get updated config
                            if (id) await loadBot(id);
                            setZaloBotToken('');
                            toast.success('Zalo Bot connected successfully!', { id: connectToast });
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || 'Connection failed', { id: connectToast });
                          } finally {
                            setZaloBotConnecting(false);
                          }
                        }}
                        disabled={zaloBotConnecting || !zaloBotToken.trim()}
                        className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {zaloBotConnecting ? (
                          <><span className="animate-spin">⏳</span> Connecting...</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">link</span> Connect Zalo Bot</>
                        )}
                      </button>
                    </div>

                    {/* Quick Guide */}
                    <div className="bg-muted/10 rounded-2xl p-5 border border-border">
                      <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">rocket_launch</span>
                        Quick Setup (30 seconds)
                      </h4>
                      <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">1</span>
                          <p>Create a Zalo Bot on the <strong>Zalo Bot Platform</strong> and copy your <strong>Bot Token</strong>.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">2</span>
                          <p>Paste the <strong>Bot Token</strong> and your <strong>Backend URL</strong> above.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">3</span>
                          <p>Click <strong>Connect</strong> — we'll auto-configure the webhook. Done! ✅</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-[10px] text-primary-700 font-medium">
                          <strong>How it works:</strong> We call <code>setWebhook</code> + <code>getMe</code> on the Zalo Bot API automatically. Your bot will start responding to Zalo messages instantly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ ZALO PERSONAL (Multi-Account) ═══ */}
              {zaloPersonalEnabled && (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600">
                        <span className="material-symbols-outlined text-3xl">account_circle</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-foreground">Zalo Personal</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Connect multiple personal Zalo accounts for DMs and mention-only group replies.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <span className="material-symbols-outlined text-2xl text-muted-foreground">manage_accounts</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Manage your Zalo Personal accounts</p>
                      <p className="text-xs text-muted-foreground">Add multiple accounts, view status, control access permissions.</p>
                    </div>
                    <Link
                      to={`/bots/${id}/zalo-accounts`}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      Manage Accounts
                    </Link>
                  </div>
                </div>
              )}

              {/* ═══ FACEBOOK MESSENGER (via fb-channel-worker, GPL v3 isolated) ═══ */}
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-xl bg-[#0866FF]/10 flex items-center justify-center text-[#0866FF]">
                      <span className="material-symbols-outlined text-3xl">forum</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Facebook Messenger</h3>
                      <p className="text-sm text-muted-foreground">Reply in Messenger group chats. Bot answers only when @mentioned.</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${formData.facebook?.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : formData.facebook?.status === 'expired'
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                    <span className={`size-2 rounded-full ${formData.facebook?.status === 'connected' ? 'bg-emerald-400 animate-pulse' : formData.facebook?.status === 'expired' ? 'bg-red-500' : 'bg-muted-foreground'}`}></span>
                    {formData.facebook?.status === 'connected' ? 'CONNECTED' : formData.facebook?.status === 'expired' ? 'COOKIES EXPIRED' : 'NOT CONNECTED'}
                  </div>
                </div>

                {formData.facebook?.status === 'connected' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-300">check_circle</span>
                        <div>
                          <p className="text-sm font-bold text-emerald-200">Logged in as {formData.facebook.display_name || '(unknown name)'}</p>
                          <p className="text-xs text-emerald-300/80 mt-0.5">UID: <code className="font-mono">{formData.facebook.uid}</code></p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground space-y-1">
                      <p><strong>Reply policy:</strong> mention-only (bot chỉ trả lời khi được @tag trong group)</p>
                      <p><strong>Connected at:</strong> {formData.facebook.connected_at ? new Date(formData.facebook.connected_at).toLocaleString() : '—'}</p>
                      {formData.facebook.last_event_at && <p><strong>Last event:</strong> {new Date(formData.facebook.last_event_at).toLocaleString()}</p>}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          if (!id) return;
                          const confirmed = await confirmAction({
                            title: 'Disconnect Facebook Messenger?',
                            text: 'Bot will stop replying in Messenger groups.',
                            confirmText: 'Disconnect',
                            tone: 'danger',
                          });
                          if (!confirmed) return;
                          try {
                            await apiClient.post(`/api/v1/channels/facebook/disconnect/${id}`);
                            setFormData({ ...formData, facebook: null });
                            toast.success('Facebook Messenger disconnected');
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || 'Failed to disconnect');
                          }
                        }}
                        className="px-6 py-3 bg-red-500/10 text-red-600 font-semibold rounded-xl hover:bg-red-500/20 transition-all border border-red-200"
                      >
                        <span className="material-symbols-outlined text-sm mr-1">link_off</span>
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Facebook Cookies (JSON)</label>
                        <textarea
                          placeholder='Paste JSON exported from Cookie-Editor extension here — supports both {"url":"...","cookies":[...]} and plain [...] formats.'
                          value={fbCookiesText}
                          onChange={(e) => { setFbCookiesText(e.target.value); setFbCookiesError(''); }}
                          rows={6}
                          className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                        />
                        <div
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (!file) return;
                            try { setFbCookiesText(await file.text()); setFbCookiesError(''); }
                            catch { toast.error('Cannot read file'); }
                          }}
                          onClick={() => fbFileInputRef.current?.click()}
                          className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/10 hover:bg-muted/30 transition-colors p-4 text-center"
                        >
                          <p className="text-xs text-muted-foreground">
                            <span className="material-symbols-outlined text-sm align-middle mr-1">upload_file</span>
                            Drag-drop a <code>.json</code> file here or click to browse
                          </p>
                          <input
                            ref={fbFileInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try { setFbCookiesText(await file.text()); setFbCookiesError(''); }
                              catch { toast.error('Cannot read file'); }
                            }}
                          />
                        </div>
                        {fbCookiesError && <p className="text-[11px] text-red-600 pl-1">{fbCookiesError}</p>}
                      </div>

                      <button
                        onClick={async () => {
                          if (!id || !fbCookiesText.trim()) {
                            setFbCookiesError('Please paste cookies JSON first.');
                            return;
                          }
                          let parsed: any;
                          try { parsed = JSON.parse(fbCookiesText.trim()); }
                          catch { setFbCookiesError('Not valid JSON — re-export from Cookie-Editor.'); return; }

                          const cookiesList: any[] = Array.isArray(parsed)
                            ? parsed
                            : (parsed && Array.isArray(parsed.cookies) ? parsed.cookies : []);
                          if (!cookiesList.length) {
                            setFbCookiesError('JSON does not contain a cookies array.');
                            return;
                          }
                          const names = new Set(cookiesList.map((c: any) => c?.name || c?.key));
                          const required = ['c_user', 'xs', 'fr', 'datr', 'sb'];
                          const missing = required.filter((n) => !names.has(n));
                          if (missing.length) {
                            setFbCookiesError(`Missing required cookies: ${missing.join(', ')}. Make sure you exported after logging in.`);
                            return;
                          }

                          setFbConnecting(true);
                          const t = toast.loading('Connecting Facebook Messenger...');
                          try {
                            const res = await apiClient.post('/api/v1/channels/facebook/connect', {
                              bot_id: id,
                              cookies: cookiesList,
                            });
                            if (id) await loadBot(id);
                            setFbCookiesText('');
                            toast.success(`Connected as ${res.data.display_name || res.data.uid}`, { id: t });
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || 'Connection failed', { id: t });
                          } finally {
                            setFbConnecting(false);
                          }
                        }}
                        disabled={fbConnecting || !fbCookiesText.trim()}
                        className="w-full px-6 py-3 bg-[#0866FF] text-white font-bold rounded-xl hover:bg-[#0866FF]/90 transition-all shadow-lg shadow-[#0866FF]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {fbConnecting ? (
                          <><span className="animate-spin">⏳</span> Connecting...</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">link</span> Connect Facebook</>
                        )}
                      </button>
                    </div>

                    <div className="bg-muted/10 rounded-2xl p-5 border border-border">
                      <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">info</span>
                        How to get cookies
                      </h4>
                      <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">1</span>
                          <p>Use a <strong>dummy Facebook account</strong> in a separate browser session (never your main account).</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">2</span>
                          <p>Install <strong>Cookie-Editor</strong> extension and log in to facebook.com.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="size-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">3</span>
                          <p>Click the extension → <strong>Export → JSON</strong> → paste here or drag the file.</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-[10px] text-red-700 font-medium">
                          ⚠️ <strong>Risks:</strong> This uses an unofficial Messenger API. Facebook may ban automated accounts. E2EE limits replies to <strong>group chats</strong> only (no 1-1 DMs). Cookies expire and must be refreshed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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

              {/* Retrieval Tester */}
              {id && (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600">
                      <span className="material-symbols-outlined">find_in_page</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Test Retrieval</h3>
                      <p className="text-sm text-muted-foreground">See exactly which chunks get retrieved for any query — before your users ask.</p>
                    </div>
                  </div>
                  <div className="h-[480px]">
                    <RetrievalTester botId={id} />
                  </div>
                </div>
              )}

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
