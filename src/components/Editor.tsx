import { useEffect, useState, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useFileSystem } from '../context/FileSystemContext';
import type { FileSystemFileHandle } from '../context/FileSystemContext';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';

export const Editor = () => {
    const { selectedFile, readFileContent, saveFileContent } = useFileSystem();
    const [initialData, setInitialData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<'idle' | 'not-saved' | 'saving' | 'saved'>('idle');
    const excalidrawAPI = useRef<any>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset state when selection changes
    useEffect(() => {
        setInitialData(null);
        setError(null);
        setSaveState('idle');
        if (selectedFile) {
            setIsLoading(true);
        }
    }, [selectedFile]);

    // Prevent closing window if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveState === 'not-saved' || saveState === 'saving') {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveState]);

    useEffect(() => {
        const loadFile = async () => {
            if (!selectedFile || selectedFile.kind !== 'file') {
                setIsLoading(false);
                return;
            }

            try {
                const content = await readFileContent(selectedFile.handle as FileSystemFileHandle);
                try {
                    const parsed = JSON.parse(content);
                    const { collaborators, ...restAppState } = parsed.appState || {};

                    setInitialData({
                        elements: parsed.elements || [],
                        appState: {
                            ...restAppState,
                            viewBackgroundColor: restAppState?.viewBackgroundColor || '#ffffff',
                            currentItemFontFamily: restAppState?.currentItemFontFamily ?? 2,
                            currentItemRoughness: restAppState?.currentItemRoughness ?? 0,
                        },
                        files: parsed.files || {},
                    });
                } catch {
                    setInitialData({
                        elements: [],
                        appState: {
                            viewBackgroundColor: '#ffffff',
                            currentItemFontFamily: 2,
                            currentItemRoughness: 0,
                        },
                        files: {},
                    });
                }
            } catch (err: any) {
                console.error("Failed to read file", err);
                setError(err.message || "Failed to read file");
            } finally {
                setIsLoading(false);
            }
        };

        if (selectedFile) {
            loadFile();
        }
    }, [selectedFile, readFileContent]);

    const lastSavedDataRef = useRef<string | null>(null);
    const lastSeenDataRef = useRef<string | null>(null);

    const handleChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
        if (!selectedFile) return;

        // Skip saving if we are just loading
        if (isLoading) return;

        // Create a payload that excludes selection state and transient appState
        const documentStateForComparison = {
            elements: elements.map(el => ({
                ...el,
            })).map(el => {
                const { isSelected, ...rest } = el as any;
                return rest;
            }),
            appState: {
                viewBackgroundColor: appState.viewBackgroundColor,
                currentItemFontFamily: appState.currentItemFontFamily,
                currentItemRoughness: appState.currentItemRoughness,
                theme: appState.theme,
            },
            files: Object.keys(files).length > 0 ? files : undefined,
        };

        const comparisonString = JSON.stringify(documentStateForComparison);

        // Prevent infinite loop by checking against the EXACT same data we just saw on the last onChange
        if (lastSeenDataRef.current === comparisonString) {
            return;
        }

        lastSeenDataRef.current = comparisonString;

        // If it's the very first load and we don't have a ref, just set it and return so it doesn't pop up "saved" on open
        if (lastSavedDataRef.current === null) {
            lastSavedDataRef.current = comparisonString;
            return;
        }

        // If data reverted to the last saved data, we can pretend it's saved.
        if (lastSavedDataRef.current === comparisonString) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            setSaveState('idle');
            return;
        }

        // Document has actually changed, immediately show not-saved
        setSaveState('not-saved');

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            const content = JSON.stringify({
                elements,
                appState: {
                    ...appState,
                    collaborators: undefined // don't save collaborators
                },
                files,
            }, null, 2);

            setSaveState('saving');

            try {
                await saveFileContent(selectedFile.handle as FileSystemFileHandle, content);
                lastSavedDataRef.current = comparisonString;

                // Only show saved if we are still saving that same data (no new edits broke the chain)
                if (lastSeenDataRef.current === comparisonString) {
                    setSaveState('saved');
                    if (saveStatusTimeoutRef.current) {
                        clearTimeout(saveStatusTimeoutRef.current);
                    }
                    saveStatusTimeoutRef.current = setTimeout(() => {
                        setSaveState(prev => prev === 'saved' ? 'idle' : prev);
                    }, 2000);
                }
            } catch (err) {
                console.error("Failed to save", err);
                setSaveState('idle');
            }
        }, 1000);
    }, [selectedFile, saveFileContent, isLoading]);

    if (!selectedFile) {
        return (
            <div className="editor-empty">
                <div className="editor-empty-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
                <h3>No file selected</h3>
                <p>Select a file from the sidebar or create a new one.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginBottom: 16 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>Error Loading File</h3>
                <p className="error-message">{error}</p>
                <button className="error-btn" onClick={() => window.location.reload()}>Reload</button>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {isLoading && (
                <div className="editor-loading">
                    <div className="spinner"></div>
                </div>
            )}
            {initialData && (
                <div className="excalidraw-wrapper" key={selectedFile.id}>
                    <Excalidraw
                        excalidrawAPI={(api) => { excalidrawAPI.current = api; }}
                        initialData={initialData}
                        onChange={handleChange}
                        UIOptions={{
                            canvasActions: {
                                changeViewBackgroundColor: true,
                                clearCanvas: true,
                                loadScene: false,
                                saveAsImage: true,
                                saveToActiveFile: false,
                                export: { saveFileToDisk: false },
                                toggleTheme: true,
                            }
                        }}
                    />
                    <div className={`save-status ${saveState}`}>
                        <div className="save-status-indicator"></div>
                        <span>
                            {saveState === 'saving' ? 'Saving...' :
                                saveState === 'saved' ? 'Saved' :
                                    saveState === 'not-saved' ? 'Unsaved changes' : ''}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
