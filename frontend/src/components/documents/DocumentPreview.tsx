import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { documentsApi } from '../../api/documents';
import type { Document } from '../../types/api';

interface DocumentPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    document: Document | null;
    botId: string;
}

export default function DocumentPreview({ isOpen, onClose, document, botId }: DocumentPreviewProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [contentType, setContentType] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && document && botId) {
            loadPreview();
        } else {
            // Reset state on close
            setPreviewUrl(null);
            setContentType(null);
            setTextContent(null);
            setError(null);
        }
    }, [isOpen, document, botId]);

    const loadPreview = async () => {
        if (!document) return;

        setLoading(true);
        setError(null);

        try {
            const data = await documentsApi.getPreviewUrl(botId, document.id);
            setPreviewUrl(data.url);
            setContentType(data.content_type);

            // If it's a text file or code, try to fetch the content to display nicely in a <pre>
            // instead of an iframe which might trigger download for some text types
            const isText = data.content_type.startsWith('text/') ||
                data.content_type === 'application/json' ||
                data.content_type === 'application/javascript' ||
                data.filename.endsWith('.md') ||
                data.filename.endsWith('.txt') ||
                data.filename.endsWith('.py');

            if (isText) {
                try {
                    const textResponse = await fetch(data.url);
                    if (textResponse.ok) {
                        const text = await textResponse.text();
                        setTextContent(text);
                    }
                } catch (err) {
                    console.warn("Failed to fetch text content directly, falling back to URL", err);
                }
            }

        } catch (err) {
            console.error('Failed to load preview url', err);
            setError('Failed to load document preview. The file might have been deleted or moved.');
        } finally {
            setLoading(false);
        }
    };

    const isPdf = contentType === 'application/pdf';
    const isImage = contentType?.startsWith('image/');

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/80 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-background text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl h-[85vh] flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">visibility</span>
                                        <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-foreground">
                                            {document?.filename}
                                        </Dialog.Title>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-md bg-background text-muted-foreground hover:text-foreground focus:outline-none"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Close</span>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-auto bg-muted/10 relative">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                                                <span className="mt-2 text-sm text-muted-foreground">Loading preview...</span>
                                            </div>
                                        </div>
                                    )}

                                    {error ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                                            <span className="material-symbols-outlined text-4xl mb-2 text-red-400">error</span>
                                            <p>{error}</p>
                                        </div>
                                    ) : !previewUrl ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                            <span>No preview available</span>
                                        </div>
                                    ) : (
                                        <>
                                            {textContent ? (
                                                <div className="p-6">
                                                    <pre className="whitespace-pre-wrap font-mono text-sm bg-card p-4 rounded-lg border border-border overflow-auto shadow-sm text-foreground">
                                                        {textContent}
                                                    </pre>
                                                </div>
                                            ) : isPdf ? (
                                                <iframe
                                                    src={`${previewUrl}#toolbar=0`}
                                                    className="w-full h-full"
                                                    title="PDF Preview"
                                                />
                                            ) : isImage ? (
                                                <div className="flex items-center justify-center h-full p-4">
                                                    <img src={previewUrl} alt={document?.filename} className="max-w-full max-h-full object-contain rounded shadow-lg" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                                    <span className="material-symbols-outlined text-4xl mb-2">download</span>
                                                    <p className="mb-4">This file type cannot be previewed directly.</p>
                                                    <a
                                                        href={previewUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                                    >
                                                        Download File
                                                    </a>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="bg-muted/20 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-border">
                                    <a
                                        href={previewUrl || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 sm:ml-3 sm:w-auto ${!previewUrl ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        Open Original
                                    </a>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-muted sm:mt-0 sm:w-auto"
                                        onClick={onClose}
                                    >
                                        Close
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
