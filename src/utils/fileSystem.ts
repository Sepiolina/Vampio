import { ColumnSpec, ExportFormat } from '../types';
import { isTauri as coreIsTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { downloadFile, createZipArchive, resolveMultiFilename, formatSingleFileUnit, toXmlTag } from './export';

/**
 * Robustly checks if running inside the Tauri native desktop application (.exe, macOS, Linux).
 *
 * Note: never assign `window.isTauri` ourselves. Tauri v2 defines it as a
 * read-only property, and assigning to it from an ES module (strict mode)
 * throws at load time, leaving the desktop app on a blank screen.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    (window as any).isTauri ||
    (typeof coreIsTauri === 'function' && coreIsTauri())
  );
}

/**
 * Checks whether the app is running embedded within an iframe (e.g. AI Studio preview)
 */
export function isEmbeddedIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Checks whether low-level direct filesystem access is supported.
 * In desktop mode (Tauri), it is always supported.
 * In browser iframes, the browser security policy strictly blocks showDirectoryPicker.
 */
export function isFileSystemAccessSupported(): boolean {
  if (isTauri()) return true;
  if (isEmbeddedIframe()) return false;
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

export interface VirtualDirectoryHandle {
  kind: 'virtual-dir';
  name: string;
  path: string;
  files: File[];
  getFiles?: () => Promise<File[]>;
}

export interface DirectorySelectionOptions {
  allowFallback?: boolean;
  title?: string;
  startIn?: string;
}

export interface DirectorySelectionResult {
  handle: FileSystemDirectoryHandle | VirtualDirectoryHandle | any;
  name: string;
  files: File[];
  isVirtual: boolean;
  path?: string;
}

export interface FileSelectionOptions {
  accept?: string;
  multiple?: boolean;
  title?: string;
}

export interface ScannedDataTransferResult {
  files: File[];
  folderName: string;
  directoryHandle?: any;
  isDirectory: boolean;
}

/**
 * Creates a Virtual Directory Handle for safe, portable operations in browser / iframe environments.
 */
export function createVirtualDirectoryHandle(
  name: string,
  path?: string,
  files?: File[]
): VirtualDirectoryHandle {
  const cleanName = name.trim().replace(/^[/\\]+/, '') || 'output_folder';
  const fileList = files || [];
  return {
    kind: 'virtual-dir',
    name: cleanName,
    path: path || cleanName,
    files: fileList,
    async getFiles() {
      return this.files;
    },
  };
}

/**
 * Ephemeral HTML Directory Picker fallback (<input type="file" webkitdirectory />).
 * Works reliably even inside restricted browser iframes.
 */
export function pickDirectoryViaHtmlInput(): Promise<DirectorySelectionResult | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let resolved = false;
    const cleanup = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const handleChange = () => {
      if (resolved) return;
      resolved = true;
      const fileList = input.files;
      if (!fileList || fileList.length === 0) {
        cleanup();
        resolve(null);
        return;
      }
      const files: File[] = Array.from(fileList);
      const firstRelativePath = (files[0] as any)?.webkitRelativePath || '';
      const rootName = firstRelativePath.split('/')[0] || 'selected_folder';
      const handle = createVirtualDirectoryHandle(rootName, rootName, files);
      cleanup();
      resolve({
        handle,
        name: rootName,
        files,
        isVirtual: true,
        path: rootName,
      });
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(null);
    };

    input.addEventListener('change', handleChange, { once: true });
    input.addEventListener('cancel', handleCancel, { once: true });

    // Fallback cancel detector on window refocus
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!resolved && (!input.files || input.files.length === 0)) {
          handleCancel();
        }
      }, 2500);
    };
    window.addEventListener('focus', onFocus, { once: true });

    input.click();
  });
}

/**
 * Single source of truth for directory selection across desktop (Tauri), native browser API,
 * and transparent fallback HTML input (in iframes or unsupported browsers).
 */
export async function pickDirectory(
  options: DirectorySelectionOptions = {}
): Promise<DirectorySelectionResult | null> {
  const allowFallback = options.allowFallback !== false;

  // 1. Native Desktop App (Tauri)
  if (isTauri()) {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: options.title || 'Select Folder',
      });
      if (selected === null) {
        return null;
      }
      const path = Array.isArray(selected) ? selected[0] : selected;
      const name = path.split(/[\\/]/).pop() || path;
      return {
        handle: { kind: 'tauri-dir', path, name },
        name,
        files: [],
        isVirtual: false,
        path,
      };
    } catch (err: any) {
      console.error('Tauri native directory picker failed:', err);
      if (!allowFallback) {
        throw new Error(`Desktop folder picker error: ${err.message || String(err)}`);
      }
    }
  }

  // 2. Standard Web Browser with File System Access API (when not blocked by iframe)
  if (!isEmbeddedIframe() && typeof (window as any).showDirectoryPicker === 'function') {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: options.startIn || 'downloads',
      });
      return {
        handle,
        name: handle.name,
        files: [],
        isVirtual: false,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User intentionally cancelled
        return null;
      }
      if (!allowFallback) {
        if (err.name === 'SecurityError') {
          const secErr: any = new Error(
            'Access to local directory was denied by browser security policy. This often occurs inside embedded iframes. Opening the app in a new browser tab allows full directory write access.'
          );
          secErr.name = 'SecurityError';
          secErr.isIframe = true;
          throw secErr;
        }
        throw err;
      }
      console.warn('Native showDirectoryPicker failed, falling back to HTML directory picker:', err);
    }
  }

  // 3. Fallback or Iframe environment
  if (!allowFallback) {
    if (isEmbeddedIframe()) {
      const err: any = new Error(
        'Access to local directory was denied by browser security policy. This often occurs inside embedded iframes. Opening the app in a new browser tab allows full directory write access.'
      );
      err.name = 'SecurityError';
      err.isIframe = true;
      throw err;
    }
    const err: any = new Error('File System Access API is not supported in this browser.');
    err.name = 'NotSupportedError';
    throw err;
  }

  return await pickDirectoryViaHtmlInput();
}

/**
 * Single source of truth for file selection across desktop and web environments.
 */
export function pickFiles(options: FileSelectionOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve([]);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    if (options.accept) {
      input.accept = options.accept;
    }
    input.multiple = options.multiple ?? true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let resolved = false;
    const cleanup = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const handleChange = () => {
      if (resolved) return;
      resolved = true;
      const fileList = input.files;
      const files: File[] = fileList ? Array.from(fileList) : [];
      cleanup();
      resolve(files);
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve([]);
    };

    input.addEventListener('change', handleChange, { once: true });
    input.addEventListener('cancel', handleCancel, { once: true });

    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!resolved && (!input.files || input.files.length === 0)) {
          handleCancel();
        }
      }, 2500);
    };
    window.addEventListener('focus', onFocus, { once: true });

    input.click();
  });
}

/**
 * Recursively traverses a FileSystemEntry (WebKit directory entry standard)
 */
export async function traverseFileSystemEntry(entry: any, outFiles: File[]): Promise<void> {
  if (!entry) return;
  if (entry.isFile) {
    await new Promise<void>((resolve) => {
      entry.file(
        (file: File) => {
          outFiles.push(file);
          resolve();
        },
        () => resolve()
      );
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const readBatch = (): Promise<any[]> => {
      return new Promise((resolve) => {
        reader.readEntries(
          (batch: any[]) => resolve(batch || []),
          () => resolve([])
        );
      });
    };
    let entries: any[] = [];
    do {
      entries = await readBatch();
      for (const child of entries) {
        await traverseFileSystemEntry(child, outFiles);
      }
    } while (entries.length > 0);
  }
}

/**
 * Single source of truth for processing drag-and-drop transfers containing files or directories.
 */
export async function scanDataTransfer(
  dataTransfer: DataTransfer
): Promise<ScannedDataTransferResult> {
  const items = dataTransfer.items;
  const files = dataTransfer.files;

  // 1. Direct FileSystemDirectoryHandle support (Chromium)
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (typeof (it as any).getAsFileSystemHandle === 'function') {
        try {
          const handle = await (it as any).getAsFileSystemHandle();
          if (handle && handle.kind === 'directory') {
            return {
              files: [],
              folderName: handle.name || 'target_folder',
              directoryHandle: handle,
              isDirectory: true,
            };
          }
        } catch {
          // ignore and fall through
        }
      }
    }
  }

  // 2. Recursive traversal of dropped items (webkitGetAsEntry)
  const droppedFiles: File[] = [];
  let detectedDirName = '';
  let hasDirectory = false;

  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind !== 'file') continue;
      const entry = (it as any).webkitGetAsEntry ? (it as any).webkitGetAsEntry() : null;
      if (entry) {
        if (entry.isDirectory) {
          hasDirectory = true;
          if (!detectedDirName) {
            detectedDirName = entry.name;
          }
        }
        await traverseFileSystemEntry(entry, droppedFiles);
      } else {
        const f = it.getAsFile();
        if (f) droppedFiles.push(f);
      }
    }
  } else if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      droppedFiles.push(files[i]);
    }
  }

  const folderName =
    detectedDirName ||
    (droppedFiles.length > 0 && (droppedFiles[0] as any)?.webkitRelativePath
      ? (droppedFiles[0] as any).webkitRelativePath.split('/')[0]
      : '') ||
    'dropped_folder';

  return {
    files: droppedFiles,
    folderName,
    isDirectory: hasDirectory || Boolean(detectedDirName),
  };
}

/**
 * Backward compatibility wrapper for requesting raw FileSystemDirectoryHandle or Tauri dir
 */
export async function requestDirectoryHandle(): Promise<FileSystemDirectoryHandle | any | null> {
  const result = await pickDirectory({ allowFallback: false });
  return result ? result.handle : null;
}

/**
 * Normalises a user-supplied relative filename so it can never escape the chosen directory
 * ("../", absolute paths, drive letters, backslashes).
 */
export function sanitizeRelativeFilename(filename: string): string {
  const segments = String(filename)
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.replace(/[:*?"<>|\x00-\x1f]/g, '_').trim())
    .filter((seg) => seg !== '' && seg !== '.' && seg !== '..');
  return segments.join('/') || 'output';
}

function joinTauriPath(dirPath: string, filename: string): string {
  const base = dirPath.replace(/[\\/]+$/, '');
  return `${base}/${sanitizeRelativeFilename(filename)}`;
}

export async function writeBatchToDirectory(
  dirHandle: FileSystemDirectoryHandle | any,
  filename: string,
  content: string | Uint8Array | ArrayBuffer
): Promise<{ bytesWritten: number; filename: string }> {
  const bytes = content instanceof Uint8Array
    ? content.byteLength
    : content instanceof ArrayBuffer
      ? content.byteLength
      : new Blob([content]).size;

  if (dirHandle.kind === 'tauri-dir') {
    const filePath = joinTauriPath(dirHandle.path, filename);
    if (typeof content === 'string') {
      await writeTextFile(filePath, content);
    } else {
      const u8 = content instanceof Uint8Array ? content : new Uint8Array(content);
      await writeFile(filePath, u8);
    }
    return { bytesWritten: bytes, filename };
  }

  if (dirHandle.kind === 'virtual-dir') {
    const mime = filename.endsWith('.json')
      ? 'application/json'
      : filename.endsWith('.csv')
      ? 'text/csv'
      : filename.endsWith('.xml')
      ? 'application/xml'
      : filename.endsWith('.sql')
      ? 'application/sql'
      : 'text/plain';
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mime });
    downloadFile(blob, filename, mime);
    return { bytesWritten: bytes, filename };
  }

  // @ts-ignore
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  await writable.write(content);
  await writable.close();
  return { bytesWritten: bytes, filename };
}

/**
 * Write multiple individual files directly to a selected directory
 */
export async function writeMultipleFilesToDirectory(
  dirHandle: FileSystemDirectoryHandle | any,
  files: Array<{ filename: string; content: string | Uint8Array }>,
  onProgress?: (writtenCount: number, totalCount: number) => void
): Promise<{ totalBytes: number; fileCount: number }> {
  let totalBytes = 0;

  if (dirHandle.kind === 'virtual-dir') {
    const zipEntries = files.map((f) => ({
      filename: f.filename,
      content: f.content,
    }));
    const zipBlob = await createZipArchive(zipEntries);
    const zipFilename = `${dirHandle.name || 'dataset'}_bundle.zip`;
    downloadFile(zipBlob, zipFilename, 'application/zip');
    for (const f of files) {
      totalBytes += typeof f.content === 'string' ? new Blob([f.content]).size : f.content.byteLength;
    }
    if (onProgress) onProgress(files.length, files.length);
    return { totalBytes, fileCount: files.length };
  }

  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    const res = await writeBatchToDirectory(dirHandle, item.filename, item.content);
    totalBytes += res.bytesWritten;
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return { totalBytes, fileCount: files.length };
}

export interface StreamFileWriter {
  writeRow: (row: Record<string, unknown>, rowIndex: number) => Promise<void>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
  getBytesWritten: () => number;
}

export async function createStreamFileWriter(
  dirHandle: FileSystemDirectoryHandle | any,
  filename: string,
  columns: ColumnSpec[],
  format: ExportFormat,
  tableName: string = 'synthetic_records'
): Promise<StreamFileWriter> {
  if (!dirHandle) {
    throw new Error('No output folder selected for streaming.');
  }
  if (format === 'xlsx' || format === 'xls') {
    throw new Error('Excel formats cannot be streamed row-by-row. Use CSV/JSONL for live streaming, or batch mode for Excel.');
  }
  let writable: FileSystemWritableFileStream | null = null;
  const isTauriDir = dirHandle.kind === 'tauri-dir';
  const isVirtualDir = dirHandle.kind === 'virtual-dir';
  const filePath = isTauriDir ? joinTauriPath(dirHandle.path, filename) : filename;
  let accumulatedVirtualContent = '';

  if (isTauriDir) {
    // Overwrite initially
    await writeTextFile(filePath, "");
  } else if (!isVirtualDir) {
    // @ts-ignore
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    // @ts-ignore
    writable = await fileHandle.createWritable({ keepExistingData: false });
  }

  const colNames = columns.map((c) => c.name);
  const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'synthetic_records';
  let bytesWritten = 0;
  let buffer = '';
  let flushTimer: any = null;
  let rowsWritten = 0; // own counter: the JSON comma logic must not depend on caller indexing

  const flushBuffer = async () => {
    if (buffer.length > 0) {
      const dataToWrite = buffer;
      buffer = '';
      if (isVirtualDir) {
        accumulatedVirtualContent += dataToWrite;
      } else if (writable) {
        await writable.write(dataToWrite);
      } else {
        await writeTextFile(filePath, dataToWrite, { append: true });
      }
      bytesWritten += new Blob([dataToWrite]).size;
    }
  };

  // Write initial header for appropriate formats
  if (format === 'csv') {
    buffer += colNames.map(escapeCsv).join(',') + '\n';
  } else if (format === 'tsv') {
    buffer += colNames.map(sanitizeTsvCell).join('\t') + '\n';
  } else if (format === 'json') {
    buffer += '[\n';
  } else if (format === 'xml') {
    buffer += `<?xml version="1.0" encoding="UTF-8"?>\n<dataset table="${cleanTable}">\n`;
  }

  return {
    writeRow: async (row: Record<string, unknown>, _rowIndex?: number) => {
      let rowStr = '';
      if (format === 'csv') {
        rowStr = colNames.map((n) => escapeCsv(row[n])).join(',') + '\n';
      } else if (format === 'tsv') {
        rowStr = colNames.map((n) => sanitizeTsvCell(row[n])).join('\t') + '\n';
      } else if (format === 'jsonl') {
        rowStr = JSON.stringify(row) + '\n';
      } else if (format === 'txt') {
        const parts = colNames.map((n) => `${n}=${row[n] ?? ''}`);
        rowStr = parts.join(' | ') + '\n';
      } else if (format === 'xml') {
        rowStr = '  <record>\n';
        for (const col of colNames) {
          const val = row[col];
          const valStr = val === null || val === undefined ? '' : escapeXmlText(String(val));
          const tag = toXmlTag(col);
          rowStr += `    <${tag}>${valStr}</${tag}>\n`;
        }
        rowStr += '  </record>\n';
      } else if (format === 'sql') {
        const values = colNames.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return Number.isFinite(val) ? val.toString() : 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          const str = String(val).replace(/'/g, "''");
          return `'${str}'`;
        });
        const escapedCols = colNames.map((c) => `\`${c.replace(/`/g, '``')}\``).join(', ');
        rowStr = `INSERT INTO ${cleanTable} (${escapedCols}) VALUES (${values.join(', ')});\n`;
      } else if (format === 'json') {
        rowStr = (rowsWritten > 0 ? ',\n' : '') + '  ' + JSON.stringify(row);
      }

      rowsWritten += 1;
      buffer += rowStr;

      // Periodic or size-based flush
      if (buffer.length > 8192) {
        await flushBuffer();
      } else if (!flushTimer) {
        flushTimer = setTimeout(async () => {
          flushTimer = null;
          try {
            await flushBuffer();
          } catch (err) {
            console.warn('Stream background flush failed:', err);
          }
        }, 150);
      }
    },
    flush: async () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await flushBuffer();
    },
    close: async () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (format === 'json') {
        buffer += '\n]';
      } else if (format === 'xml') {
        buffer += '</dataset>\n';
      }
      await flushBuffer();
      if (writable) {
        await writable.close();
      } else if (isVirtualDir) {
        const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';
        const blob = new Blob([accumulatedVirtualContent], { type: mime });
        downloadFile(blob, filename, mime);
      }
    },
    getBytesWritten: () => bytesWritten + new Blob([buffer]).size,
  };
}

export interface MultiFileStreamWriter {
  writeRow: (row: Record<string, unknown>, rowIndex?: number) => Promise<void>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
  getBytesWritten: () => number;
  getFilesCount: () => number;
}

/**
 * Stream writer for Multi-File output (e.g. 1 file per row or N rows per file)
 */
export async function createMultiFileStreamWriter(
  dirHandle: FileSystemDirectoryHandle | any,
  filenameTemplate: string,
  columns: ColumnSpec[],
  format: ExportFormat,
  rowsPerFile: number = 1,
  tableName: string = 'synthetic_records',
  baseName?: string
): Promise<MultiFileStreamWriter> {
  if (!dirHandle) {
    throw new Error('No output folder selected for multi-file streaming.');
  }
  const safeRowsPerFile = Math.max(1, Math.floor(rowsPerFile) || 1);
  let fileIndex = 0;
  let currentFileRows: Record<string, unknown>[] = [];
  let totalBytesWritten = 0;
  const isVirtualDir = dirHandle.kind === 'virtual-dir';
  const virtualEntries: Array<{ filename: string; content: string | Uint8Array }> = [];

  const flushCurrentFile = async () => {
    if (currentFileRows.length === 0) return;
    fileIndex += 1;
    const outFilename = resolveMultiFilename(
      filenameTemplate,
      baseName || tableName,
      fileIndex,
      format,
      6
    );

    // Format rows using standard multi-file formatter (supports all formats & custom JSON)
    const content = formatSingleFileUnit(columns, currentFileRows, format, tableName);

    if (isVirtualDir) {
      virtualEntries.push({ filename: outFilename, content });
      totalBytesWritten += typeof content === 'string' ? new Blob([content]).size : (content as Uint8Array).byteLength;
    } else {
      const res = await writeBatchToDirectory(dirHandle, outFilename, content);
      totalBytesWritten += res.bytesWritten;
    }
    currentFileRows = [];
  };

  return {
    writeRow: async (row: Record<string, unknown>) => {
      currentFileRows.push(row);
      if (currentFileRows.length >= safeRowsPerFile) {
        await flushCurrentFile();
      }
    },
    flush: async () => {
      await flushCurrentFile();
    },
    close: async () => {
      await flushCurrentFile();
      if (isVirtualDir && virtualEntries.length > 0) {
        const zipBlob = await createZipArchive(virtualEntries);
        const zipName = `${dirHandle.name || 'dataset'}_bundle.zip`;
        downloadFile(zipBlob, zipName, 'application/zip');
      }
    },
    getBytesWritten: () => totalBytesWritten,
    getFilesCount: () => fileIndex,
  };
}

function sanitizeTsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\t\r\n]/g, ' ');
}

function escapeXmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
