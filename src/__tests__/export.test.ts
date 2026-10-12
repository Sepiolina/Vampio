import { describe, it, expect } from 'vitest';
import { formatDataset, resolveMultiFilename } from '../utils/export';
import { ColumnSpec } from '../types';

describe('formatDataset', () => {
  const columns: ColumnSpec[] = [
    { id: '1', name: 'id', type: 'Sequence', rule: '1', skip_pct: 0, condition: '' },
    { id: '2', name: 'name', type: 'Entity', rule: 'full_name', skip_pct: 0, condition: '' },
    { id: '3', name: 'score', type: 'Int', rule: '50, 100', skip_pct: 0, condition: '' }
  ];

  const data = [
    { id: 1, name: 'Alice Smith', score: 95 },
    { id: 2, name: 'Bob Jones, Jr.', score: 88 },
    { id: 3, name: null, score: 72 }
  ];

  it('formats as CSV correctly with header and quoting', () => {
    const csv = formatDataset(columns, data, 'csv') as string;
    const lines = csv.trim().split('\n');

    expect(lines[0]).toBe('id,name,score');
    expect(lines[1]).toBe('1,Alice Smith,95');
    expect(lines[2]).toBe('2,"Bob Jones, Jr.",88');
    expect(lines[3]).toBe('3,,72');
  });

  it('formats as TSV correctly with tabs', () => {
    const tsv = formatDataset(columns, data, 'tsv') as string;
    const lines = tsv.trim().split('\n');

    expect(lines[0]).toBe('id\tname\tscore');
    expect(lines[1]).toBe('1\tAlice Smith\t95');
    expect(lines[3]).toBe('3\t\t72');
  });

  it('formats as JSON array', () => {
    const jsonStr = formatDataset(columns, data, 'json') as string;
    const parsed = JSON.parse(jsonStr);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].id).toBe(1);
    expect(parsed[0].name).toBe('Alice Smith');
    expect(parsed[2].name).toBeNull();
  });

  it('formats as JSONL (newline-delimited JSON)', () => {
    const jsonl = formatDataset(columns, data, 'jsonl') as string;
    const lines = jsonl.trim().split('\n');

    expect(lines).toHaveLength(3);
    const row1 = JSON.parse(lines[0]);
    const row2 = JSON.parse(lines[1]);
    expect(row1.name).toBe('Alice Smith');
    expect(row2.name).toBe('Bob Jones, Jr.');
  });

  it('formats as XML dataset', () => {
    const xml = formatDataset(columns, data, 'xml') as string;
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<record>');
    expect(xml).toContain('<name>Alice Smith</name>');
  });

  it('formats as Excel workbook binary (Uint8Array)', () => {
    const xlsx = formatDataset(columns, data, 'xlsx');
    expect(xlsx instanceof Uint8Array).toBe(true);
    expect((xlsx as Uint8Array).byteLength).toBeGreaterThan(0);
  });

  it('formats with custom JSON template when enabled', () => {
    const customConfig = {
      enabled: true,
      template: `{
        "status": "success",
        "table": "{{tableName}}",
        "total": "{{count}}",
        "data": "{{records}}"
      }`,
      prettyPrint: true,
    };

    const output = formatDataset(columns, data, 'json', 'test_items', customConfig) as string;
    const parsed = JSON.parse(output);

    expect(parsed.status).toBe('success');
    expect(parsed.table).toBe('test_items');
    expect(parsed.total).toBe(3);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data).toHaveLength(3);
    expect(parsed.data[0].name).toBe('Alice Smith');
  });

  it('correctly resolves multi-file filenames and replaces {ext} with .csv instead of literal .{ext}', () => {
    // Exact user scenario: pattern is '{filename}_{index}.{ext}' and format is configured as 'csv'
    const filename1 = resolveMultiFilename('{filename}_{index}.{ext}', 'sales_report', 1, 'csv');
    expect(filename1).toBe('sales_report_00001.csv');
    expect(filename1).not.toContain('{ext}');

    // Subsequent index check
    const filename2 = resolveMultiFilename('{filename}_{index}.{ext}', 'sales_report', 42, 'csv');
    expect(filename2).toBe('sales_report_00042.csv');

    // Case-insensitive test
    const filenameUpper = resolveMultiFilename('{FILENAME}_{INDEX}.{EXT}', 'order_event', 5, 'csv');
    expect(filenameUpper).toBe('order_event_00005.csv');

    // Missing extension in pattern still gets .csv
    const filenameNoExt = resolveMultiFilename('{filename}_{index}', 'events', 1, 'csv');
    expect(filenameNoExt).toBe('events_00001.csv');
  });
});

