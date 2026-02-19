import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { get, set } from 'idb-keyval';

const DIR_HANDLE_KEY = 'excalidraw-last-directory-handle';

// Types for File System Access API (if not fully available in current TS lib)
// In modern browsers these are global, but we define interfaces for clarity/safety
export interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission?(options?: { mode: string }): Promise<string>;
    requestPermission?(options?: { mode: string }): Promise<string>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
    close(): Promise<void>;
}

declare global {
    interface Window {
        showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    }
}

export type FileNode = {
    id: string; // concise path or name
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    children?: FileNode[];
};

interface FileSystemContextType {
    rootHandle: FileSystemDirectoryHandle | null;
    fileTree: FileNode[];
    selectedFile: FileNode | null;
    selectFile: (file: FileNode | null) => void;
    openDirectory: () => Promise<void>;
    refreshDirectory: () => Promise<void>;
    createFile: (parentHandle: FileSystemDirectoryHandle, name: string) => Promise<void>;
    createFolder: (parentHandle: FileSystemDirectoryHandle, name: string) => Promise<void>;
    deleteEntry: (parentHandle: FileSystemDirectoryHandle, name: string) => Promise<void>;
    readFileContent: (handle: FileSystemFileHandle) => Promise<string>;
    saveFileContent: (handle: FileSystemFileHandle, content: string) => Promise<void>;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export const useFileSystem = () => {
    const context = useContext(FileSystemContext);
    if (!context) {
        throw new Error('useFileSystem must be used within a FileSystemProvider');
    }
    return context;
};

export const FileSystemProvider = ({ children }: { children: ReactNode }) => {
    const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

    const scanDirectory = useCallback(async (dirHandle: FileSystemDirectoryHandle, path: string = ''): Promise<FileNode[]> => {
        const nodes: FileNode[] = [];

        for await (const [name, handle] of dirHandle.entries()) {
            // Filter for .excalidraw files or directories
            if (handle.kind === 'file' && !name.endsWith('.excalidraw')) {
                continue;
            }
            // Skip hidden files/folders
            if (name.startsWith('.')) {
                continue;
            }

            const nodePath = path ? `${path}/${name}` : name;

            const node: FileNode = {
                id: nodePath,
                name,
                kind: handle.kind,
                handle: handle as FileSystemFileHandle | FileSystemDirectoryHandle,
            };

            if (handle.kind === 'directory') {
                node.children = await scanDirectory(handle as FileSystemDirectoryHandle, nodePath);
                // Sort folders first, then files
                if (node.children) {
                    node.children.sort((a, b) => {
                        if (a.kind === b.kind) return a.name.localeCompare(b.name);
                        return a.kind === 'directory' ? -1 : 1;
                    });
                }
            }

            nodes.push(node);
        }

        // Sort at this level too
        nodes.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });

        return nodes;
    }, []);

    // Restore the last opened directory on mount
    useEffect(() => {
        const restoreDirectory = async () => {
            try {
                const storedHandle = await get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
                if (!storedHandle) return;

                // Verify we still have permission (may prompt the user)
                const permission = await (storedHandle as any).queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    setRootHandle(storedHandle);
                    const tree = await scanDirectory(storedHandle);
                    setFileTree(tree);
                    return;
                }

                // If not granted, try requesting permission
                const requested = await (storedHandle as any).requestPermission({ mode: 'readwrite' });
                if (requested === 'granted') {
                    setRootHandle(storedHandle);
                    const tree = await scanDirectory(storedHandle);
                    setFileTree(tree);
                }
            } catch (err) {
                console.warn('Could not restore last directory:', err);
            }
        };

        restoreDirectory();
    }, [scanDirectory]);

    const openDirectory = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setRootHandle(handle);
            const tree = await scanDirectory(handle);
            setFileTree(tree);
            setSelectedFile(null);
            // Persist the handle for next page load
            await set(DIR_HANDLE_KEY, handle);
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Error opening directory:', err);
            }
        }
    };

    const refreshDirectory = async () => {
        if (!rootHandle) return;
        const tree = await scanDirectory(rootHandle);
        setFileTree(tree);
    };

    const createFile = async (parentHandle: FileSystemDirectoryHandle, name: string) => {
        try {
            // Ensure extension
            const fileName = name.endsWith('.excalidraw') ? name : `${name}.excalidraw`;
            await parentHandle.getFileHandle(fileName, { create: true });
            await refreshDirectory();
        } catch (err) {
            console.error('Error creating file:', err);
            throw err;
        }
    };

    const createFolder = async (parentHandle: FileSystemDirectoryHandle, name: string) => {
        try {
            await parentHandle.getDirectoryHandle(name, { create: true });
            await refreshDirectory();
        } catch (err) {
            console.error('Error creating folder:', err);
            throw err;
        }
    };

    const deleteEntry = async (parentHandle: FileSystemDirectoryHandle, name: string) => {
        try {
            await parentHandle.removeEntry(name);
            // If deleted file was selected, deselect it
            if (selectedFile && selectedFile.name === name) { // Simple check, ideally check path
                setSelectedFile(null);
            }
            await refreshDirectory();
        } catch (err) {
            console.error('Error deleting entry:', err);
            throw err;
        }
    };

    const readFileContent = async (handle: FileSystemFileHandle): Promise<string> => {
        const file = await handle.getFile();
        return await file.text();
    };

    const saveFileContent = async (handle: FileSystemFileHandle, content: string) => {
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    };

    return (
        <FileSystemContext.Provider
            value={{
                rootHandle,
                fileTree,
                selectedFile,
                selectFile: setSelectedFile,
                openDirectory,
                refreshDirectory,
                createFile,
                createFolder,
                deleteEntry,
                readFileContent,
                saveFileContent,
            }}
        >
            {children}
        </FileSystemContext.Provider>
    );
};
