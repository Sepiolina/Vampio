import { ColumnSpec, ColumnType, ExportFormat, OutputStrategy, PresetSchema } from '../types';
import { PRESET_SCHEMAS } from '../data/presets';

export interface DiscoveredFolderFile {
  name: string;
  size: number;
  lastModified: number;
  relativePath?: string;
  handle?: any;
  file?: File;
  sampleContent?: string;
}

export interface FolderBehaviorMetrics {
  totalFiles: number;
  totalSizeBytes: number;
  avgSizeBytes: number;
  minSizeBytes: number;
  maxSizeBytes: number;
  sizeVarianceType: 'uniform_micro' | 'uniform_medium' | 'monolithic_single' | 'mixed_heterogeneous' | 'empty';
  dominantFormat: ExportFormat;
  formatDistribution: Record<string, number>;
  temporalCadence: 'high_frequency_stream' | 'periodic_cadence' | 'static_batch_dump' | 'single_active_file' | 'unknown';
  avgTimeDeltaSeconds?: number;
  namingPattern?: {
    detected: boolean;
    pattern: string; // e.g. "{filename}_{index}.{ext}" or "sensor_{index}.jsonl"
    sampleMatch: string;
    hasSequenceDigits: boolean;
    hasDateStamp: boolean;
  };
}

export interface SuggestedModeConfig {
  outputStrategy: OutputStrategy;
  strategyConfidence: number; // 0 - 100
  strategyReason: string;
  format: ExportFormat;
  formatReason: string;
  outputDestination: 'folder';
  suggestedFilename: string;
  suggestedFilenamePattern?: string;
  suggestedRowsPerFile?: number;
  suggestedTargetFile?: string;
  suggestedBatchCount: number;
  suggestedIntervalMs: number;
  suggestedGenerationMode: 'Batch' | 'Continuous';
}

export interface ExtractedFolderColumn {
  name: string;
  inferredType: ColumnType;
  inferredRule: string;
  sampleValues: string[];
}

export interface SuggestedTemplateConfig {
  type: 'preset' | 'custom_extracted';
  presetId?: string;
  presetName?: string;
  category?: string;
  confidence: number; // 0 - 100
  reason: string;
  matchedKeywords: string[];
  columns: ColumnSpec[];
  tableName: string;
}

export interface FolderMonitorEvent {
  id: string;
  timestamp: string;
  type: 'scan' | 'file_added' | 'file_grown' | 'pattern_matched' | 'cadence_detected' | 'info';
  message: string;
  details?: string;
}

export interface FolderAnalysisResult {
  folderName: string;
  analyzedAt: string;
  metrics: FolderBehaviorMetrics;
  files: DiscoveredFolderFile[];
  suggestedMode: SuggestedModeConfig;
  suggestedTemplate: SuggestedTemplateConfig;
  extractedColumns: ExtractedFolderColumn[];
  sampleFileUsed?: string;
}

/**
 * 100% Offline directory reader using the standard File System Access API
 */
export async function readFolderFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle | any,
  sampleContentLimitBytes: number = 65536,
  maxFilesToReadContent: number = 3
): Promise<DiscoveredFolderFile[]> {
  const discovered: DiscoveredFolderFile[] = [];

  try {
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        try {
          const file = await entry.getFile();
          let sampleContent = '';

          // Read content for the first few files to analyze headers/structure
          if (discovered.length < maxFilesToReadContent) {
            const slice = file.slice(0, sampleContentLimitBytes);
            sampleContent = await slice.text();
          }

          discovered.push({
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            handle: entry,
            file,
            sampleContent: sampleContent || undefined,
          });
        } catch (fileErr) {
          console.warn('Could not inspect file entry:', entry.name, fileErr);
        }
      }
    }
  } catch (err) {
    console.error('Failed reading directory handle entries:', err);
  }

  return discovered;
}

/**
 * Read files from HTML Directory Input (<input type="file" webkitdirectory />)
 */
export async function readFilesFromHtmlFileList(
  fileList: FileList | File[],
  maxFilesToReadContent: number = 3,
  sampleContentLimitBytes: number = 65536
): Promise<DiscoveredFolderFile[]> {
  const files: File[] = Array.from(fileList);
  const discovered: DiscoveredFolderFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let sampleContent = '';
    if (i < maxFilesToReadContent) {
      try {
        const slice = file.slice(0, sampleContentLimitBytes);
        sampleContent = await slice.text();
      } catch (e) {
        console.warn('Sample read error:', file.name, e);
      }
    }

    discovered.push({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      relativePath: (file as any).webkitRelativePath || file.name,
      file,
      sampleContent: sampleContent || undefined,
    });
  }

  return discovered;
}

/**
 * 100% Offline Heuristic Analyzer:
 * Ingests file behavior, sizes, naming conventions, and sample content.
 * Produces deterministic mode suggestions and template recommendations.
 */
export function analyzeFolderFiles(
  files: DiscoveredFolderFile[],
  folderName: string = 'locked_folder'
): FolderAnalysisResult {
  const totalFiles = files.length;
  let totalSizeBytes = 0;
  let minSizeBytes = Infinity;
  let maxSizeBytes = 0;
  const formatDistribution: Record<string, number> = {};

  // Sort files by modified time ascending
  const sortedFiles = [...files].sort((a, b) => a.lastModified - b.lastModified);

  for (const f of sortedFiles) {
    totalSizeBytes += f.size;
    if (f.size < minSizeBytes) minSizeBytes = f.size;
    if (f.size > maxSizeBytes) maxSizeBytes = f.size;

    const ext = getExtension(f.name).toLowerCase();
    formatDistribution[ext] = (formatDistribution[ext] || 0) + 1;
  }

  if (minSizeBytes === Infinity) minSizeBytes = 0;
  const avgSizeBytes = totalFiles > 0 ? Math.round(totalSizeBytes / totalFiles) : 0;

  // 1. Determine size variance archetype
  let sizeVarianceType: FolderBehaviorMetrics['sizeVarianceType'] = 'mixed_heterogeneous';
  if (totalFiles === 0) {
    sizeVarianceType = 'empty';
  } else if (totalFiles === 1) {
    sizeVarianceType = totalSizeBytes > 500000 ? 'monolithic_single' : 'uniform_medium';
  } else {
    const ratio = minSizeBytes > 0 ? maxSizeBytes / minSizeBytes : maxSizeBytes;
    if (ratio <= 2.5 && avgSizeBytes < 150000) {
      sizeVarianceType = 'uniform_micro';
    } else if (ratio <= 3 && avgSizeBytes >= 150000) {
      sizeVarianceType = 'uniform_medium';
    } else if (maxSizeBytes > 2000000 && minSizeBytes < 50000) {
      sizeVarianceType = 'monolithic_single';
    }
  }

  // 2. Determine dominant format
  let dominantFormat: ExportFormat = 'csv';
  let highestCount = 0;
  for (const [ext, count] of Object.entries(formatDistribution)) {
    if (count > highestCount) {
      highestCount = count;
      const fmt = mapExtensionToExportFormat(ext);
      if (fmt) dominantFormat = fmt;
    }
  }

  // 3. Temporal cadence analysis
  let temporalCadence: FolderBehaviorMetrics['temporalCadence'] = 'static_batch_dump';
  let avgTimeDeltaSeconds: number | undefined = undefined;

  if (totalFiles > 1) {
    const deltas: number[] = [];
    for (let i = 1; i < sortedFiles.length; i++) {
      const delta = (sortedFiles[i].lastModified - sortedFiles[i - 1].lastModified) / 1000;
      if (delta > 0) deltas.push(delta);
    }

    if (deltas.length > 0) {
      const sumDelta = deltas.reduce((acc, d) => acc + d, 0);
      avgTimeDeltaSeconds = Math.round(sumDelta / deltas.length);

      if (avgTimeDeltaSeconds <= 120) {
        temporalCadence = 'high_frequency_stream';
      } else if (avgTimeDeltaSeconds <= 3600) {
        temporalCadence = 'periodic_cadence';
      } else {
        temporalCadence = 'static_batch_dump';
      }
    }
  } else if (totalFiles === 1) {
    temporalCadence = 'single_active_file';
  }

  // 4. File naming pattern detection (regex heuristics)
  const namingPattern = detectNamingPattern(files.map((f) => f.name));

  // 5. Content sampling & schema sniffing
  const sampleCandidate = files.find((f) => f.sampleContent && f.sampleContent.trim().length > 0) || files[0];
  let extractedColumns: ExtractedFolderColumn[] = [];
  let sampleFileUsed: string | undefined = undefined;

  if (sampleCandidate && sampleCandidate.sampleContent) {
    sampleFileUsed = sampleCandidate.name;
    extractedColumns = sniffColumnsFromContent(sampleCandidate.name, sampleCandidate.sampleContent);
  }

  // Fallback: If no sample content available, infer from filenames
  if (extractedColumns.length === 0) {
    extractedColumns = inferDefaultColumnsFromFolderContext(folderName, dominantFormat);
  }

  // 6. Suggest Set Mode
  const metrics: FolderBehaviorMetrics = {
    totalFiles,
    totalSizeBytes,
    avgSizeBytes,
    minSizeBytes,
    maxSizeBytes,
    sizeVarianceType,
    dominantFormat,
    formatDistribution,
    temporalCadence,
    avgTimeDeltaSeconds,
    namingPattern,
  };

  const suggestedMode = deriveModeSuggestion(metrics, sortedFiles, folderName);
  const suggestedTemplate = deriveTemplateSuggestion(extractedColumns, files, folderName);

  return {
    folderName,
    analyzedAt: new Date().toISOString(),
    metrics,
    files,
    suggestedMode,
    suggestedTemplate,
    extractedColumns,
    sampleFileUsed,
  };
}

/**
 * Derives output strategy, file format, partition config, and throttle speed.
 */
function deriveModeSuggestion(
  metrics: FolderBehaviorMetrics,
  sortedFiles: DiscoveredFolderFile[],
  folderName: string
): SuggestedModeConfig {
  const { totalFiles, sizeVarianceType, dominantFormat, temporalCadence, namingPattern } = metrics;
  const baseName = cleanIdentifier(folderName) || 'dataset';

  // CASE A: Partitioned Multi-File
  // Multiple files with numbered or indexed pattern, or micro-payload streams
  if (
    totalFiles >= 2 &&
    (namingPattern?.detected || sizeVarianceType === 'uniform_micro' || temporalCadence === 'high_frequency_stream')
  ) {
    const pattern = namingPattern?.pattern || `{filename}_{index}.${dominantFormat}`;
    const rowsPerFile = sizeVarianceType === 'uniform_micro' ? 100 : 500;

    return {
      outputStrategy: 'multi_file',
      strategyConfidence: namingPattern?.detected ? 96 : 88,
      strategyReason: `Observed ${totalFiles} partitioned files with ${namingPattern?.detected ? `sequence convention "${namingPattern.sampleMatch}"` : 'uniform micro-batch sizes'}. Partitioned streaming matches the existing folder ingestion pattern.`,
      format: dominantFormat,
      formatReason: `Dominant file type across monitored folder is ${dominantFormat.toUpperCase()} (${metrics.formatDistribution[dominantFormat] || totalFiles} files).`,
      outputDestination: 'folder',
      suggestedFilename: baseName,
      suggestedFilenamePattern: pattern,
      suggestedRowsPerFile: rowsPerFile,
      suggestedBatchCount: rowsPerFile * 5,
      suggestedIntervalMs: temporalCadence === 'high_frequency_stream' ? 75 : 150,
      suggestedGenerationMode: temporalCadence === 'high_frequency_stream' ? 'Continuous' : 'Batch',
    };
  }

  // CASE B: In-Place Append
  // Single active log or growing data file
  if (
    (totalFiles === 1 && (dominantFormat === 'csv' || dominantFormat === 'jsonl' || dominantFormat === 'txt')) ||
    sizeVarianceType === 'monolithic_single'
  ) {
    const target = sortedFiles.reduce((prev, curr) => (curr.size > prev.size ? curr : prev), sortedFiles[0]);
    const targetName = target ? target.name : `${baseName}.${dominantFormat}`;

    return {
      outputStrategy: 'append_existing',
      strategyConfidence: 92,
      strategyReason: `Detected primary rolling target "${targetName}" (${formatFileSize(target?.size || 0)}). Recommends appending new synthetic records in-place without overwriting previous data.`,
      format: dominantFormat,
      formatReason: `Target file uses standard ${dominantFormat.toUpperCase()} structure.`,
      outputDestination: 'folder',
      suggestedFilename: baseName,
      suggestedTargetFile: targetName,
      suggestedBatchCount: 1000,
      suggestedIntervalMs: 150,
      suggestedGenerationMode: 'Batch',
    };
  }

  // CASE C: Single Fresh Output (Default for empty folder or non-partitioned directory)
  return {
    outputStrategy: 'single',
    strategyConfidence: totalFiles === 0 ? 95 : 82,
    strategyReason: totalFiles === 0
      ? 'Target folder is clean and empty. Recommends generating a single fresh master dataset.'
      : 'Folder contains static non-partitioned files. Single consolidated output provides maximum portability.',
    format: dominantFormat,
    formatReason: `Standard data exchange format: ${dominantFormat.toUpperCase()}.`,
    outputDestination: 'folder',
    suggestedFilename: `${baseName}_synthetic`,
    suggestedBatchCount: 1000,
    suggestedIntervalMs: 150,
    suggestedGenerationMode: 'Batch',
  };
}

/**
 * Derives matching preset or synthesizes a custom schema based on extracted column names and domain cues.
 */
function deriveTemplateSuggestion(
  extractedColumns: ExtractedFolderColumn[],
  files: DiscoveredFolderFile[],
  folderName: string
): SuggestedTemplateConfig {
  const colNames = extractedColumns.map((c) => c.name.toLowerCase());
  const combinedText = [folderName, ...files.map((f) => f.name), ...colNames].join(' ').toLowerCase();

  // 1. Check Pre-built Domain Signatures
  const domainScores: Array<{ preset: PresetSchema; score: number; matchedKeywords: string[] }> = [];

  for (const preset of PRESET_SCHEMAS) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check column matches
    for (const pCol of preset.columns) {
      const pName = pCol.name.toLowerCase();
      if (colNames.some((c) => c === pName || c.includes(pName) || pName.includes(c))) {
        score += 25;
        matchedKeywords.push(pCol.name);
      }
    }

    // Check domain keywords
    const keywords = getDomainKeywordsForPreset(preset.id);
    for (const kw of keywords) {
      if (combinedText.includes(kw)) {
        score += 15;
        if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
      }
    }

    domainScores.push({ preset, score, matchedKeywords });
  }

  domainScores.sort((a, b) => b.score - a.score);
  const bestPreset = domainScores[0];

  // If match score is high enough (>= 40), recommend the known preset
  if (bestPreset && bestPreset.score >= 40) {
    const confidence = Math.min(98, 45 + Math.round(bestPreset.score * 0.55));
    return {
      type: 'preset',
      presetId: bestPreset.preset.id,
      presetName: bestPreset.preset.name,
      category: bestPreset.preset.category,
      confidence,
      reason: `Matched domain signature "${bestPreset.preset.name}" based on fields: ${bestPreset.matchedKeywords.slice(0, 4).join(', ')}.`,
      matchedKeywords: bestPreset.matchedKeywords,
      columns: bestPreset.preset.columns,
      tableName: bestPreset.preset.tableName,
    };
  }

  // If real extracted columns exist from file content, build an auto-synthesized custom template!
  if (extractedColumns.length >= 2) {
    const customCols: ColumnSpec[] = extractedColumns.map((c, i) => ({
      id: `gen_${i + 1}`,
      name: c.name,
      type: c.inferredType,
      rule: c.inferredRule,
      skip_pct: 0,
      condition: '',
    }));

    return {
      type: 'custom_extracted',
      presetName: `Custom: ${cleanIdentifier(folderName) || 'Folder'}_Schema`,
      category: 'Folder Inferred',
      confidence: 94,
      reason: `Synthesized custom template directly from ${extractedColumns.length} fields detected inside folder files.`,
      matchedKeywords: extractedColumns.map((c) => c.name),
      columns: customCols,
      tableName: `${cleanIdentifier(folderName) || 'ingested'}_records`,
    };
  }

  // Fallback: Default to Hardware & Logistics demo preset
  const fallback = PRESET_SCHEMAS[0];
  return {
    type: 'preset',
    presetId: fallback.id,
    presetName: fallback.name,
    category: fallback.category,
    confidence: 65,
    reason: 'Generic structured data template recommended for initial data generation.',
    matchedKeywords: [],
    columns: fallback.columns,
    tableName: fallback.tableName,
  };
}

/**
 * Sniffs column headers and types from sample file text (CSV, TSV, JSON, JSONL, SQL, LOG)
 */
function sniffColumnsFromContent(filename: string, content: string): ExtractedFolderColumn[] {
  const ext = getExtension(filename).toLowerCase();
  const trimmed = content.trim();

  // 1. JSON Array or Single JSON Object
  if (ext === 'json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      let data: any = null;
      if (trimmed.startsWith('[')) {
        data = JSON.parse(trimmed.slice(0, 30000) + (trimmed.endsWith(']') ? '' : ']'));
      } else if (trimmed.startsWith('{')) {
        // Find end of first object
        const firstEnd = trimmed.indexOf('\n}\n');
        const chunk = firstEnd > 0 ? trimmed.slice(0, firstEnd + 3) : trimmed;
        data = JSON.parse(chunk);
      }

      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return extractColumnsFromObjects(data.slice(0, 10));
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        return extractColumnsFromObjects([data]);
      }
    } catch {
      // Fallback to regex key extraction
    }
  }

  // 2. JSON Lines (.jsonl / .ndjson)
  if (ext === 'jsonl' || ext === 'ndjson' || (trimmed.startsWith('{') && trimmed.includes('\n{'))) {
    const lines = trimmed.split('\n').filter((l) => l.trim().startsWith('{'));
    const parsedObjects: any[] = [];
    for (const l of lines.slice(0, 8)) {
      try {
        parsedObjects.push(JSON.parse(l));
      } catch {}
    }
    if (parsedObjects.length > 0) {
      return extractColumnsFromObjects(parsedObjects);
    }
  }

  // 3. CSV / TSV / Delimited
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0];
    const delimiter = ext === 'tsv' || firstLine.includes('\t') ? '\t' : ',';
    const headers = splitDelimitedLine(firstLine, delimiter);

    if (headers.length >= 2 && headers.every((h) => h.length > 0 && h.length < 60)) {
      const dataRows = lines.slice(1, 6).map((l) => splitDelimitedLine(l, delimiter));
      return headers.map((header, colIdx) => {
        const sampleValues = dataRows.map((r) => r[colIdx] || '').filter((v) => v.length > 0);
        const { type, rule } = inferColumnTypeFromSamples(header, sampleValues);
        return {
          name: sanitizeColumnName(header),
          inferredType: type,
          inferredRule: rule,
          sampleValues: sampleValues.slice(0, 3),
        };
      });
    }
  }

  return [];
}

function extractColumnsFromObjects(objects: Record<string, any>[]): ExtractedFolderColumn[] {
  const keysSet = new Set<string>();
  objects.forEach((obj) => Object.keys(obj || {}).forEach((k) => keysSet.add(k)));

  return Array.from(keysSet).map((key) => {
    const samples = objects
      .map((o) => (o[key] !== undefined && o[key] !== null ? String(o[key]) : ''))
      .filter((s) => s.length > 0);
    const { type, rule } = inferColumnTypeFromSamples(key, samples);
    return {
      name: sanitizeColumnName(key),
      inferredType: type,
      inferredRule: rule,
      sampleValues: samples.slice(0, 3),
    };
  });
}

function inferColumnTypeFromSamples(header: string, samples: string[]): { type: ColumnType; rule: string } {
  const lower = header.toLowerCase();

  // Sequence / ID
  if (lower === 'id' || lower.endsWith('_id') || lower === 'index' || lower === 'seq') {
    if (samples.every((s) => /^\d+$/.test(s))) {
      return { type: 'Sequence', rule: samples[0] || '1001' };
    }
    if (samples.some((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))) {
      return { type: 'UUID', rule: '' };
    }
  }

  // UUID
  if (lower.includes('uuid') || lower.includes('guid') || samples.some((s) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s))) {
    return { type: 'UUID', rule: '' };
  }

  // Email
  if (lower.includes('email') || samples.some((s) => s.includes('@') && s.includes('.'))) {
    return { type: 'Entity', rule: 'email' };
  }

  // Name
  if (lower.includes('name')) {
    if (lower.includes('first')) return { type: 'Entity', rule: 'first_name' };
    if (lower.includes('last')) return { type: 'Entity', rule: 'last_name' };
    return { type: 'Entity', rule: 'full_name' };
  }

  // IP Address
  if (lower.includes('ip') || lower.includes('address') && samples.some((s) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s))) {
    return { type: 'Entity', rule: 'ip_address' };
  }

  // Country / City
  if (lower.includes('country')) return { type: 'Entity', rule: 'country' };
  if (lower.includes('city')) return { type: 'Entity', rule: 'city' };

  // Timestamp / Date
  if (lower.includes('date') || lower.includes('time') || lower.includes('at') || lower.includes('timestamp')) {
    if (samples.some((s) => s.includes('T') || s.includes('Z'))) {
      return { type: 'DateTime', rule: 'ISO' };
    }
    return { type: 'DateTime', rule: 'YYYY-MM-DD HH:mm:ss' };
  }

  // Boolean
  if (lower.startsWith('is_') || lower.startsWith('has_') || samples.every((s) => ['true', 'false', '0', '1', 'yes', 'no'].includes(s.toLowerCase()))) {
    return { type: 'Boolean', rule: '50' };
  }

  // Float / Currency / Percentage
  if (
    lower.includes('price') ||
    lower.includes('rate') ||
    lower.includes('temp') ||
    lower.includes('weight') ||
    samples.some((s) => /^-?\d+\.\d+$/.test(s))
  ) {
    const nums = samples.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
    const min = nums.length > 0 ? Math.floor(Math.min(...nums)) : 10;
    const max = nums.length > 0 ? Math.ceil(Math.max(...nums)) : 100;
    return { type: 'Float', rule: `${min}, ${Math.max(max, min + 10)}, 2` };
  }

  // Integer
  if (
    lower.includes('count') ||
    lower.includes('qty') ||
    lower.includes('quantity') ||
    lower.includes('age') ||
    samples.every((s) => /^-?\d+$/.test(s))
  ) {
    const nums = samples.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
    const min = nums.length > 0 ? Math.min(...nums) : 1;
    const max = nums.length > 0 ? Math.max(...nums) : 50;
    return { type: 'Int', rule: `${min}, ${Math.max(max, min + 5)}` };
  }

  // Status / Set/Enum
  if (lower.includes('status') || lower.includes('category') || lower.includes('type') || lower.includes('method')) {
    const uniqueValues = Array.from(new Set(samples)).slice(0, 5);
    if (uniqueValues.length > 0) {
      return { type: 'Set/Enum', rule: uniqueValues.map((v) => `${v}:25`).join(', ') };
    }
  }

  // Default string
  return { type: 'String', rule: '10' };
}

/**
 * Detects patterns like "orders_001.csv", "sensor-2026-09-22-01.json", "part-0.jsonl"
 */
function detectNamingPattern(filenames: string[]): FolderBehaviorMetrics['namingPattern'] {
  if (filenames.length < 2) {
    return {
      detected: false,
      pattern: '{filename}_{index}.{ext}',
      sampleMatch: filenames[0] || 'data_001.csv',
      hasSequenceDigits: false,
      hasDateStamp: false,
    };
  }

  // Check for indexed digits pattern e.g. "orders_001.json"
  for (const name of filenames) {
    const match = name.match(/^(.*?)(\d{2,8})\.([a-zA-Z0-9]+)$/);
    if (match) {
      const prefix = match[1];
      const ext = match[3];
      const countMatching = filenames.filter((n) => n.startsWith(prefix) && n.endsWith(`.${ext}`)).length;
      if (countMatching >= 2) {
        return {
          detected: true,
          pattern: `${prefix}{index}.${ext}`,
          sampleMatch: name,
          hasSequenceDigits: true,
          hasDateStamp: /\d{4}[-_]?\d{2}[-_]?\d{2}/.test(name),
        };
      }
    }
  }

  // Check for date stamped pattern
  for (const name of filenames) {
    const dateMatch = name.match(/\d{4}[-_]\d{2}[-_]\d{2}/);
    if (dateMatch) {
      return {
        detected: true,
        pattern: '{filename}_{date}_{index}.{ext}',
        sampleMatch: name,
        hasSequenceDigits: false,
        hasDateStamp: true,
      };
    }
  }

  return {
    detected: false,
    pattern: '{filename}_{index}.{ext}',
    sampleMatch: filenames[0] || 'dataset_001.csv',
    hasSequenceDigits: false,
    hasDateStamp: false,
  };
}

function getDomainKeywordsForPreset(presetId: string): string[] {
  switch (presetId) {
    case 'iot-telemetry':
      return ['iot', 'sensor', 'telemetry', 'device', 'battery', 'temp', 'humidity', 'anomaly', 'packet', 'firmware', 'stream'];
    case 'web-access-logs':
      return ['log', 'access', 'nginx', 'apache', 'http', 'status', 'ip', 'latency', 'endpoint', 'agent', 'uri', 'trace'];
    case 'ecommerce-orders':
      return ['order', 'commerce', 'cart', 'customer', 'price', 'discount', 'sku', 'item', 'checkout', 'sales', 'shipping'];
    case 'default-demo':
      return ['logistics', 'hardware', 'weight', 'mac', 'tare', 'serial', 'tracking', 'cargo', 'dispatch'];
    case 'user-directory':
      return ['user', 'account', 'employee', 'directory', 'profile', 'hr', 'company', 'title', 'member'];
    default:
      return [];
  }
}

function inferDefaultColumnsFromFolderContext(folderName: string, format: ExportFormat): ExtractedFolderColumn[] {
  const lower = folderName.toLowerCase();
  if (lower.includes('log') || lower.includes('access')) {
    return [
      { name: 'Trace_ID', inferredType: 'UUID', inferredRule: '', sampleValues: ['f47ac10b-58cc...'] },
      { name: 'Client_IP', inferredType: 'Entity', inferredRule: 'ip_address', sampleValues: ['192.168.1.105'] },
      { name: 'Method', inferredType: 'Set/Enum', inferredRule: 'GET:60, POST:30, PUT:10', sampleValues: ['GET'] },
      { name: 'Status', inferredType: 'Set/Enum', inferredRule: '200:85, 404:10, 500:5', sampleValues: ['200'] },
    ];
  }

  return [
    { name: 'Record_ID', inferredType: 'Sequence', inferredRule: '1001', sampleValues: ['1001'] },
    { name: 'Item_Name', inferredType: 'String', inferredRule: '12', sampleValues: ['Alpha Unit'] },
    { name: 'Quantity', inferredType: 'Int', inferredRule: '1, 50', sampleValues: ['12'] },
    { name: 'Unit_Price', inferredType: 'Float', inferredRule: '5.0, 99.0, 2', sampleValues: ['24.50'] },
  ];
}

function mapExtensionToExportFormat(ext: string): ExportFormat | null {
  switch (ext) {
    case 'csv': return 'csv';
    case 'json': return 'json';
    case 'jsonl':
    case 'ndjson': return 'jsonl';
    case 'tsv': return 'tsv';
    case 'sql': return 'sql';
    case 'xlsx': return 'xlsx';
    case 'xls': return 'xls';
    case 'xml': return 'xml';
    case 'txt':
    case 'log': return 'txt';
    default: return null;
  }
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((part) => part.trim().replace(/^["']|["']$/g, ''));
}

function sanitizeColumnName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

function cleanIdentifier(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
