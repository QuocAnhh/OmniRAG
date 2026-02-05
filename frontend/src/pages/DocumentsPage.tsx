import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { documentsApi } from '../api/documents';
import { botsApi } from '../api/bots';
import type { Document } from '../types/api';
import { Button } from '../components/ui/Button';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeBotAndLoadDocuments();
  }, []);

  const initializeBotAndLoadDocuments = async () => {
    try {
      // Fetch the first available bot
      const bots = await botsApi.list();
      if (bots.length === 0) {
        setError('No bots available. Please create a bot first.');
        setLoading(false);
        return;
      }

      const firstBotId = bots[0].id;
      setBotId(firstBotId);

      // Load documents for this bot
      const data = await documentsApi.list(firstBotId);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!botId) return;
    try {
      const data = await documentsApi.list(botId);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !botId) return;

    setUploading(true);
    try {
      await documentsApi.upload(botId, file);
      loadDocuments();
    } catch (error) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?') || !botId) return;
    try {
      await documentsApi.delete(botId, id);
      setDocuments(documents.filter(doc => doc.id !== id));
    } catch (error) {
      alert('Delete failed');
    }
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Knowledge Base' }]}>
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text-main dark:text-white">Knowledge Base</h1>
              <p className="text-text-muted dark:text-gray-400 mt-1">Upload documents to train your RAG model</p>
            </div>
            {botId && (
              <label>
                <Button variant="primary" isLoading={uploading}>
                  <span className="material-symbols-outlined text-[20px] mr-2">add</span>
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
                <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.docx,.txt" />
              </label>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Upload Zone */}
          {botId && (
            <div className="group relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer py-12 px-4 mb-10">
              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUpload} accept=".pdf,.docx,.txt" />
              <div className="flex flex-col items-center gap-4 text-center pointer-events-none">
                <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-primary group-hover:bg-white dark:group-hover:bg-surface-dark shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-bold text-text-main dark:text-white">Drag and drop your files here</p>
                  <p className="text-sm text-text-muted dark:text-gray-400">or click to browse from your computer (max 25MB)</p>
                </div>
              </div>
            </div>
          )}

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
                    <tr key={doc.id} className="group hover:bg-background-light dark:hover:bg-surface-dark transition-colors" style={{ contentVisibility: 'auto' }}>
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
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${doc.status === 'completed'
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
                          aria-label="Delete document"
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
