import { 
  WorkspaceSession, 
  WorkspaceSettings, 
  WorkspaceSavePolicy, 
  WorkspaceDisplayMode,
  ColumnSpec,
  ExportFormat,
  OutputDestination,
  OutputStrategy
} from '../types';

const DB_NAME = 'vampio_workspaces_db';
const DB_VERSION = 1;
const STORE_WORKSPACES = 'workspaces';
const STORE_SETTINGS = 'settings';

const LOCALSTORAGE_BACKUP_KEY = 'vampio_workspaces_backup';
const LOCALSTORAGE_SETTINGS_KEY = 'vampio_workspace_settings';

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  savePolicy: 'auto',
  displayMode: 'top-bar',
  autoSaveDelayMs: 300,
};

export const COLOR_TAGS = [
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  { id: 'sky', label: 'Sky', bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', dot: 'bg-sky-500' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-500' },
] as const;

export function getRandomColorTag(index = 0): string {
  return COLOR_TAGS[index % COLOR_TAGS.length].id;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
          db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
        };
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn('IndexedDB open error, falling back to LocalStorage:', request.error);
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

export function createDefaultWorkspace(custom?: Partial<WorkspaceSession>): WorkspaceSession {
  const now = Date.now();
  return {
    id: `ws_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: custom?.name || 'Workspace 1',
    tableName: custom?.tableName || 'records',
    createdAt: custom?.createdAt || now,
    updatedAt: custom?.updatedAt || now,
    isDirty: false,
    colorTag: custom?.colorTag || 'emerald',
    columns: custom?.columns ? custom.columns : [],
    format: custom?.format || 'csv',
    count: custom?.count || 1000,
    intervalMs: custom?.intervalMs || 150,
    outputDestination: custom?.outputDestination || 'download',
    outputStrategy: custom?.outputStrategy || 'single',
    multiFileConfig: custom?.multiFileConfig || {
      enabled: false,
      rowsPerFile: 1,
      filenamePattern: '{filename}_{index}.{ext}',
      packageAsZip: true,
    },
    appendConfig: custom?.appendConfig || {
      autoContinueSequence: true,
      manualStartOffset: 1,
      skipDuplicateHeaders: true,
      excelSheetMode: 'active_sheet',
      newSheetName: 'Appended_Data',
      saveMode: 'suffix',
      suffix: 'appended',
    },
    selectedFolderName: custom?.selectedFolderName || null,
    filename: custom?.filename || 'synthetic_dataset',
    description: custom?.description || '',
  };
}

export async function loadAllWorkspaces(): Promise<WorkspaceSession[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_WORKSPACES, 'readonly');
      const store = tx.objectStore(STORE_WORKSPACES);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result as WorkspaceSession[];
        if (results && results.length > 0) {
          // Sort by updatedAt descending or createdAt
          results.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
          resolve(results);
        } else {
          // Check LocalStorage backup
          const ls = loadFromLocalStorageBackup();
          if (ls.length > 0) {
            resolve(ls);
          } else {
            const def = createDefaultWorkspace();
            saveWorkspaceToStorage(def).catch(() => {});
            resolve([def]);
          }
        }
      };

      req.onerror = () => {
        resolve(loadFromLocalStorageBackup());
      };
    });
  } catch {
    const ls = loadFromLocalStorageBackup();
    if (ls.length > 0) return ls;
    const def = createDefaultWorkspace();
    return [def];
  }
}

export async function saveWorkspaceToStorage(ws: WorkspaceSession): Promise<void> {
  const updatedWs: WorkspaceSession = {
    ...ws,
    updatedAt: Date.now(),
    isDirty: false,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
      const store = tx.objectStore(STORE_WORKSPACES);
      const req = store.put(updatedWs);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Save to LocalStorage fallback
  }

  // Always keep localStorage updated as immediate synchronous resilience
  syncToLocalStorage(updatedWs);
}

export async function deleteWorkspaceFromStorage(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
      const store = tx.objectStore(STORE_WORKSPACES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback
  }

  // Remove from localStorage fallback
  removeFromLocalStorage(id);
}

export async function loadWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get('main');
      req.onsuccess = () => {
        if (req.result) {
          resolve({
            savePolicy: req.result.savePolicy || DEFAULT_SETTINGS.savePolicy,
            displayMode: req.result.displayMode || DEFAULT_SETTINGS.displayMode,
            autoSaveDelayMs: req.result.autoSaveDelayMs || DEFAULT_SETTINGS.autoSaveDelayMs,
          });
        } else {
          resolve(loadSettingsFromLocalStorage());
        }
      };
      req.onerror = () => resolve(loadSettingsFromLocalStorage());
    });
  } catch {
    return loadSettingsFromLocalStorage();
  }
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.put({ id: 'main', ...settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback
  }
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(LOCALSTORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  } catch {
    // Restricted environment
  }
  return null;
}

// LocalStorage helpers
function loadFromLocalStorageBackup(): WorkspaceSession[] {
  try {
    const storage = getStorage();
    if (!storage) return [];
    const raw = storage.getItem(LOCALSTORAGE_BACKUP_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function syncToLocalStorage(ws: WorkspaceSession): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    const existing = loadFromLocalStorageBackup();
    const updated = [ws, ...existing.filter((item) => item.id !== ws.id)].slice(0, 30);
    storage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage backup failed:', e);
  }
}

function removeFromLocalStorage(id: string): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    const existing = loadFromLocalStorageBackup();
    const updated = existing.filter((item) => item.id !== id);
    storage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage remove failed:', e);
  }
}

function loadSettingsFromLocalStorage(): WorkspaceSettings {
  try {
    const storage = getStorage();
    if (!storage) return DEFAULT_SETTINGS;
    const raw = storage.getItem(LOCALSTORAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function exportWorkspacesAsJson(workspaces: WorkspaceSession[]): string {
  return JSON.stringify({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    totalWorkspaces: workspaces.length,
    workspaces,
  }, null, 2);
}
