import { describe, expect, it, vi } from 'vitest';
import { analyzeFolderFiles, detectFileLock, readFilesFromHtmlFileList, readFolderFromDirectoryHandle } from '../utils/folderBehaviorAnalyzer';
import { decodeTextSample, detectNewlines } from '../utils/textDecoding';
import { analyzeLogSample } from '../utils/logAnalysis';
import { GeneratorEngine } from '../utils/generator';
import * as XLSX from 'xlsx';

const analyze = (name: string, bytes: Uint8Array) => analyzeFolderFiles([{ name, size: bytes.length, lastModified: 1, rawBytes: bytes }]);
const utf8 = (s: string) => new TextEncoder().encode(s);

describe('byte samples and log inference', () => {
  it('validates UTF-8 before considering overlapping legacy Thai byte ranges', () => {
    const decoded = decodeTextSample(utf8('ข้อมูล ภาษาไทย 日本語 café'));
    expect(decoded.encoding).toBe('UTF-8');
    expect(decoded.text).toBe('ข้อมูล ภาษาไทย 日本語 café');
  });

  it.each(['le', 'be'])('decodes actual UTF-16 %s bytes before extracting headers and preview', endian => {
    const text = 'time,status\r\n2026-10-24,OK\r\n';
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes.set(endian === 'le' ? [255, 254] : [254, 255]);
    Array.from(text).forEach((c, i) => { bytes[2 + i * 2 + (endian === 'le' ? 0 : 1)] = c.charCodeAt(0); });
    const result = analyze('utf16.csv', bytes);
    expect(result.extractedColumns.map(c => c.name)).toEqual(['time', 'status']);
    expect(result.sampleSnippet).toBe(text);
    expect(result.fileProfiles?.[0].newlineType).toBe('CRLF (Windows)');
    expect(result.fileProfiles?.[0].encodingConfidence).toBe(100);
  });

  it('decodes legacy Thai and labels confidence as heuristic', () => {
    const bytes = new Uint8Array([...utf8('message\n'), 0xa1, 0xa2, 0xa3, 0xa4, 0xa5]);
    const result = analyze('legacy.csv', bytes);
    expect(result.extractedColumns[0].sampleValues[0]).toBe('กขฃคฅ');
    expect(result.fileProfiles?.[0].encoding).toBe('TIS-620 / Windows-874');
    expect(result.fileProfiles?.[0].encodingConfidence).toBeLessThan(80);
    expect(result.fileProfiles?.[0].encodingEvidence.join(' ')).toContain('ambiguous');
  });

  it('does not classify Western accents as certain Thai or invalid complete UTF-8', () => {
    expect(decodeTextSample(new Uint8Array([0x63, 0x61, 0x66, 0xe9])).encoding).toBe('Windows-1252 / ISO-8859-1');
    expect(decodeTextSample(new Uint8Array([65, 0xe0, 0xb8]), true).encoding).toBe('UTF-8');
  });

  it('excludes binary samples from text extraction and preview', () => {
    const result = analyze('image.log', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]));
    expect(result.extractedColumns).toEqual([]);
    expect(result.sampleSnippet).toBeUndefined();
    expect(result.fileProfiles?.[0].format).toBe('binary');
    expect(result.fileProfiles?.[0].readStatus).toBe('binary');
  });

  it('parses JSONL in .log files with union fields and ignores incomplete final sampled record', () => {
    const result = analyze('events.log', utf8('{"timestamp":"2026-10-24T10:00:00Z","level":"INFO","message":"ready"}\n{"level":"ERROR","duration":2.5}\n{"partial":'));
    expect(result.fileProfiles?.[0].format).toBe('jsonl');
    expect(result.suggestedMode.format).toBe('jsonl');
    expect(result.extractedColumns.map(c => c.name)).toEqual(['timestamp', 'level', 'message', 'duration']);
    expect(result.extractedColumns.find(c => c.name === 'level')?.inferredType).toBe('Set/Enum');
  });

  it('parses common and combined access logs into useful generator columns', () => {
    const result = analyze('access.log', utf8('127.0.0.1 - bob [24/Oct/2026:12:01:02 +0000] "GET /health HTTP/1.1" 200 44 "-" "curl/8.0"\n127.0.0.2 - - [24/Oct/2026:12:01:03 +0000] "POST /jobs HTTP/1.1" 201 72'));
    expect(result.fileProfiles?.[0].format).toBe('apache_nginx');
    expect(result.extractedColumns.map(c => c.name)).toContain('client_ip');
    expect(result.extractedColumns.find(c => c.name === 'status')?.inferredType).toBe('Int');
    expect(result.fileProfiles?.[0].sampleRows[0]).toContain('/health');
  });

  it('parses timestamp/level/message and preserves stack continuations', () => {
    const result = analyze('application.log', utf8('[2026-10-24 10:00:00] [ERROR] Failed, retrying\n  at worker.ts:4\n2026-10-24T10:00:01Z INFO Ready'));
    expect(result.fileProfiles?.[0].format).toBe('timestamp_level');
    expect(result.extractedColumns.map(c => c.name)).toEqual(['timestamp', 'level', 'message']);
    expect(result.extractedColumns[2].sampleValues[0]).toContain('worker.ts:4');
  });

  it('parses quoted key=value fields and retains real values', () => {
    const sample = analyzeLogSample('time=2026-10-24T00:00:00Z level=INFO msg="worker started" duration=1.2');
    expect(sample.format).toBe('key_value');
    expect(sample.records[0].msg).toBe('worker started');
  });

  it('uses a message column for plain text instead of the first log line as a header', () => {
    const result = analyze('plain.log', utf8('Worker started successfully\nWorker stopped normally'));
    expect(result.extractedColumns.map(c => c.name)).toEqual(['message']);
    expect(result.forensics.sampleLogFormat).toBe('generic_text');
    expect(result.forensics.delimiter).toBeUndefined();
  });

  it('detects all mixed newline combinations', () => {
    expect(detectNewlines('a\r\nb\rc\n')).toBe('Mixed');
    expect(detectNewlines('a\rb\n')).toBe('Mixed');
    expect(detectNewlines('one line')).toBe('None');
  });

  it('respects byte and file caps even for structured file extensions', async () => {
    const files = [new File(['a,b\n1,2\n'], 'first.csv'), new File(['{"x":1}'], 'second.jsonl')];
    const read = await readFilesFromHtmlFileList(files, 1, 4);
    expect(read[0].rawBytes).toHaveLength(4);
    expect(read[0].truncated).toBe(true);
    expect(read[1].rawBytes).toBeUndefined();
    expect(read[1].readStatus).toBe('skipped');
  });

  it('separates permission failure from lock evidence and never infers append from mtime', async () => {
    const denied = { name: 'private.log', size: 10, lastModified: Date.now(), slice: () => ({ arrayBuffer: () => Promise.reject(new Error('Permission denied')) }) } as unknown as File;
    const [file] = await readFilesFromHtmlFileList([denied]);
    expect(file.isLocked).toBe(false);
    expect(file.readStatus).toBe('read_error');
    expect(file.readError).toBe('Permission denied');
    expect(detectFileLock([file], 'high_frequency_stream').hasContinuousAppend).toBe(false);
    expect(detectFileLock([{ ...file, isLocked: true, lockReason: 'sharing violation' }], 'unknown').fileLockStatus).toBe('file_in_use_error');
  });

  it('propagates enumeration errors instead of presenting an empty folder', async () => {
    const values = vi.fn(async function* () { throw new Error('Directory unavailable'); });
    await expect(readFolderFromDirectoryHandle({ values })).rejects.toThrow('Directory unavailable');
  });

  it('preview and inferred columns come from the same selected source', () => {
    const result = analyzeFolderFiles([{ name: 'first.bin', size: 1, lastModified: 1 }, { name: 'selected.csv', size: 8, lastModified: 1, sampleContent: 'a,b\n1,2\n' }]);
    expect(result.sampleFileUsed).toBe('selected.csv');
    expect(result.sampleSnippet).toBe('a,b\n1,2\n');
  });

  it('generates values within observed numeric ranges without accidental name-substring types', () => {
    const result = analyze('application.jsonl', utf8('{"status":200,"duration":1.2,"user_agent":"curl/8.0","description":"ready","level":"INFO"}\n{"status":201,"duration":1.5,"user_agent":"curl/8.1","description":"started","level":"ERROR"}'));
    const columns = result.suggestedTemplate.columns;
    expect(columns.find(c => c.name === 'status')?.rule).toBe('200, 201');
    expect(columns.find(c => c.name === 'user_agent')?.type).toBe('String');
    expect(columns.find(c => c.name === 'description')?.type).toBe('String');
    const rows = new GeneratorEngine().generateBatch(columns, 40);
    for (const row of rows) {
      expect([200, 201]).toContain(row.status);
      expect(Number(row.duration)).toBeGreaterThanOrEqual(1.2);
      expect(Number(row.duration)).toBeLessThanOrEqual(1.5);
      expect(['INFO', 'ERROR']).toContain(row.level);
      expect(typeof row.user_agent).toBe('string');
    }
  });

  it('does not invent boolean or sequence types when headers have no complete sample values', () => {
    const result = analyze('empty.csv', utf8('id,is_enabled,status\n'));
    expect(result.extractedColumns.map(c => c.inferredType)).toEqual(['String', 'String', 'String']);
  });

  it('retains colon-bearing enum values and falls back safely for comma-bearing values', () => {
    const result = analyze('events.jsonl', utf8('{"status":"stage:30","category":"one,two"}\n{"status":"stage:40","category":"three,four"}'));
    expect(result.extractedColumns.find(c => c.name === 'category')?.inferredType).toBe('String');
    const rows = new GeneratorEngine().generateBatch(result.suggestedTemplate.columns, 10);
    rows.forEach(row => expect(['stage:30', 'stage:40']).toContain(row.status));
  });

  it('retains partial text in the preview while excluding incomplete CSV record values', () => {
    const bytes = utf8('status,duration\n200,1.2\n999,999');
    const result = analyzeFolderFiles([{ name: 'partial.csv', size: 1000, lastModified: 1, rawBytes: bytes, truncated: true }]);
    expect(result.sampleSnippet).toContain('999,999');
    expect(result.extractedColumns.find(c => c.name === 'status')?.sampleValues).toEqual(['200']);
    expect(result.extractedColumns.find(c => c.name === 'duration')?.sampleValues).toEqual(['1.2']);
    expect(result.fileProfiles?.[0].columns.find(c => c.name === 'status')?.inferredRule).toBe('200, 200');
  });


  it('distinguishes no newline from absent or unreadable text evidence', () => {
    expect(analyze('single.log', utf8('one line')).forensics.newlineType).toBe('None');
    expect(analyzeFolderFiles([]).forensics.newlineType).toBe('Unknown');
    const inaccessible = analyzeFolderFiles([{ name: 'private.log', size: 9, lastModified: 1, readStatus: 'read_error', readError: 'denied' }]);
    expect(inaccessible.forensics.newlineType).toBe('Unknown');
    expect(inaccessible.fileProfiles?.[0].newlineType).toBe('Unknown');
    const binary = analyze('image.log', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(binary.forensics.newlineType).toBe('Unknown');
    expect(binary.fileProfiles?.[0].newlineType).toBe('Unknown');
  });

  it('sanitizes reserved object property column names for safe generator rows', () => {
    const result = analyze('reserved.json', utf8('{"__proto__":"a","constructor":"b","prototype":"c"}'));
    expect(result.extractedColumns.map(column => column.name)).toEqual(['field_proto', 'field_constructor', 'field_prototype']);
    const [row] = new GeneratorEngine().generateBatch(result.suggestedTemplate.columns, 1);
    expect(Object.keys(row)).toEqual(['field_proto', 'field_constructor', 'field_prototype']);
  });


  it('selects CSV, JSONL and text log schemas consistently while retaining the entire inventory', () => {
    const sources = [
      { name: 'measurements.csv', relativePath: '/logs/measurements.csv', size: 30, lastModified: 1, sampleContent: 'station,temp\nA,22.5\n' },
      { name: 'requests.jsonl', relativePath: '/logs/requests.jsonl', size: 40, lastModified: 2, sampleContent: '{"request_id":"abc","latency":15}\n' },
      { name: 'application.log', relativePath: '/logs/application.log', size: 50, lastModified: 3, sampleContent: '[2026-10-24 10:00:00] [INFO] Ready\n' },
    ];
    const expectations = [
      ['measurements.csv', ['station', 'temp'], 'delimited_csv'],
      ['/logs/requests.jsonl', ['request_id', 'latency'], 'json_stream'],
      ['application.log', ['timestamp', 'level', 'message'], 'iso_timestamp_bracketed'],
    ] as const;
    for (const [preferred, headers, logFormat] of expectations) {
      const result = analyzeFolderFiles(sources, 'mixed', undefined, preferred);
      const selected = sources.find(file => file.name === preferred || file.relativePath === preferred)!;
      expect(result.sampleFileUsed).toBe(selected.relativePath || selected.name);
      expect(result.sampleSnippet).toBe(selected.sampleContent);
      expect(result.extractedColumns.map(column => column.name)).toEqual(headers);
      expect(result.suggestedTemplate.columns.map(column => column.name)).toEqual(headers);
      expect(result.forensics.sampleLogFormat).toBe(logFormat);
      expect(result.metrics.totalFiles).toBe(3);
      expect(result.metrics.totalSizeBytes).toBe(120);
      expect(result.metrics.formatDistribution).toEqual({ csv: 1, jsonl: 1, log: 1 });
      expect(result.files).toHaveLength(3);
      expect(result.fileProfiles).toHaveLength(3);
    }
  });

  it('falls back from an unavailable preferred source without losing inventory', () => {
    const result = analyzeFolderFiles([
      { name: 'locked.log', size: 50, lastModified: 1, readStatus: 'read_error', readError: 'denied' },
      { name: 'ready.csv', size: 20, lastModified: 2, sampleContent: 'id,value\n1,4\n' },
    ], 'mixed', undefined, 'locked.log');
    expect(result.sampleFileUsed).toBe('ready.csv');
    expect(result.extractedColumns.map(column => column.name)).toEqual(['id', 'value']);
    expect(result.metrics.totalFiles).toBe(2);
  });


  it('distinguishes duplicate basenames by stable relative-path identity', () => {
    const files = [
      { name: 'events.log', relativePath: 'service-a/events.log', size: 20, lastModified: 1, sampleContent: 'station,temp\nA,25\n' },
      { name: 'events.log', relativePath: 'service-b/events.log', size: 30, lastModified: 2, sampleContent: '{"trace_id":"abc","duration":2}\n' },
    ];
    const result = analyzeFolderFiles(files, 'mixed', undefined, 'service-b/events.log');
    expect(result.sampleFileUsed).toBe('service-b/events.log');
    expect(result.extractedColumns.map(column => column.name)).toEqual(['trace_id', 'duration']);
    expect(result.sampleSnippet).toBe(files[1].sampleContent);
    expect(result.fileProfiles?.map(profile => profile.sourceId)).toEqual(['service-a/events.log', 'service-b/events.log']);
    expect(result.fileProfiles?.map(profile => profile.name)).toEqual(['events.log', 'events.log']);
    expect(result.metrics.totalFiles).toBe(2);
  });


  it('uses recognized record structure instead of commas in JSON/log messages as delimiter evidence', () => {
    const json = analyze('service.log', utf8('{"level":"INFO","message":"hello, world"}\n{"level":"ERROR","message":"retry, later"}'));
    expect(json.forensics.sampleLogFormat).toBe('json_stream');
    expect(json.forensics.delimiter).toBeUndefined();
    expect(json.forensics.delimiterName).toBe('JSON records (no field delimiter)');
    const logs = [
      '[2026-10-24 10:00:00] [INFO] hello, world\n[2026-10-24 10:00:01] [ERROR] retry, later',
      'level=INFO message="hello, world"\nlevel=ERROR message="retry, later"',
      '127.0.0.1 - - [24/Oct/2026:12:01:02 +0000] "GET /hello,world HTTP/1.1" 200 44',
    ];
    for (const text of logs) {
      const result = analyze('service.log', utf8(text));
      expect(result.forensics.delimiter).toBe(' ');
      expect(result.forensics.delimiterName).not.toContain('Comma');
      expect(result.forensics.sampleLogFormat).not.toBe('delimited_csv');
    }
  });


  it.each(['xlsx', 'xls'] as const)('retains %s spreadsheet schemas without decoding workbook binary as log text', bookType => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['station', 'temperature', 'status'], ['A', 22.5, 'PASS'], ['B', 23.2, 'FAIL']]), 'Measurements');
    const bytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType }));
    expect(bytes.byteLength).toBeLessThan(65_536);
    const result = analyze(`measurements.${bookType}`, bytes);
    expect(result.extractedColumns.map(column => column.name)).toEqual(['station', 'temperature', 'status']);
    expect(result.fileProfiles?.[0].columns.map(column => column.name)).toEqual(['station', 'temperature', 'status']);
    expect(result.fileProfiles?.[0].format).toBe('spreadsheet');
    expect(result.sampleSnippet).toBeUndefined();
    expect(result.fileProfiles?.[0].formatEvidence.join(' ')).toContain('fully sampled workbook');
  });

  it('does not parse a truncated workbook or unknown binary ZIP into garbage columns', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['id', 'value'], [1, 2]]), 'Data');
    const complete = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
    const result = analyzeFolderFiles([{ name: 'large.xlsx', size: complete.length, rawBytes: complete.subarray(0, 64), truncated: true, lastModified: 1 }]);
    expect(result.extractedColumns).toEqual([]);
    expect(result.fileProfiles?.[0].columns).toEqual([]);
    expect(result.fileProfiles?.[0].formatEvidence.join(' ')).toContain('exceeds the bounded sample');
    const zip = analyze('archive.zip', new Uint8Array([80, 75, 3, 4, 0, 0, 0, 0, 1, 2, 3]));
    expect(zip.extractedColumns).toEqual([]);
    expect(zip.fileProfiles?.[0].format).toBe('binary');
  });

});
