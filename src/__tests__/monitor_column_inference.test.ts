import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { inferColumnValues, MAX_INFERENCE_RECORDS } from '../utils/columnInference';
import { analyzeFolderFiles, validateAndParseWorkspaceBundle, exportWorkspaceProfileBundleJson } from '../utils/folderBehaviorAnalyzer';
import { exportSimulationTemplateJson } from '../utils/profileExports';
import { parseEnumRule } from '../utils/enumRules';
import { GeneratorEngine } from '../utils/generator';

const inspect = (name: string, content: string) => analyzeFolderFiles([{ name, sampleContent: content, size: new TextEncoder().encode(content).length, lastModified: 1 }], 'observed');
afterEach(() => vi.restoreAllMocks());

describe('monitor value-driven column inference', () => {
  it.each(['result', 'Check_RY30', 'time', 'count'])('recognizes status labels regardless of the %s heading', header => {
    const column = inferColumnValues(header, ['OK', 'Error', 'not OK']);
    expect(column.inferredType).toBe('Set/Enum');
    expect(parseEnumRule(column.inferredRule).map(item => item.value)).toEqual(['OK', 'Error', 'not OK']);
    expect(column.inferenceReason).toContain('status-like');
    expect(column.inferenceConfidence).toBeGreaterThan(80);
  });

  it.each([['OK', 'NG'], ['OK', 'NOK'], ['OK', 'Error not OK']])('recognizes sparse PLC status choices %j without a heading hint', (...values) => {
    const column = inferColumnValues('Check_RY30', values);
    expect(column.inferredType).toBe('Set/Enum');
    expect(parseEnumRule(column.inferredRule).map(item => item.value)).toEqual(values);
  });

  it('retains every repeated category and observed frequency after the first ten rows', () => {
    const labels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
    const values = [...Array(12).fill('Alpha'), ...labels.slice(1), ...labels];
    const result = inspect('results.csv', `Check_RY30\n${values.join('\n')}\n`);
    const column = result.extractedColumns[0];
    expect(column.inferredType).toBe('Set/Enum');
    expect(column.sampleCount).toBe(values.length);
    expect(column.nonNullCount).toBe(values.length);
    expect(column.distinctCount).toBe(8);
    expect(column.valueFrequencies).toEqual(labels.map(value => ({ value, count: value === 'Alpha' ? 13 : 2 })));
    expect(parseEnumRule(column.inferredRule)).toEqual(labels.map(value => ({ value, weight: value === 'Alpha' ? 13 : 2 })));
  });

  it('keeps case, spaces, commas and colon-number suffixes intact through schema export/import and generation', () => {
    const values = ['not OK', 'Error, retry', 'stage:30', ' not OK ', 'not OK', 'Error, retry', 'stage:30', ' not OK '];
    const result = inspect('labels.jsonl', values.map(value => JSON.stringify({ result: value })).join('\n'));
    expect(result.extractedColumns[0].inferredType).toBe('Set/Enum');
    const imported = JSON.parse(exportSimulationTemplateJson(result));
    const rows = new GeneratorEngine().generateBatch(imported.columns, 30);
    rows.forEach(row => expect(values).toContain(row.result));
    expect(parseEnumRule(imported.columns[0].rule).map(item => item.value)).toEqual(values.slice(0, 4));
    const bundle = validateAndParseWorkspaceBundle(exportWorkspaceProfileBundleJson(result));
    expect(bundle.valid).toBe(true);
    expect(bundle.bundle?.vampioWorkspace.columns[0].rule).toBe(imported.columns[0].rule);
  });

  it('uses actual frequency weights, not equal invented weights', () => {
    const column = inferColumnValues('result', ['OK', 'OK', 'OK', 'Error']);
    const template = inspect('result.csv', 'result\nOK\nOK\nOK\nError\n').suggestedTemplate.columns;
    expect(parseEnumRule(column.inferredRule)).toEqual([{ value: 'OK', weight: 3 }, { value: 'Error', weight: 1 }]);
    const engine = new GeneratorEngine();
    // Feed a uniform grid into the weighted chooser directly through ordinary row generation.
    vi.spyOn(Math, 'random').mockReturnValue(0.74);
    expect(engine.generateBatch(template, 1)[0].result).toBe('OK');
    vi.mocked(Math.random).mockReturnValue(0.76);
    expect(engine.generateBatch(template, 1)[0].result).toBe('Error');
  });

  it.each(['part', 'result'])('infers a fixed-width code RegEx under an arbitrary %s heading', header => {
    const values = ['AB+001(X)', 'AB+002(X)', 'AB+003(X)', 'AB+004(X)', 'AB+005(X)', 'AB+006(X)'];
    const column = inferColumnValues(header, values);
    expect(column.inferredType).toBe('RegEx');
    const matcher = new RegExp(column.inferredRule);
    values.forEach(value => expect(matcher.test(value)).toBe(true));
    const result = inspect('codes.jsonl', values.map(value => JSON.stringify({ [header]: value })).join('\n'));
    const imported = JSON.parse(exportSimulationTemplateJson(result));
    const rows = new GeneratorEngine().generateBatch(imported.columns, 20);
    rows.forEach(row => { expect(matcher.test(String(row[header]))).toBe(true); expect(row[header]).toMatch(/^AB\+\d{3}\(X\)$/); });
    expect(column.inferenceReason).toContain('fixed widths');
  });

  it('preserves zero-padded identifiers as fixed-width strings, never numeric sequences', () => {
    const column = inferColumnValues('record_id', ['0001', '0002', '0003']);
    expect(column.inferredType).toBe('RegEx');
    expect(column.inferredRule).toContain('000');
    const result = inspect('ids.csv', 'record_id\n0001\n0002\n0003\n');
    const rows = new GeneratorEngine().generateBatch(result.suggestedTemplate.columns, 10);
    rows.forEach(row => expect(row.record_id).toMatch(/^000\d$/));
  });

  it('chooses String for prose, heterogeneous values and sparse unsupported evidence', () => {
    const prose = ['Worker opened the main channel successfully.', 'A long explanation follows with details.', 'Nothing was sent because the remote service is unavailable.'];
    for (const values of [prose, ['AB1', 'Different shape', '12.0'], ['Alpine', 'Marsh']]) {
      const column = inferColumnValues('time', values);
      expect(column.inferredType).toBe('String');
      expect(column.inferenceReason.length).toBeGreaterThan(20);
    }
    expect(inferColumnValues('unused', [null, undefined, '']).inferenceConfidence).toBe(0);
    expect(inferColumnValues('unused', []).inferredType).toBe('String');
  });

  it.each([
    ['time', ['OK', 'Error'], 'Set/Enum'],
    ['anything', ['12:34:56', '00:00:01'], 'DateTime'],
    ['anything', ['2026-10-24', '2026-10-25'], 'DateTime'],
    ['anything', ['2026-02-30', '2026-02-31'], 'String'],
    ['timestamp', ['24:00:00', 'bad'], 'String'],
    ['enabled', [true, false, true], 'Boolean'],
    ['enabled', ['OK', 'Error', 'not OK'], 'Set/Enum'],
    ['count', ['1', 'bad', '2'], 'String'],
    ['anything', ['1', '2', '3'], 'Int'],
    ['anything', ['1.25', '2.50'], 'Float'],
  ])('validates primitive values rather than trusting %s: %j', (header, values, type) => {
    expect(inferColumnValues(header, values).inferredType).toBe(type);
  });

  it('counts missing values over the same bounded population and restores omission rate on import', () => {
    const result = inspect('nullable.jsonl', [{ result: 'OK' }, { result: null }, {}, { result: 'Error' }].map(value => JSON.stringify(value)).join('\n'));
    const column = result.extractedColumns[0];
    expect(column.sampleCount).toBe(4);
    expect(column.nonNullCount).toBe(2);
    expect(column.distinctCount).toBe(2);
    expect(column.nullRatio).toBe(0.5);
    const imported = JSON.parse(exportSimulationTemplateJson(result));
    expect(imported.columns[0].skip_pct).toBe(50);
    expect(imported.columns[0].notes).toBe(column.inferenceReason);
    expect(inferColumnValues('large', Array.from({ length: 500 }, () => 'OK')).sampleCount).toBe(MAX_INFERENCE_RECORDS);
  });

  it.each(['csv', 'jsonl', 'xlsx'])('uses the same 200-record population for %s statistics and decisions', format => {
    const values = Array.from({ length: 230 }, (_, i) => i < 180 ? 'OK' : 'Error');
    let result;
    if (format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['result'], ...values.map(value => [value])]), 'Data');
      const bytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
      result = analyzeFolderFiles([{ name: 'test.xlsx', rawBytes: bytes, size: bytes.length, lastModified: 1 }]);
    } else result = inspect(`test.${format}`, format === 'csv' ? `result\n${values.join('\n')}\n` : values.map(value => JSON.stringify({ result: value })).join('\n'));
    expect(result.extractedColumns[0].sampleCount).toBe(200);
    expect(result.extractedColumns[0].valueFrequencies).toEqual([{ value: 'OK', count: 180 }, { value: 'Error', count: 20 }]);
    expect(result.fileProfiles?.[0].columns[0].sampleCount).toBe(200);
  });

  it.each([
    [['00:00', '23:59'], 'HH:mm', /^\d{2}:\d{2}$/],
    [['00:00:00.1', '23:59:59.999'], 'HH:mm:ss.SSS', /^\d{2}:\d{2}:\d{2}\.\d{3}$/],
    [['00:00:00', '23:59:59'], 'time', /^\d{2}:\d{2}:\d{2}$/],
  ] as const)('exports and generates time-only samples %j without adding dates', (values, rule, matcher) => {
    const result = inspect('clocks.csv', `observed\n${values.join('\n')}\n`);
    expect(result.extractedColumns[0].inferredType).toBe('DateTime');
    expect(result.extractedColumns[0].inferredRule).toBe(rule);
    const imported = JSON.parse(exportSimulationTemplateJson(result));
    const rows = new GeneratorEngine().generateBatch(imported.columns, 10);
    rows.forEach(row => expect(row.observed).toMatch(matcher));
  });

  it.each(['24:00', '23:60', '24:00:00.001', '12:00:60.000'])('rejects invalid clock %s', value => {
    expect(inferColumnValues('time', [value]).inferredType).toBe('String');
  });

  it('keeps quoted CSV label spaces and derives template confidence from field evidence', () => {
    const result = inspect('results.csv', 'result\n" not OK "\n"OK"\n"Error"\n');
    expect(parseEnumRule(result.extractedColumns[0].inferredRule).map(item => item.value)).toEqual([' not OK ', 'OK', 'Error']);
    expect(result.suggestedTemplate.confidence).toBe(result.extractedColumns[0].inferenceConfidence);
    const sparse = inspect('notes.csv', 'comment\nA short free-form explanation follows.\n');
    expect(sparse.suggestedTemplate.confidence).toBeLessThan(60);
    expect(sparse.suggestedTemplate.reason).toContain('1 sampled record');
  });

});
