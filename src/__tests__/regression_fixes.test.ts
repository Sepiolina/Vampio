import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeneratorEngine } from '../utils/generator';
import { generateRegexString } from '../utils/regexSynthesizer';
import {
  formatDataset,
  appendRowsToTextFile,
  resolveMultiFilename,
  formatBytes,
  toXmlTag,
} from '../utils/export';
import { renderCustomJsonTemplate } from '../utils/customJsonTemplate';
import {
  matchesTriggerCondition,
  buildActionHeaders,
  dispatchActionRequest,
  defaultActionConfig,
} from '../utils/actionDispatcher';
import {
  createStreamFileWriter,
  createMultiFileStreamWriter,
  createVirtualDirectoryHandle,
  sanitizeRelativeFilename,
} from '../utils/fileSystem';
import * as exportUtils from '../utils/export';
import { ColumnSpec } from '../types';

const col = (name: string, type: ColumnSpec['type'] = 'Int', rule = ''): ColumnSpec => ({
  id: name, name, type, rule, skip_pct: 0, condition: '',
});

describe('Calculation column', () => {
  const calc = (rule: string, row: Record<string, unknown>) =>
    (new GeneratorEngine() as any).evaluateCalculation(rule, row);

  it('handles negative operands without producing "--"', () => {
    expect(calc('{a}-{b}', { a: 3, b: -5 })).toBe(8);
    expect(calc('{a}+{b}', { a: 3, b: -5 })).toBe(-2);
  });
  it('supports whitelisted Math functions and exponent operator', () => {
    expect(calc('Math.max({a},{b})*2', { a: 3, b: 7 })).toBe(14);
    expect(calc('2**3', {})).toBe(8);
  });
  it('rejects anything that is not a plain math expression', () => {
    expect(calc('Math.constructor', {})).toBe('CALC_INVALID_CHARS');
    expect(calc('alert(1)', {})).toBe('CALC_INVALID_CHARS');
    expect(calc('Math.random()', {})).toBe('CALC_INVALID_CHARS');
  });
});

describe('Set/Enum rule parsing', () => {
  it('keeps colons that are part of the value (weight is the LAST ":number")', () => {
    const g = new GeneratorEngine() as any;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(g.generateEnum('a:b:50, c:d:50'));
    expect([...seen].sort()).toEqual(['a:b', 'c:d']);
  });
  it('leaves non-numeric "x:y" items untouched', () => {
    const g = new GeneratorEngine() as any;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(g.generateEnum('http://a, http://b'));
    expect([...seen].sort()).toEqual(['http://a', 'http://b']);
  });
  it('still honours weights', () => {
    const g = new GeneratorEngine() as any;
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) counts[g.generateEnum('a:90, b:10')]++;
    expect(counts.a).toBeGreaterThan(counts.b * 3);
  });
});

describe('Regex synthesizer', () => {
  const matches = (pattern: string, n = 150) => {
    const re = new RegExp(`^(?:${pattern})$`);
    for (let i = 0; i < n; i++) {
      const v = generateRegexString(pattern);
      expect(re.test(v), `${pattern} -> ${JSON.stringify(v)}`).toBe(true);
    }
  };
  it('supports top-level alternation', () => matches('cat|dog'));
  it('supports nested groups with alternation', () => matches('(a(b|c)|d)'));
  it('treats {0} as zero repetitions', () => matches('x{0}y'));
  it('does not emit lazy/possessive modifiers as literals', () => matches('\\d+?'));
  it('ignores word-boundary escapes', () => matches('\\bfoo\\b'));
  it('keeps an escaped trailing dollar', () => matches('price\\$'));
  it('supports lookahead without emitting it', () => {
    for (let i = 0; i < 50; i++) expect(generateRegexString('(?=a)abc')).toBe('abc');
  });
  it('re-picks the alternative for each group repetition', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateRegexString('(a|b){5}')));
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('Export formats', () => {
  it('TSV strips carriage returns as well as tabs/newlines', () => {
    const out = formatDataset([col('a', 'String')], [{ a: 'x\r\ny\tz' }], 'tsv') as string;
    expect(out.split('\n')).toEqual(['a', 'x  y z']);
  });

  it('XML tag names never start with a digit', () => {
    expect(toXmlTag('1st place')).toBe('_1st_place');
    const out = formatDataset([col('1st')], [{ '1st': 1 }], 'xml') as string;
    expect(out).toContain('<_1st>1</_1st>');
  });

  it('appending XML does not treat "$&" in data as a replacement pattern', () => {
    const existing = '<?xml version="1.0"?>\n<dataset>\n  <record>\n    <a>1</a>\n  </record>\n</dataset>';
    const out = appendRowsToTextFile(existing, [col('a', 'String')], [{ a: "$& $' $1" }], 'xml');
    expect(out).toContain("$&amp; $&apos; $1");
    expect(out.match(/<\/dataset>/g)?.length).toBe(1);
    expect(out.match(/<record>/g)?.length).toBe(2);
  });

  it('appending to unparseable JSON throws instead of silently discarding the file', () => {
    expect(() => appendRowsToTextFile('{broken', [col('a')], [{ a: 1 }], 'json')).toThrow(/not valid JSON/);
    expect(() => appendRowsToTextFile('{"a":1}', [col('a')], [{ a: 1 }], 'json')).toThrow(/array/);
    expect(JSON.parse(appendRowsToTextFile('[{"a":0}]', [col('a')], [{ a: 1 }], 'json'))).toEqual([{ a: 0 }, { a: 1 }]);
    expect(JSON.parse(appendRowsToTextFile('', [col('a')], [{ a: 1 }], 'json'))).toEqual([{ a: 1 }]);
  });

  it('SQL append uses the same quoting and table cleaning as full export', () => {
    const specs = [col('id'), col('name', 'String')];
    const full = (formatDataset(specs, [{ id: 1, name: 'a' }], 'sql', 'my table') as string);
    const appended = appendRowsToTextFile('', specs, [{ id: 1, name: 'a' }], 'sql', true, 'my table');
    expect(appended).toBe(full);
  });

  it('multi-file names cannot contain path separators from the base name', () => {
    const name = resolveMultiFilename('{filename}_{index}.{ext}', '../../etc/passwd', 1, 'csv');
    expect(name).not.toMatch(/[\\/]/);
    expect(name.endsWith('.csv')).toBe(true);
  });

  it('formatBytes copes with 0, fractions and very large values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(0.5)).toBe('0.5 B');
    expect(formatBytes(NaN)).toBe('0 B');
    expect(formatBytes(1024 ** 5)).toMatch(/TB$/);
  });
});

describe('Custom JSON templates', () => {
  it('escapes quotes/newlines of values interpolated inside strings', () => {
    const out = renderCustomJsonTemplate(
      { enabled: true, template: '{"msg": "Hi {{name}}!", "recs": "{{records}}"}' },
      [{ name: 'Bob "the" \n Builder' }],
      { tableName: 't', count: 1 }
    );
    const parsed = JSON.parse(out);
    expect(parsed.msg).toBe('Hi Bob "the" \n Builder!');
  });

  it('escapes a table name containing quotes', () => {
    const out = renderCustomJsonTemplate(
      { enabled: true, template: '{"t": "{{tableName}}", "n": {{count}}}' },
      [],
      { tableName: 'a"b', count: 3 }
    );
    expect(JSON.parse(out)).toEqual({ t: 'a"b', n: 3 });
  });

  it('does not re-expand placeholder-looking text found inside data', () => {
    const out = renderCustomJsonTemplate(
      { enabled: true, template: '{"c": "{{count}}", "r": "{{records}}"}' },
      [{ note: '{{count}}' }],
      { count: 1 }
    );
    expect(JSON.parse(out).r).toEqual([{ note: '{{count}}' }]);
  });

  it('row templates with inline placeholders stay valid JSON', () => {
    const out = renderCustomJsonTemplate(
      { enabled: true, template: '{"items": "{{records}}"}', rowTemplate: '{"label": "User {{name}}", "id": "{{id}}"}' },
      [{ id: 7, name: 'A"B' }],
      {}
    );
    expect(JSON.parse(out).items).toEqual([{ label: 'User A"B', id: 7 }]);
  });
});

describe('Action dispatcher', () => {
  afterEach(() => vi.restoreAllMocks());

  it('numeric triggers do not treat empty/null as 0', () => {
    const cond = { enabled: true, column: 'v', operator: 'greater_than', value: '-1' } as any;
    expect(matchesTriggerCondition({ v: null }, cond)).toBe(false);
    expect(matchesTriggerCondition({ v: '' }, cond)).toBe(false);
    expect(matchesTriggerCondition({ v: 0 }, cond)).toBe(true);
  });

  it('basic auth survives non-Latin1 credentials', () => {
    const h = buildActionHeaders({ ...defaultActionConfig, authType: 'basic', basicUser: 'ผู้ใช้', basicPass: 'pässword' });
    expect(h.Authorization).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(h.Authorization.slice(6)), (c) => c.charCodeAt(0)));
    expect(decoded).toBe('ผู้ใช้:pässword');
  });

  it('does not send a body with GET requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    await dispatchActionRequest({ ...defaultActionConfig, endpointUrl: 'http://x.test', method: 'GET' as any }, [{ a: 1 }], 0);
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    await dispatchActionRequest({ ...defaultActionConfig, endpointUrl: 'http://x.test', method: 'POST' }, [{ a: 1 }], 0);
    expect(fetchMock.mock.calls[1][1].body).toBeDefined();
    vi.unstubAllGlobals();
  });
});

describe('Stream writers', () => {
  afterEach(() => vi.restoreAllMocks());

  const capture = () => {
    let captured = '';
    vi.spyOn(exportUtils, 'downloadFile').mockImplementation((content: any) => {
      // Blob -> text asynchronously, so stash the promise
      (capture as any).p = (content as Blob).text().then((t) => { captured = t; });
    });
    return async () => { await (capture as any).p; return captured; };
  };

  it('JSON stream is valid regardless of whether the caller indexes from 0 or 1', async () => {
    for (const start of [0, 1]) {
      const read = capture();
      const w = await createStreamFileWriter(createVirtualDirectoryHandle('d'), 'o.json', [col('a')], 'json');
      await w.writeRow({ a: 1 }, start);
      await w.writeRow({ a: 2 }, start + 1);
      await w.close();
      expect(JSON.parse(await read())).toEqual([{ a: 1 }, { a: 2 }]);
    }
  });

  it('XML stream escapes values and sanitises tags', async () => {
    const read = capture();
    const w = await createStreamFileWriter(createVirtualDirectoryHandle('d'), 'o.xml', [col('1 a')], 'xml');
    await w.writeRow({ '1 a': '<&>' }, 0);
    await w.close();
    const xml = await read();
    expect(xml).toContain('<_1_a>&lt;&amp;&gt;</_1_a>');
  });

  it('rejects Excel formats and missing directories with a clear error', async () => {
    await expect(createStreamFileWriter(createVirtualDirectoryHandle('d'), 'o.xlsx', [col('a')], 'xlsx')).rejects.toThrow(/Excel/);
    await expect(createStreamFileWriter(null, 'o.csv', [col('a')], 'csv')).rejects.toThrow(/No output folder/);
    await expect(createMultiFileStreamWriter(null, '{index}', [col('a')], 'csv')).rejects.toThrow(/No output folder/);
  });

  it('multi-file stream honours {filename} with the supplied base name', async () => {
    vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});
    vi.spyOn(exportUtils, 'createZipArchive').mockImplementation(async (files) => {
      (createMultiFileStreamWriter as any).names = files.map((f) => f.filename);
      return new Blob(['z']);
    });
    const w = await createMultiFileStreamWriter(createVirtualDirectoryHandle('d'), '{filename}_{index}.csv', [col('a')], 'csv', 1, 'tbl', 'myfile');
    await w.writeRow({ a: 1 });
    await w.close();
    expect((createMultiFileStreamWriter as any).names[0]).toMatch(/^myfile_/);
  });
});

describe('sanitizeRelativeFilename', () => {
  it('removes traversal, absolute paths and drive letters', () => {
    expect(sanitizeRelativeFilename('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeRelativeFilename('/abs/x.csv')).toBe('abs/x.csv');
    expect(sanitizeRelativeFilename('C:\\Windows\\x.csv')).toBe('C_/Windows/x.csv');
    expect(sanitizeRelativeFilename('..')).toBe('output');
    expect(sanitizeRelativeFilename('ok.csv')).toBe('ok.csv');
  });
});
