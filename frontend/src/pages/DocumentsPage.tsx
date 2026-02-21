import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { documentsApi } from '../api/documents';
import { botsApi } from '../api/bots';
import type { Document } from '../types/api';
import type { Bot } from '../types/api';
import { Button } from '../components/ui/Button';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [loadingBots, setLoadingBots] = useState(true);

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      loadDocuments(selectedBotId);
    }
  }, [selectedBotId]);

  const loadBots = async () => {
    try {
      const data = await botsApi.list();
      setBots(data);
      const storedBotId = localStorage.getItem('selected_bot_id');
      const defaultBotId = storedBotId && data.some(bot => bot.id === storedBotId)
        ? storedBotId
        : data[0]?.id || '';
      setSelectedBotId(defaultBotId);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setLoadingBots(false);
    }
  };

  const loadDocuments = async (botId: string) => {
    try {
      setLoading(true);
      const data = await documentsApi.list(botId);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedBotId) {
      alert('Please select a bot first');
      return;
    }

    setUploading(true);
    try {
      // Small artificial delay to show off the fancy SVG upload animation 
      // and give Celery backend a moment to start the processing loop
      const uploadPromise = documentsApi.upload(selectedBotId, file);
      const delayPromise = new Promise(resolve => setTimeout(resolve, 2500));

      await Promise.all([uploadPromise, delayPromise]);

      await loadDocuments(selectedBotId);

      // Force reset input value so the same file could be uploaded again
      e.target.value = '';
    } catch (error) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    if (!selectedBotId) return;
    try {
      await documentsApi.delete(selectedBotId, id);
      setDocuments(documents.filter(doc => doc.id !== id));
    } catch (error) {
      alert('Delete failed');
    }
  };

  const handleBotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const botId = e.target.value;
    setSelectedBotId(botId);
    localStorage.setItem('selected_bot_id', botId);
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Knowledge Base' }]}>
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text-main dark:text-white">Knowledge Base</h1>
              <p className="text-text-muted dark:text-gray-400 mt-1">Upload documents to train your RAG model</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px]">
                <select
                  className="w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm text-text-main dark:text-white"
                  value={selectedBotId}
                  onChange={handleBotChange}
                  disabled={loadingBots || bots.length === 0}
                >
                  {loadingBots ? (
                    <option value="">Loading bots...</option>
                  ) : bots.length === 0 ? (
                    <option value="">No bots available</option>
                  ) : (
                    bots.map((bot) => (
                      <option key={bot.id} value={bot.id}>{bot.name}</option>
                    ))
                  )}
                </select>
              </div>
              <label>
                <Button variant="primary" isLoading={uploading} disabled={!selectedBotId}>
                  <span className="material-symbols-outlined text-[20px] mr-2">add</span>
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
                <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.txt" />
              </label>
            </div>
          </div>

          {/* Upload Zone */}
          <div className={`group relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-all overflow-hidden py-14 px-4 mb-10 ${selectedBotId ? (uploading ? 'border-primary/50 bg-primary/5' : 'border-border-light dark:border-border-dark hover:border-primary/50 hover:bg-primary/5 cursor-pointer') : 'border-border-light dark:border-border-dark opacity-60 cursor-not-allowed bg-surface-light dark:bg-surface-dark'}`}>
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" onChange={handleUpload} accept=".pdf,.txt" disabled={!selectedBotId || uploading} />

            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTEgMWgyMHYyMEgxVjF6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMTI4LDEyOCwxMjgsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-50 pointer-events-none"></div>

            <div className="flex flex-col items-center gap-5 text-center pointer-events-none z-10 w-full max-w-md mx-auto">
              {uploading ? (
                // Uploading/Scanning SVG
                <div className="relative size-20">
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
                    <path d="M30 20 h30 l20 20 v40 h-50 z" fill="url(#docGrad)" stroke="currentColor" strokeWidth="2" className="text-primary/60" />
                    <path d="M60 20 v20 h20" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/60" />
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
                <div className={`relative size-20 transition-transform duration-300 ${selectedBotId ? 'group-hover:-translate-y-2' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={`w-full h-full transition-colors ${selectedBotId ? 'text-text-muted dark:text-gray-400 group-hover:text-primary' : 'text-text-muted/50 dark:text-gray-600'}`}>
                    <defs>
                      <filter id="idleGlow2" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    <path d="M25 60 a15 15 0 0 1 0 -30 a20 20 0 0 1 35 -10 a18 18 0 0 1 25 10 a15 15 0 0 1 0 30 z"
                      fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
                      className="group-hover:stroke-primary group-hover:fill-primary/20 transition-colors duration-300" />
                    <g className={selectedBotId ? "group-hover:animate-bounce" : ""} style={{ transformOrigin: 'center' }}>
                      <path d="M50 70 v-30 m-12 12 l12 -12 l12 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={selectedBotId ? "url(#idleGlow2)" : ""} />
                    </g>

                    {/* Orbiting particles (group hover) */}
                    <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite" />
                      <circle cx="15" cy="50" r="3" fill="#8b5cf6" />
                      <circle cx="85" cy="50" r="2" fill="#06b6d4" />
                      <circle cx="50" cy="15" r="2.5" fill="#f43f5e" />
                    </g>
                  </svg>
                </div>
              )}

              <div className="flex flex-col gap-1.5 w-full">
                <p className={`text-xl font-bold ${uploading ? 'text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 animate-pulse' : 'text-text-main dark:text-white group-hover:text-primary transition-colors'}`}>
                  {uploading ? 'Crunching and Extracting Knowledge...' : 'Drag and drop your files here'}
                </p>
                <p className="text-sm font-medium text-text-muted dark:text-gray-400">
                  {selectedBotId ? (uploading ? 'Please wait while we vectorize the contents' : 'or click to browse from your computer (max 25MB)') : 'Select a bot to enable uploads'}
                </p>
              </div>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400 font-semibold">
                <tr>
                  <th className="px-6 py-4 w-[40%]">Name</th>
                  <th className="px-6 py-4 w-[20%]">Status</th>
                  <th className="px-6 py-4 w-[15%]">Size</th>
                  <th className="px-6 py-4 w-[15%]">Uploaded</th>
                  <th className="px-6 py-4 w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted dark:text-gray-400">
                      No documents uploaded yet
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="group hover:bg-background-light dark:hover:bg-surface-dark transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-text-main dark:text-white">{doc.filename}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${doc.status === 'completed' || doc.status === 'ready'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : doc.status === 'processing'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-gray-400 tabular-nums font-mono text-xs">
                        {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-gray-400 tabular-nums">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded hover:bg-background-off dark:hover:bg-surface-dark text-text-muted hover:text-red-600 transition-colors"
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
      </div>
    </Layout>
  );
}
