import type { ColumnSpec, ExportFormat } from '../types';
import type { FolderAnalysisResult } from './folderBehaviorAnalyzer';

export interface ProfileReportOptions {
  /** Raw snippets and parsed sample values can contain sensitive production data. */
  includeSamples?: boolean;
}

export interface SimulationTemplate {
  tableName: string;
  columns: ColumnSpec[];
  metadata: {
    kind: 'vampio-log-simulation-template';
    version: '1.0.0';
    analyzedAt: string;
    sourceFolder: string;
    observed: { encoding: string; encodingConfidence: number; newline: string; delimiter?: string; logFormat?: string };
    recommendedOutput: FolderAnalysisResult['suggestedMode'];
    limitations: string[];
    privacy: string;
  };
}

const limitations = [
  'Inference uses bounded samples; unseen records, nested structures and mixed schemas may differ.',
  'Encoding confidence is heuristic evidence, not proof. Generated text uses UTF-8 and format-specific newlines; legacy encodings, BOMs and source newline styles are not reproduced automatically.',
  'Output is normalized synthetic data, not byte-exact replay. JSONL produces structured records. CSV/TSV use their standard delimiters; arbitrary separators and exact Apache, timestamped or free-text log layouts require a custom serializer.',
  'Timing and append recommendations are estimates, not a recording or replay of producer behavior. Metadata alone does not prove growth, cadence or an operating-system lock.',
  'Schema import loads columns and table name only. Import the machine profile bundle to restore output settings; review the destination before starting generation.',
];

/** Select the serializer from the inspected schema sample, rather than its extension. */
export function getSimulationFormat(analysis: FolderAnalysisResult): ExportFormat {
  const selected = analysis.fileProfiles?.find(profile => (profile.sourceId || profile.name) === analysis.sampleFileUsed)
    ?? analysis.fileProfiles?.find(profile => profile.columns.length > 0);
  if (selected?.format === 'jsonl') return 'jsonl';
  if (selected?.format === 'json') return 'json';
  if (selected?.format === 'delimited') return analysis.forensics.delimiter === '\t' ? 'tsv' : 'csv';
  if (selected && ['apache_nginx', 'timestamp_level', 'key_value', 'generic_text'].includes(selected.format)) return 'txt';
  if (analysis.forensics.sampleLogFormat === 'json_stream') {
    return /\.(jsonl|ndjson)$/i.test(analysis.sampleFileUsed || '') ? 'jsonl' : 'json';
  }
  if (analysis.forensics.sampleLogFormat === 'delimited_csv') return analysis.forensics.delimiter === '\t' ? 'tsv' : 'csv';
  return analysis.suggestedMode.format;
}

/** PresetSelector-compatible schema; source samples are intentionally absent. */
export function buildSimulationTemplate(analysis: FolderAnalysisResult): SimulationTemplate {
  return {
    tableName: analysis.suggestedTemplate.tableName,
    columns: JSON.parse(JSON.stringify(analysis.suggestedTemplate.columns)),
    metadata: {
      kind: 'vampio-log-simulation-template', version: '1.0.0',
      analyzedAt: analysis.analyzedAt, sourceFolder: analysis.folderName,
      observed: {
        encoding: analysis.forensics.encoding, encodingConfidence: analysis.forensics.encodingConfidence,
        newline: analysis.forensics.newlineType, delimiter: analysis.forensics.delimiter,
        logFormat: analysis.forensics.sampleLogFormat,
      },
      recommendedOutput: { ...analysis.suggestedMode, format: getSimulationFormat(analysis),
        formatReason: `Normalized synthetic ${getSimulationFormat(analysis).toUpperCase()} output from the inspected schema sample; exact source bytes and arbitrary log layouts are not reproduced.` },
      limitations: [...limitations],
      privacy: 'Raw snippets and sample rows are omitted. Column names and inferred enum values, constants, ranges, filenames and folder metadata may still reveal source information; review before sharing.',
    },
  };
}

export function exportSimulationTemplateJson(analysis: FolderAnalysisResult): string {
  return JSON.stringify(buildSimulationTemplate(analysis), null, 2);
}

// Neutralize control/bidi characters while keeping the report readable and deterministic.
function clean(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
function cell(value: unknown): string {
  return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`|\[\]*_~#]/g, char => `&#${char.charCodeAt(0)};`).replace(/\r\n|\r|\n/g, '<br>').replace(/\t/g, '&#9;');
}
function table(headers: string[], rows: unknown[][]): string {
  return [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(cell).join(' | ')} |`).join('\n');
}
function fenced(value: string): string {
  const content = clean(value).replace(/\r\n|\r/g, '\n');
  const runs = content.match(/`+/g) || [];
  const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  return `${fence}text\n${content}\n${fence}`;
}

/** A pure export: its timestamp comes from the analysis, never the current clock. */
export function exportLogProfileMarkdown(analysis: FolderAnalysisResult, options: ProfileReportOptions = {}): string {
  const { metrics, forensics, suggestedMode: mode, suggestedTemplate: template } = analysis;
  const inventory = analysis.files.map(file => [file.name, file.size, file.sampledBytes ?? file.rawBytes?.byteLength ?? 'Not recorded',
    file.readStatus === 'read_error' || file.isLocked ? `Read failed: ${file.readError || file.lockReason || 'reason unavailable'}` :
      file.rawBytes || file.sampleContent !== undefined ? 'Sample available; lock state unverified' : 'Not sampled / unknown']);
  const sections = [
    '# Log inspection and simulation profile',
    `Folder: ${cell(analysis.folderName)}\n\nAnalyzed: ${cell(analysis.analyzedAt)}${analysis.folderPath ? `\n\nSource path: ${cell(analysis.folderPath)}` : ''}`,
    '## Source inventory and sampling',
    `${metrics.totalFiles} discovered files; ${metrics.totalSizeBytes} bytes in the inventory. Content inspection uses bounded samples, not a full-file audit. Sample byte counts refer to retained bytes; text-only sample byte lengths are unknown. A missing sample is not evidence of an empty file.`,
    table(['File', 'Size (bytes)', 'Retained sample (bytes)', 'Access evidence'], inventory),
    `Schema sample file: ${cell(analysis.sampleFileUsed || 'Not recorded')}. File modification times support estimates only; repeated monitor observations are needed to establish growth.`,
    '## Encoding and access evidence',
    table(['Finding', 'Observed / inferred value'], [
      ['Encoding', `${forensics.encoding} (${forensics.encodingConfidence}% confidence)`],
      ['Encoding evidence', forensics.encodingEvidence?.join('; ') || 'Not recorded'],
      ['Newlines', forensics.newlineType], ['Delimiter', forensics.delimiterName || forensics.delimiter || 'Not detected'],
      ['Log format', forensics.sampleLogFormat || 'Not detected'], ['Scripts / languages', forensics.detectedLanguages.join(', ')],
      ['Access / lock heuristic', forensics.fileLockStatus], ['Details', forensics.lockDetails || 'No additional evidence recorded'],
    ]),
    'Encoding confidence describes a heuristic over available bytes/text. A successful read does not test OS locks; a denied read can reflect permissions or another access failure. Modification time, filename and append-like format do not prove that a producer is writing.',
    '## Per-file profiles',
    analysis.fileProfiles?.length ? table(
      ['File', 'Format', 'Encoding / confidence', 'Evidence', 'Newlines', 'Sample bytes', 'Truncated', 'Read status'],
      analysis.fileProfiles.map(profile => [profile.name, profile.format, `${profile.encoding} (${profile.encodingConfidence}%)`,
        [...profile.encodingEvidence, ...profile.formatEvidence].join('; '), profile.newlineType, profile.sampledBytes,
        profile.truncated ? 'Yes' : 'No', `${profile.readStatus}${profile.readError ? `: ${profile.readError}` : ''}`]),
    ) : 'Per-file profiles were not recorded by this analysis.',
    ...(analysis.fileProfiles || []).filter(profile => profile.columns.length).map(profile =>
      `Fields in ${cell(profile.name)}:\n\n` + table(['Column', 'Inferred type', 'Generator rule'],
        profile.columns.map(column => [column.name, column.inferredType, column.inferredRule]))),
    '## Extracted schema and generator rules',
    `Template: ${cell(template.tableName)} (${cell(template.type)}; ${template.confidence}% confidence). ${cell(template.reason)}`,
    table(['Column', 'Generator type', 'Rule', 'Skip (%)'], template.columns.map(column => [column.name, column.type, column.rule, column.skip_pct])),
    '## Simulation guidance and compatibility',
    table(['Setting', 'Recommendation'], [
      ['Output format', getSimulationFormat(analysis)], ['Write strategy', mode.outputStrategy], ['Filename', mode.suggestedFilename],
      ['Filename pattern', mode.suggestedFilenamePattern || 'Not specified'], ['Target file', mode.suggestedTargetFile || 'Not specified'],
      ['Interval (ms)', mode.suggestedIntervalMs], ['Rows per batch', mode.suggestedBatchCount],
      ['Rows per file', mode.suggestedRowsPerFile ?? 'Not specified'], ['Generation mode', mode.suggestedGenerationMode],
      ['Strategy evidence', mode.strategyReason], ['Format evidence', buildSimulationTemplate(analysis).metadata.recommendedOutput.formatReason],
    ]),
    'Import the profile bundle in Developer Studio through Others → Import Machine Profile Bundle for the full workspace. Import the simulation schema through the schema/preset selector to reuse its columns and table name. Review rules, output format and destination, then generate a small test batch and check it against the consuming system before continuous generation.',
    '## Limitations',
    limitations.map(item => `- ${item}`).join('\n'),
    '## Data included in this report',
    options.includeSamples ? 'Raw sample export was explicitly enabled. Review production values before sharing.' : 'Raw snippets and sample rows are omitted. Inferred enum values, constants, ranges, column names and source metadata may still contain source information; review before sharing.',
  ];
  if (options.includeSamples) {
    for (const profile of analysis.fileProfiles || []) {
      if (profile.sampleRows.length) sections.push(`Sample rows from ${cell(profile.name)}:\n\n` + fenced(JSON.stringify(profile.sampleRows, null, 2)));
    }
    sections.push('## Source sample', fenced(analysis.sampleSnippet || '(No raw snippet recorded)'));
    if (analysis.extractedColumns.length) {
      sections.push(table(['Column', 'Sample values'], analysis.extractedColumns.map(column => [column.name, column.sampleValues.join('; ')])));
    }
  }
  return sections.join('\n\n') + '\n';
}
