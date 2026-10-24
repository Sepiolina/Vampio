import type { VampioWorkspaceProfileBundle } from './folderBehaviorAnalyzer';
import type { ColumnSpec, ExportFormat, OutputStrategy, WorkspaceSession } from '../types';

const FORMATS: ExportFormat[] = ['csv', 'tsv', 'json', 'jsonl', 'txt', 'sql', 'xml', 'xls', 'xlsx'];
const STRATEGIES: OutputStrategy[] = ['single', 'multi_file', 'append_existing'];
const COLUMN_TYPES = new Set(['String', 'Int', 'Float', 'Boolean', 'UUID', 'DateTime', 'RegEx', 'Set/Enum', 'Sequence', 'Blob/Hex', 'Calculation', 'Entity', 'REST_API']);
const isRecord = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isPositive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isCount = (value: unknown) => isPositive(value) && Number.isInteger(value);

/** Validate the fields consumed by the importer before a profile can reach React or the generator. */
export function parseWorkspaceProfileBundle(jsonText: string): { valid: boolean; error?: string; bundle?: VampioWorkspaceProfileBundle } {
  if (jsonText.length > 10 * 1024 * 1024) return { valid: false, error: 'Profile exceeds the 10 MiB import limit.' };
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return { valid: false, error: `JSON Parse error: ${error instanceof Error ? error.message : 'Invalid syntax'}` };
  }
  const invalid = (error: string) => ({ valid: false, error });
  if (!isRecord(parsed)) return invalid('File content is not a valid JSON object.');
  if (!isRecord(parsed.vampioWorkspace) || !Array.isArray(parsed.vampioWorkspace.columns)) {
    return invalid('Missing vampioWorkspace schema configuration or columns array.');
  }
  if (parsed.version !== '1.0.0') return invalid('Unsupported profile version. Expected 1.0.0.');
  if (!isRecord(parsed.source) || !isText(parsed.source.folderName) || !['web', 'tauri'].includes(parsed.source.platform)) {
    return invalid('Invalid source: folderName and platform (web or tauri) are required.');
  }
  if (parsed.source.folderPath !== undefined && typeof parsed.source.folderPath !== 'string') return invalid('Invalid source folder path.');
  if (!isRecord(parsed.metrics) || !isRecord(parsed.forensics)) return invalid('Incomplete bundle: missing folder metrics or forensics profiles.');
  if (!Number.isInteger(parsed.metrics.totalFiles) || parsed.metrics.totalFiles < 0 ||
    !Number.isFinite(parsed.metrics.totalSizeBytes) || parsed.metrics.totalSizeBytes < 0) {
    return invalid('Invalid folder metrics: nonnegative file count and byte size are required.');
  }
  if (!isText(parsed.forensics.encoding) || !isText(parsed.forensics.dominantExtension) || !isText(parsed.forensics.fileLockStatus) ||
    (parsed.forensics.delimiterName !== undefined && typeof parsed.forensics.delimiterName !== 'string')) {
    return invalid('Invalid forensics: encoding, extension, and access status are required.');
  }
  const workspace = parsed.vampioWorkspace;
  if (!isText(workspace.tableName) || !FORMATS.includes(workspace.format) || !STRATEGIES.includes(workspace.outputStrategy)) {
    return invalid('Invalid simulation settings: table name, supported output format, and output strategy are required.');
  }
  if (!isText(workspace.filenamePattern) || !isPositive(workspace.intervalMs) ||
    (workspace.rowsPerFile !== undefined && !isCount(workspace.rowsPerFile)) ||
    (workspace.batchCount !== undefined && !isCount(workspace.batchCount)) ||
    (workspace.generationMode !== undefined && !['Batch', 'Continuous'].includes(workspace.generationMode)) ||
    (workspace.filename !== undefined && !isText(workspace.filename))) {
    return invalid('Invalid simulation settings: check the filename, positive interval, row counts, and generation mode.');
  }
  if (workspace.columns.length === 0 || workspace.columns.length > 1000) return invalid('A simulation profile needs between 1 and 1,000 columns.');
  const names = new Set<string>();
  const ids = new Set<string>();
  for (let index = 0; index < workspace.columns.length; index++) {
    const column = workspace.columns[index];
    if (!isRecord(column) || !isText(column.id) || !isText(column.name) || !isText(column.type) ||
      (!COLUMN_TYPES.has(column.type) && !column.type.startsWith('custom:')) || typeof column.rule !== 'string' ||
      typeof column.condition !== 'string' || !Number.isFinite(column.skip_pct) || column.skip_pct < 0 || column.skip_pct > 100) {
      return invalid(`Invalid column ${index + 1}: provide an ID, name, supported type, rule, condition, and null percentage (0–100).`);
    }
    if (['__proto__', 'constructor', 'prototype'].includes(column.name)) return invalid(`Column ${index + 1} uses a reserved name.`);
    if (names.has(column.name.toLowerCase()) || ids.has(column.id)) return invalid(`Duplicate column name or ID at column ${index + 1}.`);
    names.add(column.name.toLowerCase());
    ids.add(column.id);
    if (column.dependencyCases !== undefined && (!Array.isArray(column.dependencyCases) || column.dependencyCases.some(item =>
      !isRecord(item) || !isText(item.id) || typeof item.value !== 'string' ||
      !['equals', 'not_equals', 'is_null', 'is_not_null', 'contains', 'greater_than', 'less_than'].includes(item.operator) ||
      !['skip', 'set_value', 'type_override'].includes(item.action) ||
      (item.parentColumn !== undefined && typeof item.parentColumn !== 'string') ||
      (item.actionValue !== undefined && typeof item.actionValue !== 'string') ||
      (item.actionType !== undefined && (!isText(item.actionType) || (!COLUMN_TYPES.has(item.actionType) && !item.actionType.startsWith('custom:'))))))) {
      return invalid(`Invalid dependency cases in column ${index + 1}.`);
    }
  }
  return { valid: true, bundle: parsed as VampioWorkspaceProfileBundle };
}

/** Import into a separate output by default; never reuse a monitored directory or append target. */
export type ImportedWorkspaceSettings = Partial<WorkspaceSession> & Pick<WorkspaceSession, 'name' | 'columns'>;

export function workspaceSettingsFromProfile(bundle: VampioWorkspaceProfileBundle): ImportedWorkspaceSettings {
  const config = bundle.vampioWorkspace;
  const baseName = (config.filename || config.tableName || 'log').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '') || 'log';
  const filename = baseName.endsWith('_simulation') ? baseName : `${baseName}_simulation`;
  return {
    name: `${bundle.source.folderName} simulation`,
    tableName: config.tableName,
    columns: config.columns.map((column: ColumnSpec) => ({ ...column })),
    format: config.format,
    count: config.batchCount || 1000,
    intervalMs: config.intervalMs,
    generationMode: config.generationMode || 'Batch',
    filename,
    outputDestination: 'download',
    selectedFolderName: null,
    outputStrategy: config.outputStrategy === 'append_existing' ? 'single' : config.outputStrategy,
    multiFileConfig: {
      enabled: config.outputStrategy === 'multi_file',
      filenamePattern: config.filenamePattern,
      rowsPerFile: config.rowsPerFile || 1000,
      packageAsZip: true,
    },
    customJsonConfig: undefined,
  };
}
