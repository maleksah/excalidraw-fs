import { useState } from 'react';
import { useFileSystem } from '../context/FileSystemContext';
import type { FileNode, FileSystemDirectoryHandle } from '../context/FileSystemContext';
import { Folder, FolderOpen, File, FilePlus, FolderPlus, Trash2, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FileTreeNodeWithParent = ({ node, depth, parentHandle }: { node: FileNode, depth: number, parentHandle: FileSystemDirectoryHandle }) => {
    const { selectFile, selectedFile, deleteEntry } = useFileSystem();
    const [isOpen, setIsOpen] = useState(false);

    const isSelected = selectedFile?.id === node.id;
    const isDirectory = node.kind === 'directory';

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

    return (
        <div>
            <motion.div
                layout
                className={`tree-node${isSelected ? ' selected' : ''}`}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
                onClick={handleClick}
            >
                <span className={`tree-node-chevron${isOpen && isDirectory ? ' open' : ''}`}>
                    {isDirectory && <ChevronRight size={14} strokeWidth={2.5} />}
                </span>

                <span className={`tree-node-icon ${isDirectory ? 'folder' : 'file'}`}>
                    {isDirectory ? (
                        <Folder size={18} />
                    ) : (
                        <File size={18} />
                    )}
                </span>

                <span className="tree-node-name">{node.name.replace('.excalidraw', '')}</span>

                <div className="tree-node-actions">
                    <button onClick={handleDelete} className="delete-btn" title="Delete">
                        <Trash2 size={13} />
                    </button>
                </div>
            </motion.div>

            <AnimatePresence>
                {isOpen && node.children && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="tree-children"
                    >
                        {node.children.map((child) => (
                            <FileTreeNodeWithParent
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                parentHandle={node.handle as FileSystemDirectoryHandle}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const FileExplorer = () => {
    const { rootHandle, fileTree, openDirectory, createFile, createFolder } = useFileSystem();

    const handleCreateFile = async () => {
        if (!rootHandle) return;
        const name = prompt("Enter file name:");
        if (name) {
            await createFile(rootHandle, name);
        }
    };

    const handleCreateFolder = async () => {
        if (!rootHandle) return;
        const name = prompt("Enter folder name:");
        if (name) {
            await createFolder(rootHandle, name);
        }
    };

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
                    <input
                        type="text"
                        placeholder="Search files..."
                        className="search-input"
                    />
                </div>
            </div>

            <div className="file-tree">
                {fileTree.map((node) => (
                    <FileTreeNodeWithParent key={node.id} node={node} depth={0} parentHandle={rootHandle} />
                ))}

                {fileTree.length === 0 && (
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
