import { describe, it, expect } from 'vitest';
import { formatDataset } from '../utils/export';
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
    const csv = formatDataset(columns, data, 'csv');
    const lines = csv.trim().split('\n');

    expect(lines[0]).toBe('id,name,score');
    expect(lines[1]).toBe('1,Alice Smith,95');
    expect(lines[2]).toBe('2,"Bob Jones, Jr.",88');
    expect(lines[3]).toBe('3,,72');
  });

  it('formats as TSV correctly with tabs', () => {
    const tsv = formatDataset(columns, data, 'tsv');
    const lines = tsv.trim().split('\n');

    expect(lines[0]).toBe('id\tname\tscore');
    expect(lines[1]).toBe('1\tAlice Smith\t95');
    expect(lines[3]).toBe('3\t\t72');
  });

  it('formats as JSON array', () => {
    const jsonStr = formatDataset(columns, data, 'json');
    const parsed = JSON.parse(jsonStr);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].id).toBe(1);
    expect(parsed[0].name).toBe('Alice Smith');
    expect(parsed[2].name).toBeNull();
  });

  it('formats as JSONL (newline-delimited JSON)', () => {
    const jsonl = formatDataset(columns, data, 'jsonl');
    const lines = jsonl.trim().split('\n');

    expect(lines).toHaveLength(3);
    const row1 = JSON.parse(lines[0]);
    const row2 = JSON.parse(lines[1]);
    expect(row1.name).toBe('Alice Smith');
    expect(row2.name).toBe('Bob Jones, Jr.');
  });

  it('formats as SQL INSERT statements', () => {
    const sql = formatDataset(columns, data, 'sql', 'custom_users');

    expect(sql).toContain('INSERT INTO custom_users (`id`, `name`, `score`) VALUES');
    expect(sql).toContain('(1, \'Alice Smith\', 95)');
    expect(sql).toContain('(3, NULL, 72)');
  });
});
