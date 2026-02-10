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
      const bots = await botsApi.list();
      if (bots.length === 0) {
        setError('No bots available. Please create a bot first.');
        setLoading(false);
        return;
      }

      const firstBotId = bots[0].id;
      setBotId(firstBotId);

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
      <div className="flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-700 text-xs font-semibold mb-3 border border-accent/20">
              <span className="size-1.5 rounded-full bg-accent-500"></span>
              Library
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage documents and sources for your bots to learn from.
            </p>
          </div>
          {botId && (
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5">
                <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                {uploading ? 'Uploading...' : 'Upload Data'}
              </div>
              <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.docx,.txt" />
            </label>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Docs</p>
            <p className="text-3xl font-bold text-foreground">{documents.length}</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Indexed</p>
            <p className="text-3xl font-bold text-primary">
              {documents.filter(d => d.status === 'completed').length}
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Processing</p>
            <p className="text-3xl font-bold text-accent-500">
              {documents.filter(d => d.status === 'processing').length}
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Size</p>
            <p className="text-3xl font-bold text-foreground/80">
              {(documents.reduce((acc, d) => acc + (d.file_size || 0), 0) / 1024 / 1024).toFixed(1)} <span className="text-sm font-medium text-muted-foreground">MB</span>
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Upload Zone (Empty State) */}
        {botId && documents.length > 0 && (
          <label className="group relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-all cursor-pointer py-12 bg-muted/20 hover:bg-muted/40">
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUpload} accept=".pdf,.docx,.txt" />
            <div className="flex flex-col items-center gap-3 text-center pointer-events-none group-hover:-translate-y-1 transition-transform duration-300">
              <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <span className="material-symbols-outlined text-3xl">cloud_upload</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold text-foreground">Drop files to upload</p>
                <p className="text-sm text-muted-foreground">or click to browse • PDF, DOCX, TXT • Max 25MB</p>
              </div>
            </div>
          </label>
        )}

        {/* Documents Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filename</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Doc ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="inline-block size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      <p className="text-muted-foreground mt-3 text-sm">Loading documents...</p>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-4xl opacity-20">content_paste_off</span>
                        <p>No documents uploaded yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-2xl text-destructive/80">picture_as_pdf</span>
                          <span className="font-medium text-foreground">{doc.filename}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${doc.status === 'completed'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : doc.status === 'processing'
                              ? 'bg-accent/10 text-accent-600 border-accent/20 animate-pulse'
                              : 'bg-destructive/10 text-destructive border-destructive/20'
                          }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                        {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-muted-foreground/60">
                        {doc.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
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
