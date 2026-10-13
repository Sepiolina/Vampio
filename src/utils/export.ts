import { ColumnSpec, ExportFormat, CustomJsonConfig } from '../types';
import { renderCustomJsonTemplate } from './customJsonTemplate';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/** Valid XML element name from an arbitrary column name (cannot start with a digit/dash). */
export function toXmlTag(name: string): string {
  let tag = name.replace(/[^a-zA-Z0-9_]/g, '_') || 'field';
  if (/^[0-9-]/.test(tag)) tag = `_${tag}`;
  return tag;
}

function quoteSqlIdent(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

function sanitizeTsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\t\r\n]/g, ' ');
}

export function formatDataset(
  specs: ColumnSpec[],
  rows: Record<string, unknown>[],
  format: ExportFormat,
  tableName: string = 'synthetic_data',
  customJsonConfig?: CustomJsonConfig
): string | Uint8Array {
  const colNames = specs.map((c) => c.name);

  switch (format) {
    case 'csv': {
      const header = colNames.map(escapeCsv).join(',');
      const lines = rows.map((row) =>
        colNames.map((name) => escapeCsv(row[name])).join(',')
      );
      return [header, ...lines].join('\n');
    }

    case 'tsv': {
      const header = colNames.map(sanitizeTsvCell).join('\t');
      const lines = rows.map((row) => colNames.map((name) => sanitizeTsvCell(row[name])).join('\t'));
      return [header, ...lines].join('\n');
    }

    case 'json': {
      if (customJsonConfig?.enabled) {
        return renderCustomJsonTemplate(customJsonConfig, rows, {
          tableName,
          count: rows.length,
          timestamp: new Date().toISOString(),
        });
      }
      return JSON.stringify(rows, null, 2);
    }

    case 'jsonl': {
      return rows.map((r) => JSON.stringify(r)).join('\n');
    }

    case 'sql': {
      const escapedCols = colNames.map(quoteSqlIdent).join(', ');
      const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'synthetic_records';
      
      const statements = rows.map((row) => {
        const values = colNames.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return Number.isFinite(val) ? val.toString() : 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          const str = String(val).replace(/'/g, "''");
          return `'${str}'`;
        });
        return `INSERT INTO ${cleanTable} (${escapedCols}) VALUES (${values.join(', ')});`;
      });

      return statements.join('\n');
    }

    case 'xlsx': {
      return formatExcelDataset(specs, rows, 'xlsx', tableName);
    }

    case 'xls': {
      return formatExcelDataset(specs, rows, 'biff8', tableName);
    }

    case 'xml': {
      const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'record';
      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<dataset table="${cleanTable}" count="${rows.length}">`
      ];
      for (const row of rows) {
        lines.push(`  <record>`);
        for (const col of colNames) {
          const val = row[col];
          const valStr = val === null || val === undefined ? '' : escapeXml(String(val));
          const cleanTag = toXmlTag(col);
          lines.push(`    <${cleanTag}>${valStr}</${cleanTag}>`);
        }
        lines.push(`  </record>`);
      }
      lines.push('</dataset>');
      return lines.join('\n');
    }

    case 'txt': {
      return rows.map((row) => {
        const parts = colNames.map((col) => {
          const val = row[col];
          return `${col}=${val === null || val === undefined ? '' : val}`;
        });
        return parts.join(' | ');
      }).join('\n');
    }

    default:
      return '';
  }
}

/**
 * Format a single row or subset for multi-file exports (e.g. 1 file per row)
 */
export function formatSingleFileUnit(
  specs: ColumnSpec[],
  rows: Record<string, unknown>[],
  format: ExportFormat,
  tableName: string = 'synthetic_data',
  customJsonConfig?: CustomJsonConfig
): string | Uint8Array {
  if (customJsonConfig?.enabled && format === 'json') {
    return formatDataset(specs, rows, format, tableName, customJsonConfig);
  }
  // If 1 row and format is JSON, export object directly rather than single-element array if requested,
  // or structured log line for TXT.
  if (rows.length === 1) {
    if (format === 'json') {
      return JSON.stringify(rows[0], null, 2);
    }
    if (format === 'txt') {
      const colNames = specs.map((c) => c.name);
      return colNames
        .map((col) => `${col}: ${rows[0][col] === null || rows[0][col] === undefined ? '' : rows[0][col]}`)
        .join('\n');
    }
  }
  return formatDataset(specs, rows, format, tableName, customJsonConfig);
}

/**
 * Resolves a multi-file filename pattern with placeholders.
 * Handles {filename}, {tableName}, {table}, {index}, {seq}, {ext}, {extension}, {format}.
 * Also guarantees the resulting filename has a valid extension matching the export format.
 */
export function resolveMultiFilename(
  pattern: string = '{filename}_{index}.{ext}',
  baseName: string = 'record',
  index: number = 1,
  format: string = 'csv',
  padLength: number = 5
): string {
  const cleanBase = (baseName || 'record').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '') || 'record';
  const cleanExt = (format || 'csv').replace(/^\./, '').toLowerCase();
  const indexStr = String(index).padStart(padLength, '0');

  let resolved = pattern || '{filename}_{index}.{ext}';

  // 1. Replace base name variants (case-insensitive and global)
  resolved = resolved.replace(/\{(?:filename|table|tableName)\}/gi, cleanBase);

  // 2. Replace index variants (e.g. {index}, {idx}, {seq}, {i})
  resolved = resolved.replace(/\{(?:index|idx|seq|i)\}/gi, indexStr);

  // 3. Replace extension variants:
  // First handle `.{ext}`, `.{extension}`, `.{format}`
  resolved = resolved.replace(/\.\{(?:ext|extension|format)\}/gi, `.${cleanExt}`);
  // Then handle `{ext}`, `{extension}`, `{format}` without leading dot
  resolved = resolved.replace(/\{(?:ext|extension|format)\}/gi, cleanExt);

  // 4. Handle double-dot accidental typos like `..csv`
  resolved = resolved.replace(/\.+/g, '.');

  // 5. If any unreplaced `.{ext}` or `{ext}` persists due to weird casing or typos:
  resolved = resolved.replace(/\.\{ext\}/gi, `.${cleanExt}`);
  resolved = resolved.replace(/\{ext\}/gi, cleanExt);

  // 6. If the pattern does not end with any file extension (or ends with a trailing dot or separator),
  // ensure the correct format extension is attached
  const validExtensions = ['csv', 'tsv', 'json', 'jsonl', 'txt', 'xml', 'sql', 'xlsx', 'xls'];
  const hasKnownExt = validExtensions.some((ext) => resolved.toLowerCase().endsWith(`.${ext}`));

  if (!hasKnownExt) {
    resolved = `${resolved.replace(/\.+$/, '')}.${cleanExt}`;
  }

  return resolved;
}

/**
 * Excel builder using SheetJS (XLSX / XLS)
 */
export function formatExcelDataset(
  specs: ColumnSpec[],
  rows: Record<string, unknown>[],
  bookType: 'xlsx' | 'biff8' = 'xlsx',
  sheetName: string = 'Sheet1'
): Uint8Array {
  const colNames = specs.map((c) => c.name);
  const cleanSheetName = (sheetName || 'Data').replace(/[\\/?*[\]]/g, '_').slice(0, 31);
  const ws = XLSX.utils.json_to_sheet(rows, { header: colNames });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  const out = XLSX.write(wb, { bookType, type: 'array' });
  return new Uint8Array(out);
}

/**
 * Append new rows directly into an existing XLSX/XLS workbook or create a new one
 */
export function appendRowsToWorkbook(
  existingWb: any,
  newRows: Record<string, unknown>[],
  colNames: string[],
  targetSheetName?: string,
  bookType: 'xlsx' | 'biff8' = 'xlsx',
  sheetMode: 'active_sheet' | 'new_sheet' = 'active_sheet',
  newSheetName?: string
): Uint8Array {
  let wb = existingWb;
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    wb = XLSX.utils.book_new();
  }

  if (sheetMode === 'new_sheet') {
    let desiredName = (newSheetName || 'Appended_Data').trim().replace(/[\\/?*[\]]/g, '_').slice(0, 31);
    if (!desiredName) desiredName = 'Appended_Data';
    // ensure unique sheet name
    let finalSheetName = desiredName;
    let counter = 1;
    while (wb.SheetNames.includes(finalSheetName)) {
      finalSheetName = `${desiredName.slice(0, 28)}_${counter++}`;
    }
    const ws = XLSX.utils.json_to_sheet(newRows, { header: colNames });
    XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
  } else {
    const sheetName = targetSheetName && wb.Sheets[targetSheetName]
      ? targetSheetName
      : (wb.SheetNames[0] || 'Sheet1');

    let ws = wb.Sheets[sheetName];
    if (!ws) {
      ws = XLSX.utils.json_to_sheet(newRows, { header: colNames });
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } else {
      // Append rows to existing worksheet
      XLSX.utils.sheet_add_json(ws, newRows, {
        header: colNames,
        skipHeader: true,
        origin: -1 // appends below the last row
      });
    }
  }

  const out = XLSX.write(wb, { bookType, type: 'array' });
  return new Uint8Array(out);
}

/**
 * Append formatted rows to an existing raw text/content string (CSV, TSV, JSON, JSONL, TXT, XML, SQL)
 */
export function appendRowsToTextFile(
  existingContent: string,
  specs: ColumnSpec[],
  newRows: Record<string, unknown>[],
  format: ExportFormat,
  skipDuplicateHeaders: boolean = true,
  tableName: string = 'synthetic_records'
): string {
  const colNames = specs.map((c) => c.name);

  if (format === 'csv') {
    let lines = newRows.map((row) =>
      colNames.map((name) => escapeCsv(row[name])).join(',')
    );
    if (!skipDuplicateHeaders) {
      lines = [colNames.map((c) => escapeCsv(c)).join(','), ...lines];
    }
    const trimmed = existingContent.trimEnd();
    return trimmed ? `${trimmed}\n${lines.join('\n')}` : lines.join('\n');
  }

  if (format === 'tsv') {
    let lines = newRows.map((row) => colNames.map((name) => sanitizeTsvCell(row[name])).join('\t'));
    if (!skipDuplicateHeaders) {
      lines = [colNames.map(sanitizeTsvCell).join('\t'), ...lines];
    }
    const trimmed = existingContent.trimEnd();
    return trimmed ? `${trimmed}\n${lines.join('\n')}` : lines.join('\n');
  }

  if (format === 'json') {
    if (!existingContent.trim()) {
      return JSON.stringify(newRows, null, 2);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(existingContent);
    } catch {
      throw new Error('Existing JSON file is not valid JSON, refusing to overwrite it. Fix the file or choose a different output file.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Existing JSON file is not a top-level array, so new rows cannot be appended safely.');
    }
    return JSON.stringify([...parsed, ...newRows], null, 2);
  }

  if (format === 'jsonl') {
    const lines = newRows.map((r) => JSON.stringify(r)).join('\n');
    const trimmed = existingContent.trimEnd();
    return trimmed ? `${trimmed}\n${lines}` : lines;
  }

  if (format === 'txt') {
    const lines = newRows.map((row) => {
      const parts = colNames.map((col) => `${col}=${row[col] ?? ''}`);
      return parts.join(' | ');
    }).join('\n');
    const trimmed = existingContent.trimEnd();
    return trimmed ? `${trimmed}\n${lines}` : lines;
  }

  if (format === 'xml') {
    const newRecordsXml = newRows
      .map((row) => {
        const fields = colNames
          .map((col) => {
            const safeTag = toXmlTag(col);
            const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
            return `    <${safeTag}>${escapeXml(val)}</${safeTag}>`;
          })
          .join('\n');
        return `  <record>\n${fields}\n  </record>`;
      })
      .join('\n');

    const trimmed = existingContent.trim();
    const closeIdx = trimmed.lastIndexOf('</dataset>');
    if (closeIdx !== -1) {
      // Splice by index: String.replace would interpret "$&", "$1" ... inside the data
      return `${trimmed.slice(0, closeIdx).trimEnd()}\n${newRecordsXml}\n</dataset>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<dataset>\n${newRecordsXml}\n</dataset>`;
    }
  }

  if (format === 'sql') {
    const cleanTable = (tableName || '').replace(/[^a-zA-Z0-9_]/g, '_') || 'synthetic_records';
    const quotedCols = colNames.map(quoteSqlIdent).join(', ');
    const lines = newRows.map((row) => {
      const vals = colNames.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      return `INSERT INTO ${cleanTable} (${quotedCols}) VALUES (${vals.join(', ')});`;
    });
    const trimmed = existingContent.trimEnd();
    return trimmed ? `${trimmed}\n${lines.join('\n')}` : lines.join('\n');
  }

  return formatDataset(specs, newRows, format, tableName) as string;
}

/**
 * Packages an array of individual generated files into a downloadable ZIP archive
 */
export async function createZipArchive(
  files: Array<{ filename: string; content: string | Uint8Array }>
): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.filename, f.content);
  }
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadFile(
  content: string | Uint8Array | ArrayBuffer | Blob,
  filename: string,
  mimeType: string
): void {
  const blob = content instanceof Blob
    ? content
    : new Blob([content as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv;charset=utf-8;';
    case 'tsv':
      return 'text/tab-separated-values;charset=utf-8;';
    case 'json':
      return 'application/json;charset=utf-8;';
    case 'jsonl':
      return 'application/x-ndjson;charset=utf-8;';
    case 'sql':
      return 'application/sql;charset=utf-8;';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xml':
      return 'application/xml;charset=utf-8;';
    case 'txt':
      return 'text/plain;charset=utf-8;';
    default:
      return 'text/plain;charset=utf-8;';
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export interface DatasetDownloadResult {
  content: string | Uint8Array;
  blob: Blob;
  sizeBytes: number;
}

export function downloadDataset(
  specs: ColumnSpec[],
  rows: Record<string, unknown>[],
  format: ExportFormat,
  _filename?: string,
  tableName: string = 'synthetic_data',
  customJsonConfig?: CustomJsonConfig
): DatasetDownloadResult {
  const content = formatDataset(specs, rows, format, tableName, customJsonConfig);
  const mimeType = getMimeType(format);
  const blob = new Blob([content as BlobPart], { type: mimeType });
  const sizeBytes = blob.size;
  return { content, blob, sizeBytes };
}
