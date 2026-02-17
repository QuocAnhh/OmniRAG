import { useState, useEffect } from 'react';
import { documentsApi } from '../../api/documents';
import type { Document } from '../../api/documents';
import { foldersApi } from '../../api/folders';
import type { Folder } from '../../api/folders';
import toast from 'react-hot-toast';
import DocumentPreview from './DocumentPreview';

interface DocumentDetailsProps {
    botId: string;
    document: Document;
    onUpdate: (updatedDoc: Document) => void;
    onDelete: (docId: string) => void;
}

export default function DocumentDetails({ botId, document, onUpdate, onDelete }: DocumentDetailsProps) {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [tags, setTags] = useState<string[]>(document.tags || []);
    const [newTag, setNewTag] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string>(document.folder_id || '');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);


    useEffect(() => {
        loadFolders();
    }, [botId]);

    useEffect(() => {
        setTags(document.tags || []);
        setSelectedFolderId(document.folder_id || '');
    }, [document]);

    const loadFolders = async () => {
        try {
            const data = await foldersApi.list(botId);
            setFolders(data);
        } catch (error) {
            console.error('Failed to load folders', error);
        }
    };

    const handleAddTag = async () => {
        if (!newTag.trim()) return;
        if (tags.includes(newTag.trim())) {
            setNewTag('');
            return;
        }

        const updatedTags = [...tags, newTag.trim()];
        try {
            const updatedDoc = await documentsApi.update(botId, document.id, { tags: updatedTags });
            setTags(updatedDoc.tags || []);
            setNewTag('');
            onUpdate(updatedDoc);
            toast.success('Tag added');
        } catch (error) {
            toast.error('Failed to add tag');
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        const updatedTags = tags.filter(t => t !== tagToRemove);
        try {
            const updatedDoc = await documentsApi.update(botId, document.id, { tags: updatedTags });
            setTags(updatedDoc.tags || []);
            onUpdate(updatedDoc);
            toast.success('Tag removed');
        } catch (error) {
            toast.error('Failed to remove tag');
        }
    };

    const handleFolderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newFolderId = e.target.value || null;
        try {
            const updatedDoc = await documentsApi.update(botId, document.id, { folder_id: newFolderId });
            setSelectedFolderId(updatedDoc.folder_id || '');
            onUpdate(updatedDoc);
            toast.success('Folder moved');
        } catch (error) {
            toast.error('Failed to move folder');
        }
    };

    return (
        <div className="h-full flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">info</span>
                Document Details
            </h3>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                {/* File Info */}
                <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">picture_as_pdf</span>
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-bold truncate" title={document.filename}>{document.filename}</div>
                            <div className="text-xs text-muted-foreground">
                                {(document.file_size ? document.file_size / 1024 : 0).toFixed(1)} KB
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status */}
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Status</label>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${document.status === 'completed' ? 'bg-green-100 text-green-700' :
                            document.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                            {document.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Uploaded {new Date(document.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* Folder Selection */}
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Location</label>
                    <select
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        value={selectedFolderId}
                        onChange={handleFolderChange}
                    >
                        <option value="">Root (No Folder)</option>
                        {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>

                {/* Tags */}
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {tags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium group">
                                {tag}
                                <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="hover:text-red-500 opacity-60 hover:opacity-100"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Add a tag..."
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <button
                            onClick={handleAddTag}
                            disabled={!newTag.trim()}
                            className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                </div>

                {/* Metadata */}
                {document.doc_metadata && Object.keys(document.doc_metadata).length > 0 && (
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Metadata</label>
                        <pre className="bg-muted/30 p-3 rounded-lg text-xs overflow-x-auto text-muted-foreground">
                            {JSON.stringify(document.doc_metadata, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-border space-y-2">
                <button
                    onClick={() => setIsPreviewOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                    Preview Content
                </button>

                <button
                    onClick={() => onDelete(document.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Delete Document
                </button>
            </div>

            <DocumentPreview
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                document={document}
                botId={botId}
            />
        </div>
    );
}
