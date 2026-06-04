import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { botsApi } from '../../api/bots';
import { documentsApi } from '../../api/documents';
import type { Bot, Document } from '../../types/api';

type UploadPhase = 'uploading' | 'processing' | 'done' | 'kg_processing' | 'kg_done' | 'failed' | 'cancelled';

export interface UploadStatusState {
  phase: UploadPhase;
  filename: string;
  elapsedSeconds: number;
  kgElapsedSeconds: number;
  docId?: string;
  errorMsg?: string;
}

interface UseBotDocumentUploadOptions {
  botId?: string;
  bot: Bot | null;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  enableKnowledgeGraph: boolean;
  setEnableKnowledgeGraph: (enabled: boolean) => void;
}

export function useBotDocumentUpload({
  botId,
  bot,
  documents,
  setDocuments,
  enableKnowledgeGraph,
  setEnableKnowledgeGraph,
}: UseBotDocumentUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatusState | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kgDocIdRef = useRef('');
  const processingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearUploadTimers = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (kgTimerRef.current) {
      clearInterval(kgTimerRef.current);
      kgTimerRef.current = null;
    }
    if (kgPollRef.current) {
      clearInterval(kgPollRef.current);
      kgPollRef.current = null;
    }
    if (processingPollRef.current) {
      clearInterval(processingPollRef.current);
      processingPollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!botId || documents.length === 0) return;
    const isProcessing = documents.some(doc => doc.status === 'processing' || doc.status === 'pending');
    if (!isProcessing) return;

    const interval = setInterval(() => {
      documentsApi.list(botId).then(docs => setDocuments(docs)).catch(console.error);
    }, 3000);

    return () => clearInterval(interval);
  }, [botId, documents, setDocuments]);

  useEffect(() => {
    return () => {
      uploadAbortControllerRef.current?.abort();
      clearUploadTimers();
    };
  }, [clearUploadTimers]);

  useEffect(() => {
    if (!botId || uploadStatus !== null || documents.length === 0) return;
    const kgProcessingDoc = documents.find(doc => doc.doc_metadata?.kg_status === 'processing');
    if (!kgProcessingDoc || kgPollRef.current) return;

    kgDocIdRef.current = kgProcessingDoc.id;
    const kgStart = Date.now();
    setUploadStatus({
      phase: 'kg_processing',
      filename: kgProcessingDoc.filename,
      elapsedSeconds: 0,
      kgElapsedSeconds: 0,
      docId: kgProcessingDoc.id,
    });

    kgTimerRef.current = setInterval(() => {
      setUploadStatus(prev => prev ? { ...prev, kgElapsedSeconds: Math.floor((Date.now() - kgStart) / 1000) } : prev);
    }, 1000);

    kgPollRef.current = setInterval(async () => {
      try {
        const docs = await documentsApi.list(botId);
        setDocuments(docs);
        const updated = docs.find(d => d.id === kgDocIdRef.current);
        const kgStatus = updated?.doc_metadata?.kg_status;
        if (kgStatus === 'completed') {
          clearUploadTimers();
          setUploadStatus(prev => prev ? { ...prev, phase: 'kg_done', kgElapsedSeconds: Math.floor((Date.now() - kgStart) / 1000) } : prev);
          setEnableKnowledgeGraph(true);
          botsApi.get(botId)
            .then(latest => botsApi.update(botId, { config: { ...latest.config, enable_knowledge_graph: true } }))
            .catch(console.error);
        } else if (kgStatus === 'failed') {
          clearUploadTimers();
          setUploadStatus(prev => prev ? { ...prev, phase: 'failed', errorMsg: 'Knowledge graph build failed.' } : prev);
        }
      } catch {
        // Polling errors are transient; keep the status UI alive.
      }
    }, 4000);
  }, [botId, clearUploadTimers, documents, setDocuments, setEnableKnowledgeGraph, uploadStatus]);

  const handleCancelUpload = useCallback(() => {
    uploadAbortControllerRef.current?.abort();
  }, []);

  const dismissUploadStatus = useCallback(() => {
    setUploadStatus(null);
  }, []);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !botId) return;

    if (uploading) {
      console.log('Upload already in progress, ignoring duplicate submission');
      event.target.value = '';
      return;
    }

    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;
    clearUploadTimers();

    const uploadStart = Date.now();
    setUploading(true);
    setUploadStatus({ phase: 'uploading', filename: file.name, elapsedSeconds: 0, kgElapsedSeconds: 0 });

    elapsedTimerRef.current = setInterval(() => {
      setUploadStatus(prev => prev ? { ...prev, elapsedSeconds: Math.floor((Date.now() - uploadStart) / 1000) } : prev);
    }, 1000);

    try {
      const effectiveStrategy = bot?.config?.chunking_strategy || 'recursive';
      const uploadPromise = documentsApi.upload(botId, file, effectiveStrategy, enableKnowledgeGraph, abortController.signal);
      const delayPromise = new Promise(resolve => setTimeout(resolve, 2500));
      const [doc] = await Promise.all([uploadPromise, delayPromise]);

      event.target.value = '';
      setUploading(false);
      setUploadStatus({
        phase: 'processing',
        filename: file.name,
        elapsedSeconds: Math.floor((Date.now() - uploadStart) / 1000),
        kgElapsedSeconds: 0,
      });

      const uploadedDocId = doc.id;
      processingPollRef.current = setInterval(async () => {
        try {
          const docs = await documentsApi.list(botId);
          setDocuments(docs);
          const updatedDoc = docs.find(d => d.id === uploadedDocId);

          if (updatedDoc?.status === 'completed') {
            clearUploadTimers();

            if (!enableKnowledgeGraph) {
              setUploadStatus({
                phase: 'done',
                filename: file.name,
                elapsedSeconds: Math.floor((Date.now() - uploadStart) / 1000),
                kgElapsedSeconds: 0,
              });
              return;
            }

            kgDocIdRef.current = uploadedDocId;
            const kgStart = Date.now();
            setUploadStatus(prev => prev ? {
              ...prev,
              phase: 'kg_processing',
              docId: uploadedDocId,
              kgElapsedSeconds: 0,
            } : prev);

            kgTimerRef.current = setInterval(() => {
              setUploadStatus(prev => prev ? { ...prev, kgElapsedSeconds: Math.floor((Date.now() - kgStart) / 1000) } : prev);
            }, 1000);

            kgPollRef.current = setInterval(async () => {
              try {
                const docs2 = await documentsApi.list(botId);
                setDocuments(docs2);
                const updated2 = docs2.find(d => d.id === kgDocIdRef.current);
                const kgStatus = updated2?.doc_metadata?.kg_status;
                if (kgStatus === 'completed') {
                  clearUploadTimers();
                  setUploadStatus(prev => prev ? { ...prev, phase: 'kg_done', kgElapsedSeconds: Math.floor((Date.now() - kgStart) / 1000) } : prev);
                } else if (kgStatus === 'failed') {
                  clearUploadTimers();
                  setUploadStatus(prev => prev ? { ...prev, phase: 'failed', errorMsg: 'Knowledge graph build failed.' } : prev);
                }
              } catch {
                // Polling errors are transient; keep polling.
              }
            }, 4000);
          } else if (updatedDoc?.status === 'failed') {
            clearUploadTimers();
            setUploadStatus({ phase: 'failed', filename: file.name, elapsedSeconds: 0, kgElapsedSeconds: 0, errorMsg: `Processing failed: "${file.name}"` });
          }
        } catch {
          // Polling errors are transient; keep polling.
        }
      }, 2000);
    } catch (err: any) {
      clearUploadTimers();
      setUploading(false);
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
        setUploadStatus({ phase: 'cancelled', filename: file.name, elapsedSeconds: 0, kgElapsedSeconds: 0 });
      } else {
        setUploadStatus({ phase: 'failed', filename: file.name, elapsedSeconds: 0, kgElapsedSeconds: 0, errorMsg: `Upload failed: "${file.name}"` });
      }
      uploadAbortControllerRef.current = null;
    } finally {
      event.target.value = '';
    }
  }, [bot, botId, clearUploadTimers, enableKnowledgeGraph, setDocuments, uploading]);

  return {
    dismissUploadStatus,
    handleCancelUpload,
    handleUpload,
    isLocked: uploading,
    uploading,
    uploadStatus,
  };
}
