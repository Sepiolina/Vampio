import { describe, expect, it } from 'vitest';
import { analyzeFolderFiles, type DiscoveredFolderFile } from '../utils/folderBehaviorAnalyzer';
import { buildSimulationTemplate, exportLogProfileMarkdown, exportSimulationTemplateJson, getSimulationFormat } from '../utils/profileExports';
import { GeneratorEngine } from '../utils/generator';
import { formatDataset } from '../utils/export';

function analyze(name: string, content: string) {
  const rawBytes = new TextEncoder().encode(content);
  const file: DiscoveredFolderFile = { name, size: rawBytes.length + 1000, lastModified: 1_700_000_000_000,
    rawBytes, sampleContent: content };
  const result = analyzeFolderFiles([file], 'line-4');
  result.analyzedAt = '2026-10-24T12:00:00.000Z';
  return result;
}

describe('log profile exports', () => {
  it('documents bounded mixed-format inspection and denied reads without claiming an OS lock', () => {
    const json = analyze('events.jsonl', '{"ts":"2026-10-24T10:00:00Z","level":"INFO","duration":12}\n{"ts":"2026-10-24T10:00:01Z","level":"WARN","duration":24}\n');
    const csv = analyze('sensors.csv', 'sensor,temperature,active\nA,24.5,true\nB,26.1,false\n');
    const text = analyze('service.log', '2026-10-24T10:00:00Z INFO Started pump\n2026-10-24T10:00:01Z ERROR Pump stopped\n');
    const result = analyzeFolderFiles([...json.files, ...csv.files, ...text.files, {
      name: 'denied.log', size: 100, lastModified: 1, readStatus: 'read_error', readError: 'Permission denied',
    }], 'mixed-log-folder');
    const report = exportLogProfileMarkdown(result);
    for (const name of ['events.jsonl', 'sensors.csv', 'service.log', 'denied.log']) expect(report).toContain(name);
    expect(report).toContain('Per-file profiles');
    expect(report).toContain('Permission denied');
    expect(report).toContain('Truncated');
    expect(report).toContain('does not test OS locks');
    expect(report).toContain('confidence');
    expect(report).toContain('normalized synthetic data, not byte-exact replay');
    expect(exportLogProfileMarkdown(result)).toBe(report);
  });

  it('keeps raw values out by default and safely renders malicious filenames and opted-in fenced samples', () => {
    const result = analyze('normal.jsonl', '{"message":"SECRET_SOURCE_RECORD","count":12}\n');
    result.folderName = 'site|<script>\u001b[31m';
    result.files[0].name = 'evil|[click](javascript:bad)\n# Heading\u202e';
    result.sampleSnippet = 'SECRET_SOURCE_RECORD\n```\n<script>alert(1)</script>\n``````\n\u0000';
    result.extractedColumns = [{ name: 'message', inferredType: 'String', inferredRule: '20', sampleValues: ['SECRET_SOURCE_RECORD'] }];
    // Sample rows must also be omitted independently of the folder-level preview.
    result.suggestedTemplate.columns = [{ id: 'msg', name: 'message', type: 'String', rule: '20', skip_pct: 0, condition: '' }];
    for (const profile of result.fileProfiles || []) profile.columns = result.extractedColumns;
    const safe = exportLogProfileMarkdown(result);
    expect(safe).not.toContain('SECRET_SOURCE_RECORD');
    expect(safe).not.toContain('<script>');
    expect(safe).not.toContain('\u001b');
    expect(safe).not.toContain('\u202e');
    expect(safe).toContain('evil&#124;&#91;click');
    const samples = exportLogProfileMarkdown(result, { includeSamples: true });
    expect(samples).toContain('SECRET_SOURCE_RECORD');
    expect(samples).toContain('```````text\n');
    expect(samples).toContain('\\u0000');
  });

  it('chooses a normalized serializer from content even when a log has a misleading extension', () => {
    const jsonl = analyze('machine.log', '{"duration":12}\n{"duration":24}\n');
    const csv = analyze('machine.log', 'id;temperature\n1;24.5\n2;26.5\n');
    const tsv = analyze('machine.log', 'id\ttemperature\n1\t24.5\n2\t26.5\n');
    expect(getSimulationFormat(jsonl)).toBe('jsonl');
    expect(getSimulationFormat(csv)).toBe('csv');
    expect(getSimulationFormat(tsv)).toBe('tsv');
    expect(buildSimulationTemplate(csv).metadata.recommendedOutput.format).toBe('csv');
    delete csv.fileProfiles;
    expect(exportLogProfileMarkdown(csv)).toContain('Per-file profiles were not recorded');
  });

  it.each([
    ['events.jsonl', '{"temperature":24.5,"enabled":true}\n{"temperature":26.5,"enabled":false}\n', 'jsonl'],
    ['sensors.csv', 'temperature,enabled\n24.5,true\n26.5,false\n', 'csv'],
    ['service.log', '2026-10-24T10:00:00Z INFO Started pump\n2026-10-24T10:00:01Z ERROR Pump stopped\n', 'txt'],
  ] as const)('exports an importable generator schema from %s', (name, content, format) => {
    const analysis = analyze(name, content);
    const exported = JSON.parse(exportSimulationTemplateJson(analysis));
    // Same columns/tableName shape consumed by PresetSelector; the actual engine must generate these rules.
    expect(exported.tableName).toBe(analysis.suggestedTemplate.tableName);
    expect(exported.columns.length).toBeGreaterThan(0);
    const rows = new GeneratorEngine().generateBatch(exported.columns, 5);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      for (const column of exported.columns) {
        expect(row[column.name]).toBeDefined();
        expect(row[column.name]).not.toBe('N/A');
      }
    }
    const serialized = formatDataset(exported.columns, rows, format, exported.tableName);
    expect(typeof serialized).toBe('string');
    if (format === 'jsonl') expect((serialized as string).split('\n').map(line => JSON.parse(line))).toHaveLength(5);
    if (format === 'csv') expect((serialized as string).split('\n')).toHaveLength(6);
    expect(exported).not.toHaveProperty('samplePreview');
    expect(exported).not.toHaveProperty('sampleRows');
    expect(exported.metadata.limitations.join(' ')).toContain('UTF-8');
    expect(exported.metadata.limitations.join(' ')).toContain('Schema import loads columns and table name only');
    expect(exported.metadata.privacy).toContain('enum');
    const template = buildSimulationTemplate(analysis);
    template.columns[0].rule = 'changed';
    expect(analysis.suggestedTemplate.columns[0].rule).not.toBe('changed');
  });
});
