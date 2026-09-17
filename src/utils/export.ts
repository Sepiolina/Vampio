import { ColumnSpec, ExportFormat } from '../types';

export function formatDataset(
  specs: ColumnSpec[],
  rows: Record<string, unknown>[],
  format: ExportFormat,
  tableName: string = 'synthetic_data'
): string {
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
      const header = colNames.join('\t');
      const lines = rows.map((row) =>
        colNames
          .map((name) => {
            const val = row[name];
            if (val === null || val === undefined) return '';
            return String(val).replace(/\t|\n/g, ' ');
          })
          .join('\t')
      );
      return [header, ...lines].join('\n');
    }

    case 'json': {
      return JSON.stringify(rows, null, 2);
    }

    case 'jsonl': {
      return rows.map((r) => JSON.stringify(r)).join('\n');
    }

    case 'sql': {
      const escapedCols = colNames.map((c) => `\`${c}\``).join(', ');
      const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'synthetic_records';
      
      const statements = rows.map((row) => {
        const values = colNames.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return isNaN(val) ? 'NULL' : val.toString();
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          const str = String(val).replace(/'/g, "''");
          return `'${str}'`;
        });
        return `INSERT INTO ${cleanTable} (${escapedCols}) VALUES (${values.join(', ')});`;
      });

      return statements.join('\n');
    }

    default:
      return '';
  }
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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
    default:
      return 'text/plain;charset=utf-8;';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
