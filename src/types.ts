export type ColumnType =
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
  | 'Entity';

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

export type ExportFormat = 'csv' | 'json' | 'jsonl' | 'sql' | 'tsv';

export type OutputDestination = 'download' | 'folder';

export interface GeneratorStats {
  rowsGenerated: number;
  rowsPerSec: number;
  elapsedSeconds: number;
  fileSizeBytes: number;
  isGenerating: boolean;
}

export interface PresetSchema {
  id: string;
  name: string;
  description: string;
  category: string;
  tableName: string;
  columns: ColumnSpec[];
}
