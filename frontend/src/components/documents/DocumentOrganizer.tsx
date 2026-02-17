import { useState, useEffect } from 'react';
import { foldersApi, type Folder } from '../../api/folders';
import { documentsApi } from '../../api/documents';
import type { Document } from '../../api/documents';
import toast from 'react-hot-toast';

import { Skeleton } from '../ui/Skeleton';

interface DocumentOrganizerProps {
    botId: string;
    onSelectDocument: (doc: Document) => void;
    onUploadClick?: () => void;
}

export default function DocumentOrganizer({ botId, onSelectDocument, onUploadClick }: DocumentOrganizerProps) {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Breadcrumbs path calculation
    const breadcrumbs = [];
    let tempId: string | null | undefined = currentFolderId;
    while (tempId) {
        const folder = folders.find(f => f.id === tempId);
        if (folder) {
            breadcrumbs.unshift(folder);
            tempId = folder.parent_id;
        } else {
            break;
        }
    }

    useEffect(() => {
        loadContent();
    }, [botId]); // Reload when bot changes

    const loadContent = async () => {
        setLoading(true);
        try {
            const [fetchedFolders, fetchedDocs] = await Promise.all([
                foldersApi.list(botId),
                documentsApi.list(botId)
            ]);
            setFolders(fetchedFolders);
            setDocuments(fetchedDocs);
        } catch (error) {
            console.error('Failed to load content', error);
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const newFolder = await foldersApi.create(botId, {
                name: newFolderName,
                parent_id: currentFolderId
            });
            setFolders([...folders, newFolder]);
            setNewFolderName('');
            setIsCreatingFolder(false);
            toast.success('Folder created');
        } catch (error) {
            console.error('Failed to create folder', error);
            toast.error('Failed to create folder');
        }
    };

    // Filter view content
    const currentFolders = folders.filter(f => f.parent_id === currentFolderId || (!f.parent_id && !currentFolderId));

    // Logic to filter documents by folder_id needs backend support update first
    // Assuming backend returns all docs, we strictly filter here
    const currentDocuments = documents.filter(d => {
        // Warning: Type 'Document' does not have 'folder_id' in frontend api yet.
        // We will need to update the Document interface in frontend/src/api/documents.ts first
        // For now, let's assume it exists on the object even if typescript complains, 
        // or cast to any.
        return (d as any).folder_id === currentFolderId || (!currentFolderId && !(d as any).folder_id);
    });

    return (
        <div className="border border-border rounded-xl overflow-hidden bg-card h-[600px] flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2 text-sm">
                    <button
                        onClick={() => setCurrentFolderId(null)}
                        className={`flex items-center hover:bg-muted p-1 rounded ${!currentFolderId ? 'font-bold text-primary' : ''}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">home</span>
                        <span className="ml-1">Home</span>
                    </button>
                    {breadcrumbs.map((folder) => (
                        <div key={folder.id} className="flex items-center gap-2">
                            <span className="text-muted-foreground">/</span>
                            <button
                                onClick={() => setCurrentFolderId(folder.id)}
                                className="hover:bg-muted p-1 rounded font-medium"
                            >
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-background border border-border hover:bg-muted rounded-lg text-sm font-medium transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                        New Folder
                    </button>
                    <button
                        onClick={onUploadClick}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                        Upload
                    </button>
                </div>
            </div>

            {/* Create Folder Inline Input */}
            {isCreatingFolder && (
                <div className="px-4 py-3 bg-muted/10 border-b border-border flex gap-2 items-center animate-in slide-in-from-top-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">folder</span>
                    <input
                        autoFocus
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder();
                            if (e.key === 'Escape') setIsCreatingFolder(false);
                        }}
                        className="flex-1 bg-background border border-border rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Folder name..."
                    />
                    <button onClick={handleCreateFolder} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded">Create</button>
                    <button onClick={() => setIsCreatingFolder(false)} className="text-xs bg-muted hover:bg-muted/80 px-3 py-1 rounded">Cancel</button>
                </div>
            )}

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                                <Skeleton className="size-10 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : currentFolders.length === 0 && currentDocuments.length === 0 && !isCreatingFolder ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_open</span>
                        <p>This folder is empty</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {/* Folders */}
                        {currentFolders.map(folder => (
                            <div
                                key={folder.id}
                                onClick={() => setCurrentFolderId(folder.id)}
                                className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all"
                            >
                                <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                    <span className="material-symbols-outlined">folder</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{folder.name}</div>
                                    <div className="text-[10px] text-muted-foreground">Folder</div>
                                </div>
                            </div>
                        ))}

                        {/* Documents */}
                        {currentDocuments.map(doc => (
                            <div
                                key={doc.id}
                                onClick={() => onSelectDocument(doc)}
                                className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all"
                            >
                                <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{doc.filename}</div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <span>{doc.file_size ? (doc.file_size / 1024).toFixed(1) : '0'} KB</span>
                                        <span>•</span>
                                        <span className="capitalize">{doc.status}</span>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded-full transition-opacity">
                                    <span className="material-symbols-outlined text-[16px] text-muted-foreground">more_vert</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
