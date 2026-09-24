import { ColumnSpec, ExportFormat } from '../types';

export interface SavedSession {
  id: string;
  name: string;
  timestamp: number;
  tableName: string;
  columns: ColumnSpec[];
  format: ExportFormat;
  count: number;
  intervalMs: number;
  selectedFolderName?: string | null;
}

export interface RecentFileRecord {
  id: string;
  filename: string;
  format: ExportFormat;
  rowCount: number;
  timestamp: number;
  folderName?: string | null;
  fileSizeBytes?: number;
}

export interface RecentFolderRecord {
  name: string;
  lastUsed: number;
}

const CURRENT_SESSION_KEY = 'vampio_current_session';
const SAVED_SESSIONS_KEY = 'vampio_saved_sessions';
const RECENT_FILES_KEY = 'vampio_recent_files';
const RECENT_FOLDERS_KEY = 'vampio_recent_folders';

export function saveCurrentSessionAuto(data: {
  columns: ColumnSpec[];
  tableName: string;
  format: ExportFormat;
  count: number;
  intervalMs: number;
  selectedFolderName?: string | null;
}) {
  try {
    if (!data.columns || data.columns.length === 0) return;
    const session: SavedSession = {
      id: 'latest_auto_session',
      name: `Auto-saved (${data.tableName || 'schema'})`,
      timestamp: Date.now(),
      ...data,
    };
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Could not auto-save session:', e);
  }
}

export function getLatestSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveNamedSession(data: {
  name: string;
  columns: ColumnSpec[];
  tableName: string;
  format: ExportFormat;
  count: number;
  intervalMs: number;
  selectedFolderName?: string | null;
}): SavedSession {
  const newSession: SavedSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...data,
    timestamp: Date.now(),
  };

  try {
    const existing = getSavedSessions();
    const updated = [newSession, ...existing.filter((s) => s.name !== data.name)].slice(0, 15);
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save named session:', e);
  }
  return newSession;
}

export function getSavedSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SAVED_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteSavedSession(id: string): void {
  try {
    const existing = getSavedSessions();
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(existing.filter((s) => s.id !== id)));
  } catch (e) {
    console.warn('Could not delete session:', e);
  }
}

export function addRecentFile(file: Omit<RecentFileRecord, 'id' | 'timestamp'>) {
  try {
    const record: RecentFileRecord = {
      ...file,
      id: `file_${Date.now()}`,
      timestamp: Date.now(),
    };
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    const existing: RecentFileRecord[] = raw ? JSON.parse(raw) : [];
    const updated = [record, ...existing.filter((f) => f.filename !== file.filename)].slice(0, 10);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save recent file:', e);
  }
}

export function getRecentFiles(): RecentFileRecord[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearRecentFiles(): void {
  try {
    localStorage.removeItem(RECENT_FILES_KEY);
  } catch (e) {
    console.warn('Could not clear recent files:', e);
  }
}

export function addRecentFolder(folderName: string) {
  if (!folderName) return;
  try {
    const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
    const existing: RecentFolderRecord[] = raw ? JSON.parse(raw) : [];
    const updated = [
      { name: folderName, lastUsed: Date.now() },
      ...existing.filter((f) => f.name !== folderName),
    ].slice(0, 6);
    localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save recent folder:', e);
  }
}

export function getRecentFolders(): RecentFolderRecord[] {
  try {
    const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearRecentFolders(): void {
  try {
    localStorage.removeItem(RECENT_FOLDERS_KEY);
  } catch (e) {
    console.warn('Could not clear recent folders:', e);
  }
}

export function exportSchemaJSON(columns: ColumnSpec[], tableName: string): void {
  const exportData = {
    schemaVersion: '1.0',
    tableName,
    exportedAt: new Date().toISOString(),
    columnCount: columns.length,
    columns,
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tableName || 'schema'}_blueprint.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
