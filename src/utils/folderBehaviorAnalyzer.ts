import { ColumnSpec, ColumnType, ExportFormat, OutputStrategy, PresetSchema } from '../types';
import { PRESET_SCHEMAS } from '../data/presets';
import { isTauri } from './fileSystem';
import { readDir, open, stat } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { decodeTextSample, detectNewlines } from './textDecoding';
import { analyzeLogSample, DetectedLogFormat } from './logAnalysis';
import { parseWorkspaceProfileBundle } from './workspaceProfile';
import { getSimulationFormat } from './profileExports';

export interface DiscoveredFolderFile {
  name: string;
  size: number;
  lastModified: number;
  relativePath?: string;
  handle?: any;
  file?: File;
  sampleContent?: string;
  rawBytes?: Uint8Array;
  readStatus?: 'sampled' | 'skipped' | 'read_error' | 'binary';
  readError?: string;
  sampledBytes?: number;
  truncated?: boolean;
  isLocked?: boolean;
  lockReason?: string;
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

export interface FileForensicsProfile {
  dominantExtension: string; // e.g. ".log", ".csv", ".json", ".xlsx"
  extensionsDetected: string[];
  delimiter?: ',' | '\t' | ';' | '|' | ' ' | 'fixed_width';
  delimiterName?: string; // "Comma", "Tab", "Semicolon", "Pipe", "Space / Log"
  encoding: 'UTF-8' | 'UTF-8 with BOM' | 'UTF-16 LE' | 'UTF-16 BE' | 'TIS-620 / Windows-874' | 'Windows-1252 / ISO-8859-1' | 'ASCII';
  encodingConfidence: number; // 0 - 100
  newlineType: 'CRLF (Windows)' | 'LF (Unix)' | 'CR (Legacy)' | 'Mixed' | 'None' | 'Unknown';
  detectedLanguages: ('Thai' | 'English' | 'CJK' | 'Numeric/Symbols')[];
  fileLockStatus: 'no_lock_detected' | 'active_lock_suspected' | 'file_in_use_error' | 'read_only';
  lockDetails?: string;
  hasContinuousAppend: boolean;
  sampleLogFormat?: 'apache_nginx' | 'iso_timestamp_bracketed' | 'json_stream' | 'delimited_csv' | 'generic_text' | 'key_value';
  encodingEvidence?: string[];
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
  type: 'scan' | 'file_added' | 'file_grown' | 'pattern_matched' | 'cadence_detected' | 'info' | 'file_removed' | 'file_modified' | 'file_truncated' | 'access_changed' | 'file_rotated' | 'error';
  message: string;
  details?: string;
}

export interface FileAnalysisProfile {
  name: string;
  sourceId?: string;
  format: DetectedLogFormat;
  encoding: FileForensicsProfile['encoding'];
  encodingConfidence: number;
  encodingEvidence: string[];
  formatEvidence: string[];
  newlineType: FileForensicsProfile['newlineType'] | 'None';
  sampledBytes: number;
  truncated: boolean;
  readStatus: NonNullable<DiscoveredFolderFile['readStatus']>;
  readError?: string;
  columns: ExtractedFolderColumn[];
  sampleRows: string[][];
}

export interface FolderAnalysisResult {
  folderName: string;
  folderPath?: string;
  analyzedAt: string;
  metrics: FolderBehaviorMetrics;
  forensics: FileForensicsProfile;
  files: DiscoveredFolderFile[];
  suggestedMode: SuggestedModeConfig;
  suggestedTemplate: SuggestedTemplateConfig;
  extractedColumns: ExtractedFolderColumn[];
  sampleFileUsed?: string;
  sampleSnippet?: string;
  fileProfiles?: FileAnalysisProfile[];
}

export interface VampioWorkspaceProfileBundle {
  $schema: string;
  version: '1.0.0';
  generatedAt: string;
  generator: string;
  source: {
    platform: 'tauri' | 'web';
    folderName: string;
    folderPath?: string;
    totalFilesDiscovered: number;
    totalSizeBytes: number;
  };
  metrics: FolderBehaviorMetrics;
  forensics: FileForensicsProfile;
  fileProfiles?: FileAnalysisProfile[];
  samplesIncluded?: boolean;
  samplePreview: {
    filename?: string;
    rawSnippet: string;
    inferredHeaders: string[];
    sampleRows: string[][];
  };
  vampioWorkspace: {
    columns: ColumnSpec[];
    tableName: string;
    outputStrategy: OutputStrategy;
    format: ExportFormat;
    filenamePattern: string;
    intervalMs: number;
    batchCount?: number;
    generationMode?: 'Batch' | 'Continuous';
    filename?: string;
    rowsPerFile?: number;
    targetFile?: string;
  };
}

/**
 * 100% Offline directory reader using the standard File System Access API
 */
export async function readFolderFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle | any,
  sampleContentLimitBytes: number = 65536,
  maxFilesToReadContent: number = 25
): Promise<DiscoveredFolderFile[]> {
  const discovered: DiscoveredFolderFile[] = [];

  // 1. Support Tauri Native Desktop Folder
  if (dirHandle && (dirHandle.kind === 'tauri-dir' || (isTauri() && typeof dirHandle.path === 'string'))) {
    try {
      const targetPath = dirHandle.path;
      const entries = await readDir(targetPath);
      for (const entry of entries) {
        if (entry.isFile) {
          const filePath = `${targetPath}/${entry.name}`;
          let sampleContent = '';
          let rawBytes: Uint8Array | undefined = undefined;
          let isLocked = false;
          let lockReason = '';
          let fileSize = 0;
          let lastModified = Date.now();

          try {
            const fileStat = await stat(filePath);
            fileSize = fileStat.size;
            if (fileStat.mtime) {
              lastModified = new Date(fileStat.mtime).getTime();
            }
          } catch {}

          if (discovered.length < Math.max(0, maxFilesToReadContent)) {
            try {
              rawBytes = await readNativeSample(filePath, sampleContentLimitBytes);
              // Decode with TextDecoder
              sampleContent = decodeTextSample(rawBytes, fileSize > rawBytes.length).text;
            } catch (readErr: any) {
              isLocked = isExplicitLockError(readErr);
              lockReason = errorMessage(readErr);
            }
          }

          discovered.push({
            name: entry.name,
            size: fileSize || (rawBytes ? rawBytes.byteLength : 0),
            lastModified,
            relativePath: filePath,
            sampleContent: sampleContent || undefined,
            rawBytes,
            isLocked,
            lockReason: isLocked ? lockReason : undefined,
            readError: lockReason || undefined,
            readStatus: lockReason ? 'read_error' : rawBytes ? (decodeTextSample(rawBytes).binary ? 'binary' : 'sampled') : 'skipped',
            sampledBytes: rawBytes?.length || 0,
            truncated: rawBytes ? fileSize > rawBytes.length : false,
          });
        }
      }
      return discovered;
    } catch (tauriErr) {
      throw tauriErr;
    }
  }

  // 2. Virtual Directory or HTML FileList
  if (dirHandle && dirHandle.kind === 'virtual-dir') {
    if (dirHandle.htmlFileList) {
      return await readFilesFromHtmlFileList(dirHandle.htmlFileList, maxFilesToReadContent, sampleContentLimitBytes);
    }
    if (Array.isArray(dirHandle.files) && dirHandle.files.length > 0) {
      if (typeof File !== 'undefined' && dirHandle.files[0] instanceof File) {
        return await readFilesFromHtmlFileList(dirHandle.files, maxFilesToReadContent, sampleContentLimitBytes);
      }
      return dirHandle.files;
    }
    return [];
  }

  // 3. Standard Web File System Access API
  try {
    if (!dirHandle || typeof dirHandle.values !== 'function') {
      throw new Error('Selected directory cannot be read');
    }
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        let isLocked = false;
        let lockReason = '';
        try {
          const file = await entry.getFile();
          let sampleContent = '';
          let rawBytes: Uint8Array | undefined = undefined;

          // Read content for the first few files to analyze headers/structure
          if (discovered.length < Math.max(0, maxFilesToReadContent)) {
            try {
              const slice = file.slice(0, Math.max(0, sampleContentLimitBytes));
              const buffer = await slice.arrayBuffer();
              rawBytes = new Uint8Array(buffer);
              sampleContent = decodeTextSample(rawBytes, file.size > rawBytes.length).text;
            } catch (sliceErr: any) {
              isLocked = isExplicitLockError(sliceErr);
              lockReason = errorMessage(sliceErr);
            }
          }

          discovered.push({
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            handle: entry,
            file,
            sampleContent: sampleContent || undefined,
            rawBytes,
            isLocked,
            lockReason: isLocked ? lockReason : undefined,
            readError: lockReason || undefined,
            readStatus: lockReason ? 'read_error' : rawBytes ? (decodeTextSample(rawBytes).binary ? 'binary' : 'sampled') : 'skipped',
            sampledBytes: rawBytes?.length || 0,
            truncated: rawBytes ? file.size > rawBytes.length : false,
          });
        } catch (fileErr: any) {
          console.warn('Could not inspect file entry:', entry.name, fileErr);
          discovered.push({
            name: entry.name,
            size: 0,
            lastModified: Date.now(),
            handle: entry,
            isLocked: isExplicitLockError(fileErr),
            lockReason: isExplicitLockError(fileErr) ? errorMessage(fileErr) : undefined,
            readStatus: 'read_error',
            readError: errorMessage(fileErr),
          });
        }
      }
    }
  } catch (err) {
    throw err;
  }

  return discovered;
}

/**
 * Read files from HTML Directory Input (<input type="file" webkitdirectory />)
 */
export async function readFilesFromHtmlFileList(
  fileList: FileList | File[],
  maxFilesToReadContent: number = 25,
  sampleContentLimitBytes: number = 65536
): Promise<DiscoveredFolderFile[]> {
  const files: File[] = Array.from(fileList);
  const discovered: DiscoveredFolderFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let sampleContent = '';
    let rawBytes: Uint8Array | undefined = undefined;
    let isLocked = false;
    let lockReason = '';

    if (i < Math.max(0, maxFilesToReadContent)) {
      try {
        const slice = file.slice(0, Math.max(0, sampleContentLimitBytes));
        const buffer = await slice.arrayBuffer();
        rawBytes = new Uint8Array(buffer);
        sampleContent = decodeTextSample(rawBytes, file.size > rawBytes.length).text;
      } catch (e: any) {
        isLocked = isExplicitLockError(e);
        lockReason = errorMessage(e);
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
      rawBytes,
      isLocked,
      lockReason: isLocked ? lockReason : undefined,
      readError: lockReason || undefined,
      readStatus: lockReason ? 'read_error' : rawBytes ? (decodeTextSample(rawBytes).binary ? 'binary' : 'sampled') : 'skipped',
      sampledBytes: rawBytes?.length || 0,
      truncated: rawBytes ? file.size > rawBytes.length : false,
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
  folderName: string = 'locked_folder',
  existingWorkspaceColumns?: ColumnSpec[],
  preferredSampleName?: string
): FolderAnalysisResult {
  files = files.map(file => {
    if (!file.rawBytes) return file;
    const decoded = decodeTextSample(file.rawBytes, file.truncated ?? file.size > file.rawBytes.length);
    return { ...file, sampleContent: decoded.text || undefined };
  });
  const fileProfiles = files.map(profileFileSample);
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

  // 5. Content sampling & schema sniffing across candidate files
  // Prioritize structured data files (.csv, .tsv, .json, .jsonl, .xlsx, .log, etc.)
  const structuredExtensions = new Set(['csv', 'tsv', 'json', 'jsonl', 'ndjson', 'xlsx', 'xls', 'sql', 'xml', 'log']);
  const validFiles = files.filter(
    (f) => !f.name.startsWith('.') && !f.name.toLowerCase().includes('thumbs.db') && !f.name.toLowerCase().includes('desktop.ini')
  );

  const sortedCandidates = [...validFiles].sort((a, b) => {
    const preferredRank = (file: DiscoveredFolderFile) => !preferredSampleName || file.readStatus === 'read_error' ? 0 : (file.relativePath || file.name) === preferredSampleName ? 2 : file.name === preferredSampleName ? 1 : 0;
    const preference = preferredRank(b) - preferredRank(a);
    if (preference) return preference;
    const aExt = getExtension(a.name).toLowerCase();
    const bExt = getExtension(b.name).toLowerCase();
    const aStruct = structuredExtensions.has(aExt) ? 1 : 0;
    const bStruct = structuredExtensions.has(bExt) ? 1 : 0;
    if (aStruct !== bStruct) return bStruct - aStruct;
    const aContent = (a.sampleContent || a.rawBytes) ? 1 : 0;
    const bContent = (b.sampleContent || b.rawBytes) ? 1 : 0;
    return bContent - aContent;
  });

  let extractedColumns: ExtractedFolderColumn[] = [];
  let sampleCandidate: DiscoveredFolderFile | undefined = undefined;
  let sampleFileUsed: string | undefined = undefined;

  for (const cand of sortedCandidates) {
    if (cand.sampleContent || cand.rawBytes) {
      const cols = sniffColumnsFromContent(cand.name, completeTextForInference(cand, cand.sampleContent || ''), cand.rawBytes, cand.truncated ?? (cand.rawBytes ? cand.size > cand.rawBytes.length : false));
      if (cols.length > 0) {
        extractedColumns = cols;
        sampleCandidate = cand;
        sampleFileUsed = cand.relativePath || cand.name;
        break;
      }
    }
  }

  // Fallback candidate if no columns found yet
  if (!sampleCandidate && validFiles.length > 0) {
    sampleCandidate = validFiles.find((f) => f.sampleContent) || validFiles[0];
  }

  // Metadata alone cannot establish columns; leave extraction empty when no sample is readable.

  // Record content can identify JSONL even when operational logs use a .log extension.
  if (dominantFormat === 'txt' && sampleCandidate) {
    const detected = fileProfiles.find(profile => (profile.sourceId || profile.name) === (sampleCandidate.relativePath || sampleCandidate.name))?.format;
    if (detected === 'jsonl') dominantFormat = 'jsonl';
    else if (detected === 'json') dominantFormat = 'json';
  }

  // 6. Suggest Set Mode & Template
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
  const suggestedTemplate = deriveTemplateSuggestion(
    extractedColumns,
    files,
    folderName,
    sampleFileUsed,
    existingWorkspaceColumns
  );
  const forensics = detectFileForensics(files, metrics, sampleCandidate);

  return {
    folderName,
    folderPath: sampleCandidate?.relativePath ? sampleCandidate.relativePath.split(/[\\/]/).slice(0, -1).join('/') : undefined,
    analyzedAt: new Date().toISOString(),
    metrics,
    forensics,
    files,
    suggestedMode,
    suggestedTemplate,
    extractedColumns,
    sampleFileUsed: sampleFileUsed || sampleCandidate?.relativePath || sampleCandidate?.name,
    fileProfiles,
    sampleSnippet: sampleCandidate?.sampleContent ? sampleCandidate.sampleContent.slice(0, 1000) : undefined,
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
      strategyConfidence: namingPattern?.detected ? 85 : 65,
      strategyReason: `Observed ${totalFiles} files with ${namingPattern?.detected ? `sequence convention "${namingPattern.sampleMatch}"` : 'uniform micro-batch sizes'}. Partitioned output is a suggested simulation; modification times do not prove live streaming.`,
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
    ['csv', 'tsv', 'jsonl', 'txt'].includes(dominantFormat) && (totalFiles === 1 || sizeVarianceType === 'monolithic_single')
  ) {
    const target = sortedFiles.reduce((prev, curr) => (curr.size > prev.size ? curr : prev), sortedFiles[0]);
    const targetName = target ? target.name : `${baseName}.${dominantFormat}`;

    return {
      outputStrategy: 'append_existing',
      strategyConfidence: 70,
      strategyReason: `Selected primary file "${targetName}" (${formatFileSize(target?.size || 0)}). Append is a suggested simulation based on file layout; actual growth and write access are unverified.`,
      format: dominantFormat,
      formatReason: `Suggested ${dominantFormat.toUpperCase()} output based on sampled content and extension.`,
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
 * Real extracted columns from user files ALWAYS take absolute precedence over canned presets.
 */
function deriveTemplateSuggestion(
  extractedColumns: ExtractedFolderColumn[],
  files: DiscoveredFolderFile[],
  folderName: string,
  sampleFileUsed?: string,
  existingWorkspaceColumns?: ColumnSpec[]
): SuggestedTemplateConfig {
  // RULE 1: If real extracted columns exist from file content, build an auto-synthesized custom template!
  // Real files ALWAYS beat generic canned presets!
  if (extractedColumns.length > 0) {
    const seenNames = new Set<string>();
    const customCols: ColumnSpec[] = extractedColumns.map((c, i) => {
      const baseName = c.name || `field_${i + 1}`;
      let uniqueName = baseName;
      let counter = 1;
      while (seenNames.has(uniqueName.toLowerCase())) {
        uniqueName = `${baseName}_${counter++}`;
      }
      seenNames.add(uniqueName.toLowerCase());

      return {
        id: `col_${Date.now()}_${i + 1}_${Math.random().toString(36).slice(2, 6)}`,
        name: uniqueName,
        type: c.inferredType,
        rule: c.inferredRule,
        skip_pct: 0,
        condition: '',
      };
    });

    const fileBase = sampleFileUsed ? (sampleFileUsed.split(/[\\/]/).pop() || sampleFileUsed).replace(/\.[^.]+$/, '') : folderName;
    const cleanBase = cleanIdentifier(fileBase) || cleanIdentifier(folderName) || 'ingested';

    return {
      type: 'custom_extracted',
      presetName: `Custom: ${cleanBase}_Schema`,
      category: 'Extracted Schema',
      confidence: 98,
      reason: `Synthesized from ${extractedColumns.length} fields detected in "${sampleFileUsed || folderName}".`,
      matchedKeywords: extractedColumns.map((c) => c.name),
      columns: customCols,
      tableName: `${cleanBase}_records`,
    };
  }

  // RULE 2: If no columns could be extracted from folder files, but the user already has active workspace columns:
  // Preserve their active schema instead of imposing the default demo logistics preset!
  if (existingWorkspaceColumns && existingWorkspaceColumns.length > 0) {
    return {
      type: 'custom_extracted',
      presetName: 'Current Active Workspace Columns',
      category: 'Workspace Preserved',
      confidence: 90,
      reason: `No structured headers found in monitored folder. Preserved your active workspace fields (${existingWorkspaceColumns.length} columns).`,
      matchedKeywords: existingWorkspaceColumns.map((c) => c.name),
      columns: existingWorkspaceColumns,
      tableName: cleanIdentifier(folderName) || 'active_workspace',
    };
  }

  // RULE 3: Only when folder is empty and workspace has no columns, check domain signatures or starter fallback
  const colNames = extractedColumns.map((c) => c.name.toLowerCase());
  const combinedText = [folderName, ...files.map((f) => f.name), ...colNames].join(' ').toLowerCase();

  const domainScores: Array<{ preset: PresetSchema; score: number; matchedKeywords: string[] }> = [];

  for (const preset of PRESET_SCHEMAS) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check column matches
    for (const pCol of preset.columns) {
      const pName = pCol.name.toLowerCase();
      if (colNames.some((c) => c === pName || (pName.length > 3 && c.includes(pName)))) {
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
 * Sniffs column headers and types from sample file text (CSV, TSV, JSON, JSONL, SQL, LOG, XLSX)
 */
function sniffColumnsFromContent(
  filename: string,
  content: string,
  rawBytes?: Uint8Array,
  truncated = false
): ExtractedFolderColumn[] {
  const ext = getExtension(filename).toLowerCase();

  // 1. Excel (.xlsx / .xls) binary parsing
  if ((ext === 'xlsx' || ext === 'xls') && rawBytes && rawBytes.length > 0 && !truncated) {
    try {
      const wb = XLSX.read(rawBytes, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (firstSheetName) {
        const sheet = wb.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 0) {
          const rawHeaderRow = rows[0] || [];
          const headers: string[] = [];
          for (let i = 0; i < rawHeaderRow.length; i++) {
            const h = rawHeaderRow[i];
            const str = h !== null && h !== undefined ? String(h).trim() : '';
            if (str || i < rawHeaderRow.length - 1) {
              headers.push(str || `Column_${i + 1}`);
            }
          }
          if (headers.length > 0) {
            const dataRows = rows.slice(1, 10);
            const seenNames = new Set<string>();
            return headers.map((header, colIdx) => {
              const sampleVals = dataRows
                .map((r) => (r && r[colIdx] !== undefined && r[colIdx] !== null ? String(r[colIdx]) : ''))
                .filter((v) => v.length > 0);
              const { type, rule } = inferColumnTypeFromSamples(header, sampleVals);
              const sanitized = sanitizeColumnName(header);
              let uniqueName = sanitized;
              let counter = 1;
              while (seenNames.has(uniqueName.toLowerCase())) {
                uniqueName = `${sanitized}_${counter++}`;
              }
              seenNames.add(uniqueName.toLowerCase());

              return {
                name: uniqueName,
                inferredType: type,
                inferredRule: rule,
                sampleValues: sampleVals.slice(0, 3),
              };
            });
          }
        }
      }
    } catch (e) {
      console.warn('Excel parse note:', e);
    }
  }

  const logSample = analyzeLogSample(content);
  if (logSample.records.length) return extractColumnsFromObjects(logSample.records);
  if (rawBytes && decodeTextSample(rawBytes).binary) return [];
  const cleaned = content.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  // 2. JSON Array or Single JSON Object
  if (ext === 'json' || cleaned.startsWith('[') || cleaned.startsWith('{')) {
    try {
      let data: any = null;
      if (cleaned.startsWith('[')) {
        data = JSON.parse(cleaned.slice(0, 50000) + (cleaned.endsWith(']') ? '' : ']'));
      } else if (cleaned.startsWith('{')) {
        const firstEnd = cleaned.indexOf('\n}\n');
        const chunk = firstEnd > 0 ? cleaned.slice(0, firstEnd + 3) : cleaned;
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

  // 3. JSON Lines (.jsonl / .ndjson)
  if (ext === 'jsonl' || ext === 'ndjson' || (cleaned.startsWith('{') && cleaned.includes('\n{'))) {
    const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().startsWith('{'));
    const parsedObjects: any[] = [];
    for (const l of lines.slice(0, 10)) {
      try {
        parsedObjects.push(JSON.parse(l));
      } catch {}
    }
    if (parsedObjects.length > 0) {
      return extractColumnsFromObjects(parsedObjects);
    }
  }

  // 4. CSV / TSV / Delimited
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0];

    // Delimiter detection across comma, semicolon, tab, pipe
    let delimiter = ',';
    if (ext === 'tsv') {
      delimiter = '\t';
    } else {
      const counts: Record<string, number> = {
        ',': (firstLine.match(/,/g) || []).length,
        ';': (firstLine.match(/;/g) || []).length,
        '\t': (firstLine.match(/\t/g) || []).length,
        '|': (firstLine.match(/\|/g) || []).length,
      };
      let best = ',';
      let maxCount = 0;
      for (const [delim, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          best = delim;
        }
      }
      if (maxCount > 0) {
        delimiter = best;
      }
    }

    const rawHeaders = splitDelimitedLine(firstLine, delimiter);
    // Trim trailing empty headers that result from trailing commas/delimiters
    while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === '') {
      rawHeaders.pop();
    }

    const delimited = detectDelimiter(lines);
    const looksLikeHeader = rawHeaders.every(h => /^[\p{L}_][\p{L}\p{N}_ .()\/-]*$/u.test(h) || h === '');
    if (['csv', 'tsv'].includes(ext) || rawHeaders.length >= 2 && delimited.delimiter && looksLikeHeader) {
      const dataRows = lines.slice(1, 10).map((l) => splitDelimitedLine(l, delimiter));
      const seenNames = new Set<string>();

      return rawHeaders.map((header, colIdx) => {
        const cleanH = header || `Column_${colIdx + 1}`;
        const sampleValues = dataRows
          .map((r) => r[colIdx] || '')
          .filter((v) => v.length > 0);
        const { type, rule } = inferColumnTypeFromSamples(cleanH, sampleValues);
        const baseSanitized = sanitizeColumnName(cleanH);
        let uniqueName = baseSanitized;
        let counter = 1;
        while (seenNames.has(uniqueName.toLowerCase())) {
          uniqueName = `${baseSanitized}_${counter++}`;
        }
        seenNames.add(uniqueName.toLowerCase());

        return {
          name: uniqueName,
          inferredType: type,
          inferredRule: rule,
          sampleValues: sampleValues.slice(0, 3),
        };
      });
    }
  }

  return [{ name: 'message', inferredType: 'String', inferredRule: '80', sampleValues: cleaned.split(/\r\n|\n|\r/).slice(0, 3) }];
}

function extractColumnsFromObjects(objects: Record<string, any>[]): ExtractedFolderColumn[] {
  const keysSet = new Set<string>();
  objects.forEach((obj) => Object.keys(obj || {}).forEach((k) => keysSet.add(k)));

  const seenNames = new Set<string>();
  return Array.from(keysSet).map((key) => {
    const samples = objects
      .map((o) => (o[key] !== undefined && o[key] !== null ? String(o[key]) : ''))
      .filter((s) => s.length > 0);
    const { type, rule } = inferColumnTypeFromSamples(key, samples);
    const baseSanitized = sanitizeColumnName(key);
    let uniqueName = baseSanitized;
    let counter = 1;
    while (seenNames.has(uniqueName.toLowerCase())) {
      uniqueName = `${baseSanitized}_${counter++}`;
    }
    seenNames.add(uniqueName.toLowerCase());

    return {
      name: uniqueName,
      inferredType: type,
      inferredRule: rule,
      sampleValues: samples.slice(0, 3),
    };
  });
}

function inferColumnTypeFromSamples(header: string, samples: string[]): { type: ColumnType; rule: string } {
  const lower = header.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  const words = new Set(lower.split(/[^a-z0-9]+/));
  const hasWord = (...names: string[]) => names.some(name => words.has(name));
  if (samples.length === 0) return { type: 'String', rule: '10' };

  // Sequence / ID
  if (lower === 'id' || lower.endsWith('_id') || lower === 'index' || lower === 'seq') {
    if (samples.length > 0 && samples.every((s) => /^\d+$/.test(s))) {
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
  if (hasWord('ip', 'ipv4') || lower.includes('address') && samples.some((s) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s))) {
    return { type: 'Entity', rule: 'ip_address' };
  }

  // Country / City
  if (lower.includes('country')) return { type: 'Entity', rule: 'country' };
  if (lower.includes('city')) return { type: 'Entity', rule: 'city' };

  // Timestamp / Date
  if (hasWord('date', 'time', 'timestamp') || lower.endsWith('_at')) {
    if (samples.some((s) => s.includes('T') || s.includes('Z'))) {
      return { type: 'DateTime', rule: 'ISO' };
    }
    return { type: 'DateTime', rule: 'YYYY-MM-DD HH:mm:ss' };
  }

  // Boolean
  if (lower.startsWith('is_') || lower.startsWith('has_') || samples.length > 0 && samples.every((s) => ['true', 'false', '0', '1', 'yes', 'no'].includes(s.toLowerCase()))) {
    return { type: 'Boolean', rule: '50' };
  }

  // Float / Currency / Percentage
  if (
    hasWord('price', 'rate', 'temp', 'temperature', 'weight') ||
    samples.some((s) => /^-?\d+\.\d+$/.test(s))
  ) {
    const nums = samples.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
    const min = nums.length > 0 ? Math.min(...nums) : 10;
    const max = nums.length > 0 ? Math.max(...nums) : 100;
    const decimals = Math.min(6, Math.max(2, ...samples.map(value => value.split('.')[1]?.length || 0)));
    return { type: 'Float', rule: `${min}, ${max}, ${decimals}` };
  }

  // Integer
  if (
    hasWord('count', 'qty', 'quantity', 'age') ||
    samples.length > 0 && samples.every((s) => /^-?\d+$/.test(s))
  ) {
    const nums = samples.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
    const min = nums.length > 0 ? Math.min(...nums) : 1;
    const max = nums.length > 0 ? Math.max(...nums) : 50;
    return { type: 'Int', rule: `${min}, ${max}` };
  }

  // Status / Set/Enum
  if (lower === 'level' || lower === 'severity' || lower.includes('status') || lower.includes('category') || lower.includes('type') || lower.includes('method')) {
    const uniqueValues = Array.from(new Set(samples)).slice(0, 5);
    if (uniqueValues.length > 0 && uniqueValues.every(value => !value.includes(','))) {
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
  const cells: string[] = [];
  let cell = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (line[i] === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += line[i];
  }
  cells.push(cell.trim());
  return cells;
}

function sanitizeColumnName(name: string): string {
  const cleaned = name.trim().replace(/[^\p{L}\p{N}_]/gu, '_').replace(/^_+|_+$/g, '') || 'field';
  return ['__proto__', 'constructor', 'prototype'].includes(name.trim().toLowerCase()) || ['__proto__', 'constructor', 'prototype'].includes(cleaned.toLowerCase()) ? `field_${cleaned}` : cleaned;
}

function cleanIdentifier(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detects text encoding with Byte-Order-Mark (BOM) inspection and Thai TIS-620/Windows-874 heuristics
 */
export function detectEncoding(
  bytes?: Uint8Array,
  text?: string
): { encoding: FileForensicsProfile['encoding']; confidence: number } {
  if (bytes) {
    const decoded = decodeTextSample(bytes);
    return { encoding: decoded.encoding, confidence: decoded.confidence };
  }
  return { encoding: text && /^[\x00-\x7F]*$/.test(text) ? 'ASCII' : 'UTF-8', confidence: text ? 80 : 0 };
}

/**
 * Detects human languages and scripts present in the sample text
 */
export function detectLanguages(text?: string): FileForensicsProfile['detectedLanguages'] {
  if (!text || text.trim().length === 0) return [];
  const languages: FileForensicsProfile['detectedLanguages'] = [];

  if (/[\u0E00-\u0E7F]/.test(text)) {
    languages.push('Thai');
  }
  if (/[a-zA-Z]/.test(text)) {
    languages.push('English');
  }
  if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    languages.push('CJK');
  }
  if (/[\d_#\$\-\.\/:]/.test(text) && languages.length === 0) {
    languages.push('Numeric/Symbols');
  }
  return languages.length > 0 ? languages : ['English'];
}

/**
 * Detects delimited separation characters (, \t ; |) or log space formatting
 */
export function detectDelimiter(lines: string[]): {
  delimiter?: ',' | '\t' | ';' | '|' | ' ' | 'fixed_width';
  delimiterName?: string;
} {
  const candidates: { char: ',' | '\t' | ';' | '|' | ' '; name: string }[] = [
    { char: ',', name: 'Comma (,)' },
    { char: '\t', name: 'Tab (\\t)' },
    { char: ';', name: 'Semicolon (;)' },
    { char: '|', name: 'Pipe (|)' },
  ];

  const sampleLines = lines.filter((l) => l.trim().length > 0).slice(0, 10);
  if (sampleLines.length === 0) {
    return {};
  }

  let bestDelimiter: ',' | '\t' | ';' | '|' | ' ' | undefined = undefined;
  let bestName: string = 'Comma (,)';
  let bestScore = -1;

  for (const cand of candidates) {
    const counts = sampleLines.map((l) => splitDelimitedLine(l, cand.char).length);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    if (minCount >= 2) {
      // Consistency score: higher column count + zero variance
      const isConsistent = minCount === maxCount;
      const score = (isConsistent ? 50 : 20) + minCount * 5;
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = cand.char;
        bestName = cand.name;
      }
    }
  }

  // Check if log format with spaces / brackets e.g. [2026-09-25] [INFO] message
  if (!bestDelimiter) {
    if (sampleLines.some((l) => l.startsWith('[') && l.includes(']'))) {
      return { delimiter: ' ', delimiterName: 'Bracketed Space / Log' };
    }
  }

  return {
    delimiter: bestDelimiter,
    delimiterName: bestDelimiter ? bestName : undefined,
  };
}

/**
 * Checks for file locking indicators and active process contention
 */
export function detectFileLock(
  files: DiscoveredFolderFile[],
  temporalCadence: FolderBehaviorMetrics['temporalCadence']
): {
  fileLockStatus: FileForensicsProfile['fileLockStatus'];
  lockDetails?: string;
  hasContinuousAppend: boolean;
} {
  const lockedFile = files.find(f => isExplicitLockError(f.lockReason || f.readError || ''));
  if (lockedFile) return {
    fileLockStatus: 'file_in_use_error',
    lockDetails: `Explicit lock/sharing error reading ${lockedFile.name}: ${lockedFile.lockReason || lockedFile.readError}`,
    hasContinuousAppend: false,
  };
  const errors = files.filter(f => f.readError || f.readStatus === 'read_error');
  return {
    fileLockStatus: 'no_lock_detected',
    lockDetails: errors.length
      ? `${errors.length} file(s) could not be read; access errors do not establish a process lock. Write access was not tested.`
      : 'No explicit lock error observed. Read sampling does not test write access or establish continuous append.',
    hasContinuousAppend: false,
  };
}

/**
 * Generates forensic profile of monitored files
 */
export function detectFileForensics(
  files: DiscoveredFolderFile[],
  metrics: FolderBehaviorMetrics,
  sampleCandidate?: DiscoveredFolderFile
): FileForensicsProfile {
  const extensions = Object.keys(metrics.formatDistribution).map((ext) => `.${ext}`);
  const dominantExtension = `.${Object.entries(metrics.formatDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || metrics.dominantFormat}`;

  const decoded = sampleCandidate?.rawBytes ? decodeTextSample(sampleCandidate.rawBytes, sampleCandidate.truncated) : undefined;
  const text = decoded?.text ?? sampleCandidate?.sampleContent ?? '';
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Encoding & confidence
  const { encoding, confidence } = detectEncoding(sampleCandidate?.rawBytes, text);

  // Parse records before punctuation heuristics; commas inside JSON/messages are not CSV fields.
  const detected = analyzeLogSample(text).format;
  let { delimiter, delimiterName } = detectDelimiter(lines);
  if (detected === 'json' || detected === 'jsonl') {
    delimiter = undefined;
    delimiterName = 'JSON records (no field delimiter)';
  } else if (detected === 'apache_nginx' || detected === 'timestamp_level' || detected === 'key_value') {
    delimiter = ' ';
    delimiterName = detected === 'apache_nginx' ? 'Access-log fields (quoted/bracketed)' : detected === 'timestamp_level' ? 'Timestamp / level / message' : 'Key=value records';
  }

  const hasReadableSample = !!sampleCandidate && !decoded?.binary && sampleCandidate.readStatus !== 'read_error' && (sampleCandidate.rawBytes !== undefined || sampleCandidate.sampleContent !== undefined);
  const newlineType: FileForensicsProfile['newlineType'] = hasReadableSample ? detectNewlines(text) : 'Unknown';

  // Languages
  const detectedLanguages = detectLanguages(text);

  // File Lock
  const { fileLockStatus, lockDetails, hasContinuousAppend } = detectFileLock(files, metrics.temporalCadence);

  const sampleLogFormat: FileForensicsProfile['sampleLogFormat'] = detected === 'json' || detected === 'jsonl'
    ? 'json_stream' : detected === 'timestamp_level' ? 'iso_timestamp_bracketed' : detected === 'apache_nginx'
    ? 'apache_nginx' : detected === 'key_value' ? 'key_value' : delimiter && delimiter !== ' ' ? 'delimited_csv' : 'generic_text';

  return {
    dominantExtension,
    extensionsDetected: extensions.length > 0 ? extensions : [dominantExtension],
    delimiter,
    delimiterName,
    encoding,
    encodingConfidence: confidence,
    encodingEvidence: decoded?.evidence,
    newlineType,
    detectedLanguages,
    fileLockStatus,
    lockDetails,
    hasContinuousAppend,
    sampleLogFormat,
  };
}

/**
 * Packages an analysis result into a comprehensive, standardized Developer Workspace Profile JSON Bundle
 */
export function generateWorkspaceProfileBundle(
  analysis: FolderAnalysisResult,
  customFolderPath?: string,
  options: { includeSamples?: boolean } = {},
): VampioWorkspaceProfileBundle {
  const sampleCandidate = analysis.files.find(file => (file.relativePath || file.name) === analysis.sampleFileUsed)
    || analysis.files.find(file => file.sampleContent?.trim()) || analysis.files[0];
  const sourceProfile = analysis.fileProfiles?.find(file => (file.sourceId || file.name) === (sampleCandidate?.relativePath || sampleCandidate?.name));
  const includeSamples = options.includeSamples === true;
  const format = getSimulationFormat(analysis);
  return {
    $schema: 'https://vampio.dev/schema/workspace-profile-v1.json',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    generator: 'Vampio Log Profiler',
    source: {
      platform: isTauri() ? 'tauri' : 'web',
      folderName: analysis.folderName,
      folderPath: customFolderPath || analysis.folderPath || undefined,
      totalFilesDiscovered: analysis.metrics.totalFiles,
      totalSizeBytes: analysis.metrics.totalSizeBytes,
    },
    metrics: analysis.metrics,
    forensics: analysis.forensics,
    samplesIncluded: includeSamples,
    fileProfiles: analysis.fileProfiles?.map(file => ({
      ...file,
      columns: file.columns.map(column => ({ ...column, sampleValues: includeSamples ? column.sampleValues : [] })),
      sampleRows: includeSamples ? file.sampleRows : [],
    })),
    samplePreview: {
      filename: sampleCandidate?.name,
      rawSnippet: includeSamples ? (sampleCandidate?.sampleContent || '').slice(0, 1500) : '',
      inferredHeaders: analysis.extractedColumns.map(column => column.name),
      sampleRows: includeSamples ? sourceProfile?.sampleRows || [] : [],
    },
    vampioWorkspace: {
      columns: analysis.suggestedTemplate.columns,
      tableName: analysis.suggestedTemplate.tableName,
      outputStrategy: analysis.suggestedMode.outputStrategy,
      format,
      filename: analysis.suggestedMode.suggestedFilename,
      filenamePattern: analysis.suggestedMode.suggestedFilenamePattern || '{filename}_{index}.{ext}',
      intervalMs: analysis.suggestedMode.suggestedIntervalMs,
      batchCount: analysis.suggestedMode.suggestedBatchCount,
      generationMode: analysis.suggestedMode.suggestedGenerationMode,
      rowsPerFile: analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: analysis.suggestedMode.suggestedTargetFile,
    },
  };
}

/** Export an importable simulation profile. Raw samples require explicit opt-in. */
export function exportWorkspaceProfileBundleJson(
  analysis: FolderAnalysisResult,
  customFolderPath?: string,
  options: { includeSamples?: boolean } = {},
): string {
  return JSON.stringify(generateWorkspaceProfileBundle(analysis, customFolderPath, options), null, 2);
}

/** Validate fields used by the import preview and generator before applying a profile. */
export function validateAndParseWorkspaceBundle(jsonText: string): {
  valid: boolean;
  error?: string;
  bundle?: VampioWorkspaceProfileBundle;
} {
  return parseWorkspaceProfileBundle(jsonText);
}


function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : String(error);
}

/** Access denied, unreadable encodings and missing paths are not evidence of another process's lock. */
export function isExplicitLockError(error: unknown): boolean {
  return /sharing[ _-]violation|lock[ _-]violation|resource (?:is )?(?:busy|locked)|\bEBUSY\b|\bEWOULDBLOCK\b|os error (?:32|33)\b|locked by (?:another|a) process/i.test(errorMessage(error));
}

async function readNativeSample(path: string, limit: number): Promise<Uint8Array> {
  const handle = await open(path, { read: true });
  try {
    const buffer = new Uint8Array(Math.max(0, Math.floor(limit)));
    let offset = 0;
    while (offset < buffer.length) {
      const count = await handle.read(buffer.subarray(offset));
      if (count === null || count === 0) break;
      offset += count;
    }
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

function profileFileSample(file: DiscoveredFolderFile): FileAnalysisProfile {
  const truncated = file.truncated ?? (file.rawBytes ? file.size > file.rawBytes.length : false);
  const decoded = file.rawBytes ? decodeTextSample(file.rawBytes, truncated) : undefined;
  const text = decoded?.text ?? file.sampleContent ?? '';
  const inferenceText = completeTextForInference(file, text);
  const log = analyzeLogSample(inferenceText);
  const spreadsheet = /\.xlsx?$/i.test(file.name);
  const columns = decoded?.binary && !spreadsheet ? [] : sniffColumnsFromContent(file.name, inferenceText, file.rawBytes, truncated);
  const delimiter = detectDelimiter(text.split(/\r\n|\n|\r/)).delimiter;
  const format = spreadsheet && columns.length ? 'spreadsheet' : decoded?.binary ? 'binary' : log.format === 'generic_text' && delimiter && delimiter !== ' ' ? 'delimited' : log.format;
  const keys = log.records.length ? Array.from(new Set(log.records.flatMap(Object.keys))) : [];
  return {
    name: file.name,
    sourceId: file.relativePath || file.name,
    format,
    encoding: decoded?.encoding ?? detectEncoding(undefined, text).encoding,
    encodingConfidence: decoded?.confidence ?? (text ? 70 : 0),
    encodingEvidence: decoded?.evidence ?? [text ? 'Only decoded text supplied; original byte encoding cannot be verified' : 'No sample bytes available'],
    formatEvidence: spreadsheet ? [truncated ? 'Workbook exceeds the bounded sample; no complete spreadsheet schema can be inferred' : columns.length ? 'Parsed first worksheet from a fully sampled workbook; binary bytes were not treated as text' : 'Sample could not be parsed as a supported workbook'] : log.evidence,
    newlineType: decoded?.binary || file.readStatus === 'read_error' || !file.rawBytes && file.sampleContent === undefined ? 'Unknown' : detectNewlines(text),
    sampledBytes: file.sampledBytes ?? file.rawBytes?.length ?? (text ? new TextEncoder().encode(text).length : 0),
    truncated,
    readStatus: file.readStatus ?? (file.readError ? 'read_error' : decoded?.binary ? 'binary' : text || file.rawBytes ? 'sampled' : 'skipped'),
    readError: file.readError,
    columns,
    sampleRows: log.records.length ? log.records.slice(0, 5).map(row => keys.map(key => typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '')))
      : inferenceText.split(/\r\n|\n|\r/).filter(Boolean).slice(format === 'delimited' ? 1 : 0, 6).map(line => delimiter ? splitDelimitedLine(line, delimiter) : [line]),
  };
}

/** A bounded sample can end inside a record. Keep the preview, but exclude that record from inference. */
function completeTextForInference(file: DiscoveredFolderFile, text: string): string {
  const truncated = file.truncated ?? (file.rawBytes ? file.size > file.rawBytes.length : false);
  if (!truncated || /[\r\n]$/.test(text)) return text;
  const end = Math.max(text.lastIndexOf('\n'), text.lastIndexOf('\r'));
  return end < 0 ? '' : text.slice(0, end + 1);
}
