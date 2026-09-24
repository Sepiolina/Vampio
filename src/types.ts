export type StandardColumnType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'UUID'
  | 'DateTime'
  | 'RegEx'
  | 'Set/Enum'
  | 'Sequence'
  | 'Blob/Hex'
  | 'Calculation'
  | 'Entity'
  | 'REST_API';

export type ColumnType = StandardColumnType | `custom:${string}` | (string & {});

export type EntitySubtype =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'company'
  | 'job_title'
  | 'country'
  | 'city'
  | 'ip_address'
  | 'user_agent'
  | 'url';

export interface DependencyCase {
  id: string;
  parentColumn?: string;
  operator: 'equals' | 'not_equals' | 'is_null' | 'is_not_null' | 'contains' | 'greater_than' | 'less_than';
  value: string;
  action: 'skip' | 'set_value' | 'type_override';
  actionValue?: string;
  actionType?: ColumnType;
}

export interface ColumnSpec {
  id: string;
  name: string;
  type: ColumnType;
  rule: string;
  skip_pct: number; // 0 to 100
  condition: string; // ID or Name of parent column: if parent is null/skipped, this is also null
  dependencyCases?: DependencyCase[];
  fallbackAction?: 'normal' | 'skip' | 'set_value';
  fallbackValue?: string;
  customTypeId?: string;
  notes?: string;
}

export type ThemeId =
  | 'theme-slate'
  | 'theme-cream'
  | 'theme-nordic'
  | 'theme-sage'
  | 'theme-lavender'
  | 'theme-sandstone'
  | 'theme-rose'
  | 'theme-strawberry'
  | 'theme-kiwi'
  | 'theme-neon';

export type ExportFormat = 'csv' | 'json' | 'jsonl' | 'sql' | 'tsv' | 'xlsx' | 'xls' | 'xml' | 'txt';

export type OutputDestination = 'download' | 'folder';

export type OutputStrategy = 'single' | 'multi_file' | 'append_existing';

export interface MultiFileConfig {
  enabled: boolean;
  rowsPerFile: number; // e.g. 1 for 1 file per row, or 10, 100
  filenamePattern: string; // e.g. "{filename}_{index}.{ext}"
  packageAsZip: boolean;
}

export interface AppendConfig {
  autoContinueSequence: boolean;
  manualStartOffset?: number;
  skipDuplicateHeaders: boolean;
  excelSheetMode: 'active_sheet' | 'new_sheet';
  newSheetName: string;
  targetSheetName?: string;
  saveMode: 'overwrite' | 'suffix';
  suffix: string;
}

export interface ImportedFileContext {
  filename: string;
  format: ExportFormat | string;
  totalRows: number;
  startingRowNumber: number; // e.g. totalRows + 1
  headers: string[];
  rawWorkbook?: any; // XLSX workbook object for direct sheet appending
  rawFile?: File;
  rawRows?: any[][];
  rawContent?: string;
  targetSheetName?: string;
  sheetNames?: string[];
}

export interface GeneratorStats {
  rowsGenerated: number;
  rowsPerSec: number;
  elapsedSeconds: number;
  fileSizeBytes: number;
  isGenerating: boolean;
  filesGenerated?: number;
}

export interface PresetSchema {
  id: string;
  name: string;
  description: string;
  category: string;
  tableName: string;
  columns: ColumnSpec[];
}
