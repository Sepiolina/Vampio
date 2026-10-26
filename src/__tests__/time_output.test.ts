import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { ColumnSpec, ExportFormat } from '../types';
import { GeneratorEngine } from '../utils/generator';
import { appendRowsToTextFile, appendRowsToWorkbook, formatDataset } from '../utils/export';

const column = (name: string, rule: string): ColumnSpec => ({ id: name, name, type: 'DateTime', rule, skip_pct: 0, condition: '' });
const specs = [column('time', 'HH:mm:ss'), column('date', 'MM/DD/YYYY'), column('recorded_at', 'YYYY-MM-DD HH:mm:ss')];

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function generatedRow() {
  // Local time is intentional: explicit formats use the same local clock as the existing generator.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 26, 9, 7, 5, 123));
  vi.spyOn(Math, 'random').mockReturnValue(0);
  return new GeneratorEngine().generateBatch(specs, 1)[0];
}

function read(bytes: Uint8Array) {
  return XLSX.read(bytes, { type: 'array', cellStyles: true });
}

describe('time output and spreadsheet display', () => {
  it('honors time-only, extracted slash dates, full timestamp formats and existing datetime aliases', () => {
    generatedRow();
    const rules = ['time', 'HH:mm:ss', 'HH:mm', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSS', 'ISO', 'unix', 'past_30d'];
    const result = new GeneratorEngine().generateBatch(rules.map(rule => column(rule, rule)), 1)[0];
    expect(result.time).toBe('09:07:05');
    expect(result['HH:mm:ss']).toBe('09:07:05');
    expect(result['HH:mm']).toBe('09:07');
    expect(result['MM/DD/YYYY']).toBe('10/26/2026');
    expect(result['DD/MM/YYYY']).toBe('26/10/2026');
    expect(result['YYYY-MM-DD']).toBe('2026-10-26');
    expect(result['YYYY-MM-DDTHH:mm:ss.SSS']).toBe('2026-10-26T09:07:05.123');
    expect(result.ISO).toBe(new Date().toISOString());
    expect(result.unix).toBe(String(Math.floor(Date.now() / 1000)));
    expect(result.past_30d).toBe('2026-10-26 09:07:05');
  });

  it('preserves generated time strings in every text serializer and appended text', () => {
    const row = generatedRow();
    for (const format of ['csv', 'tsv', 'json', 'jsonl', 'txt', 'sql', 'xml'] as ExportFormat[]) {
      expect(formatDataset(specs, [row], format)).toContain('09:07:05');
      expect(appendRowsToTextFile('', specs, [row], format)).toContain('09:07:05');
    }
  });

  it.each(['xlsx', 'xls'] as const)('writes readable %s time columns as strings with bounded content widths', format => {
    const row = generatedRow();
    const workbook = read(formatDataset(specs, [row], format) as Uint8Array);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(sheet.A2).toMatchObject({ t: 's', v: '09:07:05' });
    expect(sheet.B2).toMatchObject({ t: 's', v: '10/26/2026' });
    expect(sheet.C2).toMatchObject({ t: 's', v: '2026-10-26 09:07:05' });
    expect(sheet['!cols']?.[0].wch).toBeGreaterThanOrEqual(10);
    expect(sheet['!cols']?.[2].wch).toBeGreaterThanOrEqual(21);
    const longSpecs = [column('description', '')];
    const longSheetWb = read(formatDataset(longSpecs, [{ description: 'x'.repeat(1000) }], format) as Uint8Array);
    expect(longSheetWb.Sheets[longSheetWb.SheetNames[0]]['!cols']?.[0].wch).toBeLessThanOrEqual(60.1);
  });

  it.each(['xlsx', 'biff8'] as const)('expands append columns and preserves wider user columns in %s', bookType => {
    const original = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['time', 'recorded_at'], ['09:07:05', '2026-10-26 09:07:05']]);
    sheet['!cols'] = [{ wch: 40 }, { wch: 5 }];
    XLSX.utils.book_append_sheet(original, sheet, 'Original');
    const imported = read(new Uint8Array(XLSX.write(original, { type: 'array', bookType })));
    const oldWidth = imported.Sheets.Original['!cols']![0].wch!;
    const appended = read(appendRowsToWorkbook(imported, [{ time: '23:59:59', recorded_at: '2026-10-27 23:59:59' }], ['time', 'recorded_at'], 'Original', bookType));
    expect(appended.Sheets.Original.A3).toMatchObject({ t: 's', v: '23:59:59' });
    expect(appended.Sheets.Original.B3).toMatchObject({ t: 's', v: '2026-10-27 23:59:59' });
    expect(appended.Sheets.Original['!cols']![0].wch).toBeGreaterThanOrEqual(oldWidth - 0.1);
    expect(appended.Sheets.Original['!cols']![1].wch).toBeGreaterThanOrEqual(21);
    const newWorkbook = read(appendRowsToWorkbook(appended, [{ time: '12:30:45', recorded_at: '2026-10-28 12:30:45' }], ['time', 'recorded_at'], undefined, bookType, 'new_sheet', 'New'));
    expect(newWorkbook.Sheets.New.A2).toMatchObject({ t: 's', v: '12:30:45' });
    expect(newWorkbook.Sheets.New['!cols']![1].wch).toBeGreaterThanOrEqual(21);
    expect(newWorkbook.Sheets.Original['!cols']![0].wch).toBeGreaterThanOrEqual(oldWidth - 0.1);
    const empty = read(appendRowsToWorkbook(undefined, [{ time: '12:30:45' }], ['time'], undefined, bookType));
    expect(empty.Sheets.Sheet1.A2).toMatchObject({ t: 's', v: '12:30:45' });
    expect(empty.Sheets.Sheet1['!cols']![0].wch).toBeGreaterThanOrEqual(10);
  });
});
