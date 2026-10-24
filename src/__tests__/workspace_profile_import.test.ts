import { describe, it, expect } from 'vitest';
import { analyzeFolderFiles, exportWorkspaceProfileBundleJson, generateWorkspaceProfileBundle, validateAndParseWorkspaceBundle } from '../utils/folderBehaviorAnalyzer';
import { workspaceSettingsFromProfile } from '../utils/workspaceProfile';
import { createDefaultWorkspace } from '../utils/workspaceStorage';
import { GeneratorEngine } from '../utils/generator';
import { formatDataset } from '../utils/export';

function analysis() {
  const sampleContent = '{"timestamp":"2026-10-25T01:00:00Z","level":"INFO","message":"unique-production-value"}\n{"timestamp":"2026-10-25T01:00:01Z","level":"WARN","message":"other-production-value"}\n';
  return analyzeFolderFiles([
    { name: 'unrelated.txt', size: 8, lastModified: 1, sampleContent: 'unrelated' },
    { name: 'service.log', size: sampleContent.length, lastModified: 2, rawBytes: new TextEncoder().encode(sampleContent) },
  ], 'service_logs');
}

describe('Simulation profile import and handoff', () => {
  it('exports content-based format and selected samples with explicit opt-in only', () => {
    const result = analysis();
    expect(result.sampleFileUsed).toBe('service.log');
    const bundle = generateWorkspaceProfileBundle(result);
    expect(bundle.vampioWorkspace.format).toBe('jsonl');
    expect(bundle.samplePreview.filename).toBe('service.log');
    expect(bundle.samplePreview.rawSnippet).toBe('');
    expect(bundle.samplePreview.sampleRows).toEqual([]);
    expect(bundle.fileProfiles?.every(profile => !profile.sampleRows.length && profile.columns.every(column => !column.sampleValues.length))).toBe(true);
    const withSamples = generateWorkspaceProfileBundle(result, undefined, { includeSamples: true });
    expect(withSamples.samplePreview.rawSnippet).toContain('unique-production-value');
    expect(withSamples.samplePreview.rawSnippet).not.toContain('unrelated');
    expect(withSamples.samplePreview.sampleRows).toHaveLength(2);
  });

  it('round-trips a profile into a fresh persisted workspace and generates valid JSONL', () => {
    const result = analysis();
    result.suggestedMode.suggestedBatchCount = 17;
    result.suggestedMode.suggestedIntervalMs = 800;
    result.suggestedMode.suggestedGenerationMode = 'Continuous';
    result.suggestedMode.outputStrategy = 'append_existing';
    const imported = validateAndParseWorkspaceBundle(exportWorkspaceProfileBundleJson(result));
    expect(imported.valid, imported.error).toBe(true);
    const workspace = createDefaultWorkspace(workspaceSettingsFromProfile(imported.bundle!));
    expect(workspace).toMatchObject({ format: 'jsonl', count: 17, intervalMs: 800, generationMode: 'Continuous', outputDestination: 'download', outputStrategy: 'single', selectedFolderName: null });
    expect(workspace.filename).toMatch(/_simulation$/);
    const rows = new GeneratorEngine().generateBatch(workspace.columns, workspace.count);
    const output = formatDataset(workspace.columns, rows, workspace.format) as string;
    const parsedRows = output.split('\n').map(line => JSON.parse(line));
    expect(parsedRows).toHaveLength(17);
    expect(parsedRows.every(row => typeof row.timestamp === 'string' && typeof row.message === 'string')).toBe(true);
  });

  it.each([
    ['source missing', (bundle: any) => { delete bundle.source; }],
    ['source path object', (bundle: any) => { bundle.source.folderPath = {}; }],
    ['unsupported version', (bundle: any) => { bundle.version = '99.0.0'; }],
    ['metrics array', (bundle: any) => { bundle.metrics = []; }],
    ['missing forensic fields', (bundle: any) => { bundle.forensics = {}; }],
    ['unsupported output', (bundle: any) => { bundle.vampioWorkspace.format = 'executable'; }],
    ['negative interval', (bundle: any) => { bundle.vampioWorkspace.intervalMs = -1; }],
    ['fractional count', (bundle: any) => { bundle.vampioWorkspace.batchCount = 1.5; }],
    ['invalid generation mode', (bundle: any) => { bundle.vampioWorkspace.generationMode = 'invalid'; }],
    ['invalid columns', (bundle: any) => { bundle.vampioWorkspace.columns = [null]; }],
    ['duplicate columns', (bundle: any) => { bundle.vampioWorkspace.columns.push(bundle.vampioWorkspace.columns[0]); }],
    ['null percentage out of range', (bundle: any) => { bundle.vampioWorkspace.columns[0].skip_pct = 101; }],
    ['nested dependency invalid', (bundle: any) => { bundle.vampioWorkspace.columns[0].dependencyCases = [null]; }],
  ])('rejects %s before applying or rendering', (_, mutate) => {
    const bundle = generateWorkspaceProfileBundle(analysis());
    mutate(bundle);
    const imported = validateAndParseWorkspaceBundle(JSON.stringify(bundle));
    expect(imported.valid).toBe(false);
    expect(imported.error).toBeTruthy();
  });

  it('supports the previous version-1 bundle without the new optional simulation fields', () => {
    const bundle = generateWorkspaceProfileBundle(analysis());
    delete bundle.vampioWorkspace.filename;
    delete bundle.vampioWorkspace.batchCount;
    delete bundle.vampioWorkspace.generationMode;
    delete bundle.fileProfiles;
    delete bundle.samplesIncluded;
    const parsed = validateAndParseWorkspaceBundle(JSON.stringify(bundle));
    expect(parsed.valid, parsed.error).toBe(true);
    expect(workspaceSettingsFromProfile(parsed.bundle!)).toMatchObject({ count: 1000, generationMode: 'Batch' });
  });
});
