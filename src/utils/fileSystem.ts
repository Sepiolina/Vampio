import { ColumnSpec, ExportFormat } from '../types';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

export function isFileSystemAccessSupported(): boolean {
  if (isTauri()) return true;
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

export async function requestDirectoryHandle(): Promise<FileSystemDirectoryHandle | any | null> {
  if (isTauri()) {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected === null) {
      return null;
    }
    const path = Array.isArray(selected) ? selected[0] : selected;
    const name = path.split(/[\\/]/).pop() || path;
    return { kind: 'tauri-dir', path, name };
  }

  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser.');
  }

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
      throw new Error('Access to local directory was denied by browser security policy. This often occurs inside embedded iframes. Opening the app in a new browser tab allows full directory write access.');
    }
    throw err;
  }
}

export async function writeBatchToDirectory(
  dirHandle: FileSystemDirectoryHandle | any,
  filename: string,
  content: string
): Promise<{ bytesWritten: number; filename: string }> {
  if (dirHandle.kind === 'tauri-dir') {
    const filePath = `${dirHandle.path}/${filename}`;
    await writeTextFile(filePath, content);
    return { bytesWritten: new Blob([content]).size, filename };
  }

  // @ts-ignore
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  await writable.write(content);
  await writable.close();
  const bytes = new Blob([content]).size;
  return { bytesWritten: bytes, filename };
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
  const filePath = isTauriDir ? `${dirHandle.path}/${filename}` : filename;

  if (!isTauriDir) {
    // @ts-ignore
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    // @ts-ignore
    writable = await fileHandle.createWritable({ keepExistingData: false });
  } else {
    // Overwrite initially
    await writeTextFile(filePath, "");
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
      if (writable) {
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
      }
      await flushBuffer();
      if (writable) {
        await writable.close();
      }
    },
    getBytesWritten: () => bytesWritten + new Blob([buffer]).size,
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
