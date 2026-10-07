import { ColumnSpec, ExportFormat } from '../types';
import { isTauri as coreIsTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { downloadFile, createZipArchive } from './export';

// Ensure global Tauri detection is immediately populated
if (typeof window !== 'undefined') {
  if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) {
    (window as any).isTauri = true;
  }
}

/**
 * Robustly checks if running inside the Tauri native desktop application (.exe, macOS, Linux).
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

/**
 * Creates a Virtual Directory Handle for safe, portable operations in browser / iframe environments.
 */
export function createVirtualDirectoryHandle(name: string, path?: string): any {
  const cleanName = name.trim().replace(/^[/\\]+/, '') || 'output_folder';
  return {
    kind: 'virtual-dir',
    name: cleanName,
    path: path || cleanName,
    files: [],
  };
}

export async function requestDirectoryHandle(): Promise<FileSystemDirectoryHandle | any | null> {
  // 1. Native Desktop App (Tauri)
  if (isTauri()) {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Output Directory',
      });
      if (selected === null) {
        return null;
      }
      const path = Array.isArray(selected) ? selected[0] : selected;
      const name = path.split(/[\\/]/).pop() || path;
      return { kind: 'tauri-dir', path, name };
    } catch (err: any) {
      console.error('Tauri native directory picker failed:', err);
      throw new Error(`Desktop folder picker error: ${err.message || String(err)}`);
    }
  }

  // 2. Embedded Iframe Environment
  if (isEmbeddedIframe()) {
    const err: any = new Error(
      'Access to local directory was denied by browser security policy. This often occurs inside embedded iframes. Opening the app in a new browser tab allows full directory write access.'
    );
    err.name = 'SecurityError';
    err.isIframe = true;
    throw err;
  }

  // 3. Web Browser without File System Access API
  if (!isFileSystemAccessSupported()) {
    const err: any = new Error('File System Access API is not supported in this browser.');
    err.name = 'NotSupportedError';
    throw err;
  }

  // 4. Standard Browser with File System Access API
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads',
    });
    return handle as FileSystemDirectoryHandle;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User cancelled picker dialog
      return null;
    }
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
    const filePath = `${dirHandle.path}/${filename}`;
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
  let writable: FileSystemWritableFileStream | null = null;
  const isTauriDir = dirHandle.kind === 'tauri-dir';
  const isVirtualDir = dirHandle.kind === 'virtual-dir';
  const filePath = isTauriDir ? `${dirHandle.path}/${filename}` : filename;
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
    buffer += colNames.join('\t') + '\n';
  } else if (format === 'json') {
    buffer += '[\n';
  } else if (format === 'xml') {
    buffer += `<?xml version="1.0" encoding="UTF-8"?>\n<dataset table="${cleanTable}">\n`;
  }

  return {
    writeRow: async (row: Record<string, unknown>, rowIndex: number) => {
      let rowStr = '';
      if (format === 'csv') {
        rowStr = colNames.map((n) => escapeCsv(row[n])).join(',') + '\n';
      } else if (format === 'tsv') {
        rowStr = colNames.map((n) => {
          const val = row[n];
          if (val === null || val === undefined) return '';
          return String(val).replace(/\t|\n/g, ' ');
        }).join('\t') + '\n';
      } else if (format === 'jsonl') {
        rowStr = JSON.stringify(row) + '\n';
      } else if (format === 'txt') {
        const parts = colNames.map((n) => `${n}=${row[n] ?? ''}`);
        rowStr = parts.join(' | ') + '\n';
      } else if (format === 'xml') {
        rowStr = '  <record>\n';
        for (const col of colNames) {
          const val = row[col];
          const valStr = val === null || val === undefined ? '' : String(val);
          rowStr += `    <${col}>${valStr}</${col}>\n`;
        }
        rowStr += '  </record>\n';
      } else if (format === 'sql') {
        const values = colNames.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return isNaN(val) ? 'NULL' : val.toString();
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          const str = String(val).replace(/'/g, "''");
          return `'${str}'`;
        });
        const escapedCols = colNames.map((c) => `\`${c}\``).join(', ');
        rowStr = `INSERT INTO ${cleanTable} (${escapedCols}) VALUES (${values.join(', ')});\n`;
      } else if (format === 'json') {
        rowStr = (rowIndex > 0 ? ',\n' : '') + '  ' + JSON.stringify(row);
      }

      buffer += rowStr;

      // Periodic or size-based flush
      if (buffer.length > 8192) {
        await flushBuffer();
      } else if (!flushTimer) {
        flushTimer = setTimeout(async () => {
          flushTimer = null;
          await flushBuffer();
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
  tableName: string = 'synthetic_records'
): Promise<MultiFileStreamWriter> {
  let fileIndex = 0;
  let currentFileRows: Record<string, unknown>[] = [];
  let totalBytesWritten = 0;
  const isVirtualDir = dirHandle.kind === 'virtual-dir';
  const virtualEntries: Array<{ filename: string; content: string | Uint8Array }> = [];

  const flushCurrentFile = async () => {
    if (currentFileRows.length === 0) return;
    fileIndex += 1;
    const numStr = String(fileIndex).padStart(6, '0');
    const outFilename = filenameTemplate
      .replace('{index}', numStr)
      .replace('{filename}', tableName);

    // Format rows
    let content: string | Uint8Array;
    if (currentFileRows.length === 1 && format === 'json') {
      content = JSON.stringify(currentFileRows[0], null, 2);
    } else if (currentFileRows.length === 1 && format === 'txt') {
      const colNames = columns.map((c) => c.name);
      content = colNames.map((c) => `${c}: ${currentFileRows[0][c] ?? ''}`).join('\n');
    } else {
      const colNames = columns.map((c) => c.name);
      if (format === 'csv') {
        const header = colNames.map(escapeCsv).join(',');
        const lines = currentFileRows.map((r) => colNames.map((n) => escapeCsv(r[n])).join(','));
        content = [header, ...lines].join('\n');
      } else {
        content = currentFileRows.map((r) => JSON.stringify(r)).join('\n');
      }
    }

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
      if (currentFileRows.length >= rowsPerFile) {
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

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
