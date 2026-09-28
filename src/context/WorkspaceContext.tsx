import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  WorkspaceSession, 
  WorkspaceSettings, 
  WorkspaceSavePolicy, 
  WorkspaceDisplayMode,
  ColumnSpec,
  ExportFormat,
  OutputDestination,
  OutputStrategy,
  MultiFileConfig,
  AppendConfig
} from '../types';
import {
  loadAllWorkspaces,
  saveWorkspaceToStorage,
  deleteWorkspaceFromStorage,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  createDefaultWorkspace,
  getRandomColorTag
} from '../utils/workspaceStorage';

interface WorkspaceContextValue {
  workspaces: WorkspaceSession[];
  activeWorkspaceId: string;
  activeWorkspace: WorkspaceSession;
  isInitialized: boolean;
  savePolicy: WorkspaceSavePolicy;
  displayMode: WorkspaceDisplayMode;
  isQuickSwitcherOpen: boolean;
  isSettingsModalOpen: boolean;
  isUnsavedPromptOpen: boolean;
  pendingTargetWorkspaceId: string | null;

  // Actions
  switchWorkspace: (targetId: string, force?: boolean) => void;
  confirmSwitchWithSave: () => Promise<void>;
  confirmSwitchWithoutSave: () => void;
  cancelSwitch: () => void;
  createWorkspace: (custom?: Partial<WorkspaceSession>) => Promise<WorkspaceSession>;
  duplicateWorkspace: (id: string) => Promise<WorkspaceSession>;
  renameWorkspace: (id: string, newName: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  updateActiveWorkspace: (updates: Partial<WorkspaceSession>) => void;
  saveActiveWorkspace: () => Promise<void>;
  setSavePolicy: (policy: WorkspaceSavePolicy) => Promise<void>;
  setDisplayMode: (mode: WorkspaceDisplayMode) => Promise<void>;
  setIsQuickSwitcherOpen: (open: boolean) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  importAsNewWorkspace: (data: {
    name: string;
    tableName?: string;
    columns: ColumnSpec[];
    format?: ExportFormat;
    count?: number;
    intervalMs?: number;
    outputStrategy?: OutputStrategy;
    multiFileConfig?: MultiFileConfig;
    appendConfig?: AppendConfig;
    selectedFolderName?: string | null;
  }) => Promise<WorkspaceSession>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSession[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [savePolicy, setSavePolicyState] = useState<WorkspaceSavePolicy>('auto');
  const [displayMode, setDisplayModeState] = useState<WorkspaceDisplayMode>('top-bar');
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState<boolean>(false);
  const [pendingTargetWorkspaceId, setPendingTargetWorkspaceId] = useState<string | null>(null);

  const autoSaveTimeoutRef = useRef<number | null>(null);

  // Initialize workspaces and settings from IndexedDB
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [loadedSettings, loadedWorkspaces] = await Promise.all([
          loadWorkspaceSettings(),
          loadAllWorkspaces()
        ]);
        if (!mounted) return;

        setSavePolicyState(loadedSettings.savePolicy);
        setDisplayModeState(loadedSettings.displayMode);

        const list = loadedWorkspaces.length > 0 ? loadedWorkspaces : [createDefaultWorkspace()];
        setWorkspaces(list);

        // Check if there is a previously active workspace stored in localStorage
        const storedActiveId = localStorage.getItem('vampio_active_workspace_id');
        const validActive = list.find((w) => w.id === storedActiveId);
        setActiveWorkspaceId(validActive ? validActive.id : list[0].id);
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize workspace system:', err);
        const fallback = createDefaultWorkspace();
        setWorkspaces([fallback]);
        setActiveWorkspaceId(fallback.id);
        setIsInitialized(true);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync active workspace ID to local storage for instant restore on refresh
  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('vampio_active_workspace_id', activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || createDefaultWorkspace();

  // Save policy setter
  const setSavePolicy = async (policy: WorkspaceSavePolicy) => {
    setSavePolicyState(policy);
    await saveWorkspaceSettings({
      savePolicy: policy,
      displayMode,
      autoSaveDelayMs: 300
    });
  };

  // Display mode setter
  const setDisplayMode = async (mode: WorkspaceDisplayMode) => {
    setDisplayModeState(mode);
    await saveWorkspaceSettings({
      savePolicy,
      displayMode: mode,
      autoSaveDelayMs: 300
    });
  };

  // Manual save for active workspace
  const saveActiveWorkspace = useCallback(async () => {
    if (!activeWorkspace) return;
    const cleaned: WorkspaceSession = {
      ...activeWorkspace,
      updatedAt: Date.now(),
      isDirty: false
    };
    await saveWorkspaceToStorage(cleaned);
    setWorkspaces((prev) => prev.map((w) => (w.id === cleaned.id ? cleaned : w)));
  }, [activeWorkspace]);

  // Update active workspace properties
  const updateActiveWorkspace = useCallback((updates: Partial<WorkspaceSession>) => {
    setWorkspaces((prev) => {
      const index = prev.findIndex((w) => w.id === activeWorkspaceId);
      if (index === -1) return prev;

      const current = prev[index];
      const isDirty = savePolicy !== 'auto';
      const updated: WorkspaceSession = {
        ...current,
        ...updates,
        isDirty,
        updatedAt: Date.now()
      };

      const next = [...prev];
      next[index] = updated;

      // Auto-save logic
      if (savePolicy === 'auto') {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = window.setTimeout(() => {
          saveWorkspaceToStorage(updated).catch(() => {});
        }, 300);
      }

      return next;
    });
  }, [activeWorkspaceId, savePolicy]);

  // Switch workspace
  const switchWorkspace = useCallback((targetId: string, force = false) => {
    if (targetId === activeWorkspaceId) return;

    const current = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!force && current?.isDirty && savePolicy === 'prompt') {
      setPendingTargetWorkspaceId(targetId);
      setIsUnsavedPromptOpen(true);
      return;
    }

    if (savePolicy === 'auto' && current) {
      saveWorkspaceToStorage(current).catch(() => {});
    }

    setActiveWorkspaceId(targetId);
  }, [activeWorkspaceId, workspaces, savePolicy]);

  // Confirm Switch With Save
  const confirmSwitchWithSave = async () => {
    if (activeWorkspace) {
      await saveActiveWorkspace();
    }
    if (pendingTargetWorkspaceId) {
      setActiveWorkspaceId(pendingTargetWorkspaceId);
    }
    setIsUnsavedPromptOpen(false);
    setPendingTargetWorkspaceId(null);
  };

  // Confirm Switch Without Save
  const confirmSwitchWithoutSave = () => {
    if (pendingTargetWorkspaceId) {
      // Discard dirty state in memory by reloading from storage if available
      loadAllWorkspaces().then((stored) => {
        setWorkspaces(stored);
        if (pendingTargetWorkspaceId) {
          setActiveWorkspaceId(pendingTargetWorkspaceId);
        }
      });
    }
    setIsUnsavedPromptOpen(false);
    setPendingTargetWorkspaceId(null);
  };

  // Cancel switch
  const cancelSwitch = () => {
    setIsUnsavedPromptOpen(false);
    setPendingTargetWorkspaceId(null);
  };

  // Create new workspace
  const createWorkspace = async (custom?: Partial<WorkspaceSession>): Promise<WorkspaceSession> => {
    const newWs = createDefaultWorkspace({
      name: custom?.name || `Project ${workspaces.length + 1}`,
      tableName: custom?.tableName || `records_${workspaces.length + 1}`,
      colorTag: custom?.colorTag || getRandomColorTag(workspaces.length),
      ...custom
    });

    await saveWorkspaceToStorage(newWs);
    setWorkspaces((prev) => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
    return newWs;
  };

  // Duplicate workspace
  const duplicateWorkspace = async (id: string): Promise<WorkspaceSession> => {
    const target = workspaces.find((w) => w.id === id) || activeWorkspace;
    const duplicated: WorkspaceSession = {
      ...target,
      id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name} (Copy)`,
      tableName: `${target.tableName}_copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDirty: false,
      colorTag: getRandomColorTag(workspaces.length),
    };

    await saveWorkspaceToStorage(duplicated);
    setWorkspaces((prev) => [...prev, duplicated]);
    setActiveWorkspaceId(duplicated.id);
    return duplicated;
  };

  // Rename workspace
  const renameWorkspace = async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name: trimmed, updatedAt: Date.now() } : w))
    );

    const target = workspaces.find((w) => w.id === id);
    if (target) {
      await saveWorkspaceToStorage({ ...target, name: trimmed });
    }
  };

  // Delete workspace
  const deleteWorkspace = async (id: string) => {
    await deleteWorkspaceFromStorage(id);

    setWorkspaces((prev) => {
      const remaining = prev.filter((w) => w.id !== id);
      if (remaining.length === 0) {
        const fresh = createDefaultWorkspace();
        saveWorkspaceToStorage(fresh).catch(() => {});
        setActiveWorkspaceId(fresh.id);
        return [fresh];
      }

      if (id === activeWorkspaceId) {
        // Find adjacent workspace
        const delIndex = prev.findIndex((w) => w.id === id);
        const nextIndex = delIndex > 0 ? delIndex - 1 : 0;
        setActiveWorkspaceId(remaining[nextIndex]?.id || remaining[0].id);
      }
      return remaining;
    });
  };

  // Import as New Workspace
  const importAsNewWorkspace = async (data: {
    name: string;
    tableName?: string;
    columns: ColumnSpec[];
    format?: ExportFormat;
    count?: number;
    intervalMs?: number;
    outputStrategy?: OutputStrategy;
    multiFileConfig?: MultiFileConfig;
    appendConfig?: AppendConfig;
    selectedFolderName?: string | null;
  }): Promise<WorkspaceSession> => {
    const newWs = createDefaultWorkspace({
      name: data.name,
      tableName: data.tableName || 'imported_schema',
      columns: data.columns,
      format: data.format || 'csv',
      count: data.count || 1000,
      intervalMs: data.intervalMs || 150,
      outputStrategy: data.outputStrategy || 'single',
      multiFileConfig: data.multiFileConfig,
      appendConfig: data.appendConfig,
      selectedFolderName: data.selectedFolderName || null,
      colorTag: getRandomColorTag(workspaces.length),
    });

    await saveWorkspaceToStorage(newWs);
    setWorkspaces((prev) => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
    return newWs;
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Quick Switcher
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSwitcherOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + S: Manual Save Active Workspace
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveWorkspace();
        return;
      }

      // Cmd/Ctrl + Alt + ArrowLeft / ArrowRight: Switch Tabs
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (workspaces.length <= 1) return;
        const currentIndex = workspaces.findIndex((w) => w.id === activeWorkspaceId);
        if (currentIndex === -1) return;

        let nextIndex = e.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0) nextIndex = workspaces.length - 1;
        if (nextIndex >= workspaces.length) nextIndex = 0;

        switchWorkspace(workspaces[nextIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaces, activeWorkspaceId, switchWorkspace, saveActiveWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        isInitialized,
        savePolicy,
        displayMode,
        isQuickSwitcherOpen,
        isSettingsModalOpen,
        isUnsavedPromptOpen,
        pendingTargetWorkspaceId,
        switchWorkspace,
        confirmSwitchWithSave,
        confirmSwitchWithoutSave,
        cancelSwitch,
        createWorkspace,
        duplicateWorkspace,
        renameWorkspace,
        deleteWorkspace,
        updateActiveWorkspace,
        saveActiveWorkspace,
        setSavePolicy,
        setDisplayMode,
        setIsQuickSwitcherOpen,
        setIsSettingsModalOpen,
        importAsNewWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
