import type { DiscoveredFolderFile, FolderMonitorEvent } from './folderBehaviorAnalyzer';

export type MonitorSourceKind = 'none' | 'directory' | 'snapshot';
export type MonitorStatus = 'idle' | 'scanning' | 'ready' | 'paused' | 'snapshot' | 'error';
export type MonitorChange = Pick<FolderMonitorEvent, 'type' | 'message' | 'details'>;

export function monitorSourceKind(handle: any): MonitorSourceKind {
  if (!handle) return 'none';
  return handle.kind === 'virtual-dir' ? 'snapshot' : 'directory';
}

export function fileIdentity(file: DiscoveredFolderFile): string {
  return file.relativePath || file.name;
}

/** Persist an unambiguous path when available; clear a selection whose file disappeared. */
export function resolveSchemaSource(files: DiscoveredFolderFile[], requested: string | null): string | null {
  if (!requested) return null;
  const match = files.find(file => fileIdentity(file) === requested) || files.find(file => file.name === requested);
  return match ? fileIdentity(match) : null;
}

/** Metadata changes describe observations, never infer OS locks or rotation from size alone. */
export function diffFolderSnapshots(previous: DiscoveredFolderFile[], next: DiscoveredFolderFile[]): MonitorChange[] {
  const before = new Map(previous.map(file => [fileIdentity(file), file]));
  const after = new Map(next.map(file => [fileIdentity(file), file]));
  const changes: MonitorChange[] = [];
  for (const file of next) {
    const old = before.get(fileIdentity(file));
    if (!old) {
      changes.push({ type: 'file_added', message: `File added: ${fileIdentity(file)}` });
      continue;
    }
    const oldError = old.readError || old.lockReason || (old.isLocked || old.readStatus === 'read_error' ? 'Read failed' : undefined);
    const readError = file.readError || file.lockReason || (file.isLocked || file.readStatus === 'read_error' ? 'Read failed' : undefined);
    if (oldError !== readError) {
      changes.push({ type: 'access_changed', message: `${readError ? 'Read failed' : 'Read access restored'}: ${fileIdentity(file)}`, details: readError });
    }
    // Failed reads can supply placeholder metadata. They are not truncations or appends.
    if (oldError || readError) continue;
    if (file.size !== old.size) {
      changes.push({
        type: file.size > old.size ? 'file_grown' : 'file_truncated',
        message: `${file.size > old.size ? 'File grew' : 'File truncated'}: ${fileIdentity(file)}`,
        details: `${old.size} → ${file.size} bytes`,
      });
    } else if (old.lastModified !== file.lastModified || (old.sampleContent !== undefined && file.sampleContent !== undefined && old.sampleContent !== file.sampleContent)) {
      changes.push({ type: 'file_modified', message: `File modified: ${fileIdentity(file)}` });
    }
  }
  for (const file of previous) {
    if (!after.has(fileIdentity(file))) changes.push({ type: 'file_removed', message: `File removed: ${fileIdentity(file)}` });
  }
  return changes;
}

/** Serializes reads even when the active source changes during an unfinished scan. */
export function createSerialScanner() {
  let pending: Promise<unknown> = Promise.resolve();
  return <T>(isCurrent: () => boolean, read: () => Promise<T>): Promise<T | undefined> => {
    const next = pending.then(() => isCurrent() ? read() : undefined);
    pending = next.catch(() => undefined);
    return next;
  };
}
