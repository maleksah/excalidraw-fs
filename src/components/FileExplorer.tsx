import { useState, useRef, useEffect, useCallback } from 'react';
import { useFileSystem } from '../context/FileSystemContext';
import type { FileNode, FileSystemDirectoryHandle } from '../context/FileSystemContext';
import { Folder, FolderOpen, File, FilePlus, FolderPlus, Trash2, ChevronRight, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type InlineAddState = {
    type: 'file' | 'folder';
    parentHandle: FileSystemDirectoryHandle;
    parentId: string; // node id or '__root__'
} | null;

type DragState = {
    node: FileNode;
    parentHandle: FileSystemDirectoryHandle;
} | null;

const InlineInput = ({ type, onSubmit, onCancel, depth }: {
    type: 'file' | 'folder';
    onSubmit: (name: string) => void;
    onCancel: () => void;
    depth: number;
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="tree-node inline-input-row" style={{ paddingLeft: `${depth * 16 + 12}px` }}>
            <span className="tree-node-chevron" />
            <span className={`tree-node-icon ${type === 'folder' ? 'folder' : 'file'}`}>
                {type === 'folder' ? <Folder size={18} /> : <File size={18} />}
            </span>
            <input
                ref={inputRef}
                type="text"
                className="inline-add-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onCancel}
                placeholder={type === 'folder' ? 'Folder name…' : 'File name…'}
            />
        </div>
    );
};

const FileTreeNodeWithParent = ({ node, depth, parentHandle, inlineAdd, setInlineAdd, dragState, setDragState }: {
    node: FileNode;
    depth: number;
    parentHandle: FileSystemDirectoryHandle;
    inlineAdd: InlineAddState;
    setInlineAdd: (state: InlineAddState) => void;
    dragState: DragState;
    setDragState: (state: DragState) => void;
}) => {
    const { selectFile, selectedFile, deleteEntry, createFile, createFolder, moveFile } = useFileSystem();
    const [isOpen, setIsOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const nodeRef = useRef<HTMLDivElement>(null);

    const isSelected = selectedFile?.id === node.id;
    const isDirectory = node.kind === 'directory';
    const isBeingDragged = dragState?.node.id === node.id;
    const hasInlineAdd = inlineAdd && inlineAdd.parentId === node.id;

    // Auto-open folder when inline add targets it
    useEffect(() => {
        if (hasInlineAdd && !isOpen) setIsOpen(true);
    }, [hasInlineAdd]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirectory) {
            setIsOpen(!isOpen);
        } else {
            selectFile(node);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete ${node.name}?`)) {
            try {
                await deleteEntry(parentHandle, node.name);
            } catch {
                alert("Failed to delete");
            }
        }
    };

    const handleAddFileInFolder = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInlineAdd({
            type: 'file',
            parentHandle: node.handle as FileSystemDirectoryHandle,
            parentId: node.id,
        });
    };

    const handleAddFolderInFolder = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInlineAdd({
            type: 'folder',
            parentHandle: node.handle as FileSystemDirectoryHandle,
            parentId: node.id,
        });
    };

    const handleInlineSubmit = async (name: string) => {
        if (!inlineAdd) return;
        try {
            if (inlineAdd.type === 'file') {
                await createFile(inlineAdd.parentHandle, name);
            } else {
                await createFolder(inlineAdd.parentHandle, name);
            }
        } catch {
            // errors logged in context
        }
        setInlineAdd(null);
    };

    // --- Native Drag & Drop (attached via ref to avoid framer-motion conflict) ---
    useEffect(() => {
        const el = nodeRef.current;
        if (!el) return;

        const onDragStart = (e: DragEvent) => {
            if (isDirectory) {
                e.preventDefault();
                return;
            }
            e.stopPropagation();
            setDragState({ node, parentHandle });
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', node.name);
            }
        };

        const onDragOver = (e: DragEvent) => {
            if (!isDirectory || !dragState) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            setIsDragOver(true);
        };

        const onDragLeave = (e: DragEvent) => {
            e.stopPropagation();
            setIsDragOver(false);
        };

        const onDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);

            if (!isDirectory || !dragState) return;

            try {
                const isSame = await dragState.parentHandle.isSameEntry(node.handle);
                if (isSame) return;
            } catch { /* continue */ }

            try {
                await moveFile(
                    dragState.parentHandle,
                    node.handle as FileSystemDirectoryHandle,
                    dragState.node.name
                );
            } catch {
                alert('Failed to move file');
            }
            setDragState(null);
        };

        const onDragEnd = () => {
            setDragState(null);
            setIsDragOver(false);
        };

        if (!isDirectory) {
            el.setAttribute('draggable', 'true');
            el.addEventListener('dragstart', onDragStart);
        }
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('dragleave', onDragLeave);
        el.addEventListener('drop', onDrop);
        el.addEventListener('dragend', onDragEnd);

        return () => {
            el.removeAttribute('draggable');
            el.removeEventListener('dragstart', onDragStart);
            el.removeEventListener('dragover', onDragOver);
            el.removeEventListener('dragleave', onDragLeave);
            el.removeEventListener('drop', onDrop);
            el.removeEventListener('dragend', onDragEnd);
        };
    });

    return (
        <div>
            <div
                ref={nodeRef}
                className={`tree-node${isSelected ? ' selected' : ''}${isDragOver ? ' drag-over' : ''}${isBeingDragged ? ' dragging' : ''}`}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
                onClick={handleClick}
            >
                <span className={`tree-node-chevron${isOpen && isDirectory ? ' open' : ''}`}>
                    {isDirectory && <ChevronRight size={14} strokeWidth={2.5} />}
                </span>

                <span className={`tree-node-icon ${isDirectory ? 'folder' : 'file'}`}>
                    {isDirectory ? <Folder size={18} /> : <File size={18} />}
                </span>

                <span className="tree-node-name">{node.name.replace('.excalidraw', '')}</span>

                <div className="tree-node-actions">
                    {isDirectory && (
                        <>
                            <button onClick={handleAddFileInFolder} className="folder-add-btn" title="New File Here">
                                <FilePlus size={13} />
                            </button>
                            <button onClick={handleAddFolderInFolder} className="folder-add-btn" title="New Folder Here">
                                <FolderPlus size={13} />
                            </button>
                        </>
                    )}
                    <button onClick={handleDelete} className="delete-btn" title="Delete">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {(isOpen || hasInlineAdd) && isDirectory && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="tree-children"
                    >
                        {node.children?.map((child) => (
                            <FileTreeNodeWithParent
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                parentHandle={node.handle as FileSystemDirectoryHandle}
                                inlineAdd={inlineAdd}
                                setInlineAdd={setInlineAdd}
                                dragState={dragState}
                                setDragState={setDragState}
                            />
                        ))}
                        {hasInlineAdd && (
                            <InlineInput
                                type={inlineAdd!.type}
                                depth={depth + 1}
                                onSubmit={handleInlineSubmit}
                                onCancel={() => setInlineAdd(null)}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const FileExplorer = () => {
    const { rootHandle, fileTree, openDirectory, createFile, createFolder, moveFile } = useFileSystem();
    const [inlineAdd, setInlineAdd] = useState<InlineAddState>(null);
    const [dragState, setDragState] = useState<DragState>(null);

    const handleCreateFile = () => {
        if (!rootHandle) return;
        setInlineAdd({ type: 'file', parentHandle: rootHandle, parentId: '__root__' });
    };

    const handleCreateFolder = () => {
        if (!rootHandle) return;
        setInlineAdd({ type: 'folder', parentHandle: rootHandle, parentId: '__root__' });
    };

    const handleRootInlineSubmit = async (name: string) => {
        if (!inlineAdd) return;
        try {
            if (inlineAdd.type === 'file') {
                await createFile(inlineAdd.parentHandle, name);
            } else {
                await createFolder(inlineAdd.parentHandle, name);
            }
        } catch { /* errors logged */ }
        setInlineAdd(null);
    };

    const handleRootDragOver = useCallback((e: React.DragEvent) => {
        if (!dragState) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, [dragState]);

    const handleRootDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        if (!dragState || !rootHandle) return;

        try {
            const isSame = await dragState.parentHandle.isSameEntry(rootHandle);
            if (isSame) {
                setDragState(null);
                return;
            }
        } catch { /* continue */ }

        try {
            await moveFile(dragState.parentHandle, rootHandle, dragState.node.name);
        } catch {
            alert('Failed to move file');
        }
        setDragState(null);
    }, [dragState, rootHandle, moveFile]);

    if (!rootHandle) {
        return (
            <div className="empty-state">
                <div className="empty-icon">
                    <FolderOpen size={36} strokeWidth={1.5} />
                </div>
                <h2 className="empty-title">Open Folder</h2>
                <p className="empty-desc">
                    Select a local directory to start managing your Excalidraw files.
                </p>
                <button onClick={openDirectory} className="open-folder-btn">
                    <FolderOpen size={18} />
                    <span>Choose Directory</span>
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="sidebar-header">
                <div className="sidebar-title-row">
                    <h2 className="sidebar-title">Explorer</h2>
                    <div className="sidebar-actions">
                        <button onClick={handleCreateFile} className="icon-btn" title="New File">
                            <FilePlus size={18} />
                        </button>
                        <button onClick={handleCreateFolder} className="icon-btn" title="New Folder">
                            <FolderPlus size={18} />
                        </button>
                    </div>
                </div>

                <div className="search-wrapper">
                    <Search size={14} className="search-icon" />
                    <input type="text" placeholder="Search files..." className="search-input" />
                </div>
            </div>

            <div className="file-tree" onDragOver={handleRootDragOver} onDrop={handleRootDrop}>
                {fileTree.map((node) => (
                    <FileTreeNodeWithParent
                        key={node.id}
                        node={node}
                        depth={0}
                        parentHandle={rootHandle}
                        inlineAdd={inlineAdd}
                        setInlineAdd={setInlineAdd}
                        dragState={dragState}
                        setDragState={setDragState}
                    />
                ))}

                {inlineAdd && inlineAdd.parentId === '__root__' && (
                    <InlineInput
                        type={inlineAdd.type}
                        depth={0}
                        onSubmit={handleRootInlineSubmit}
                        onCancel={() => setInlineAdd(null)}
                    />
                )}

                {fileTree.length === 0 && !inlineAdd && (
                    <div className="tree-empty">
                        <FolderOpen size={28} strokeWidth={1} />
                        <span>Empty directory</span>
                    </div>
                )}
            </div>

            <div className="sidebar-footer">
                <button onClick={openDirectory} className="change-dir-btn">
                    <Folder size={14} />
                    Change Directory
                </button>
            </div>
        </>
    );
};
