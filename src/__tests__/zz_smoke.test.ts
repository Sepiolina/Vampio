import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { GeneratorEngine } from '../utils/generator';
import { generateRegexString } from '../utils/regexSynthesizer';
import { formatDataset } from '../utils/export';
import { renderCustomJsonTemplate, validateJsonTemplate, JSON_TEMPLATE_PRESETS } from '../utils/customJsonTemplate';
import { matchesTriggerCondition, buildActionHeaders, formatActionPayload, defaultActionConfig } from '../utils/actionDispatcher';
import { ColumnSpec } from '../types';

const c = (name: string, type: string, rule = '', extra: any = {}): ColumnSpec =>
  ({ id: name, name, type, rule, skip_pct: 0, condition: '', ...extra } as any);

describe('smoke: generator types', () => {
  const eng = () => new GeneratorEngine();
  it('all standard types produce values', () => {
    const cols = [
      c('seq','Sequence','1'), c('i','Int','1,10'), c('f','Float','1,2,3'), c('s','String','8'),
      c('b','Boolean','50'), c('u','UUID'), c('d','DateTime','iso'), c('e','Set/Enum','a:70,b:30'),
      c('r','RegEx','[A-Z]{3}-\\d{4}'), c('h','Blob/Hex','4'), c('calc','Calculation','{i}*2'),
    ];
    const rows = eng().generateBatch(cols, 20);
    expect(rows).toHaveLength(20);
    for (const r of rows) {
      expect(r.u).toMatch(/^[0-9a-f-]{36}$/i);
      expect(r.r).toMatch(/^[A-Z]{3}-\d{4}$/);
      expect(r.calc).toBe((r.i as number) * 2);
      expect(['a','b']).toContain(r.e);
      expect(String(r.h)).toMatch(/^([0-9a-f]{2}-){3}[0-9a-f]{2}$/i);
      expect(String(r.s)).toHaveLength(8);
      expect(typeof r.b).toBe('boolean');
    }
  });
  it('entity subtypes', () => {
    for (const sub of ['first_name','last_name','full_name','email','phone','company','job_title','country','city','ip_address','user_agent','url']) {
      const rows = eng().generateBatch([c('x','Entity',sub)], 3);
      expect(String(rows[0].x).length, sub).toBeGreaterThan(0);
    }
  });
  it('skip_pct 100 yields empty/null', () => {
    const rows = eng().generateBatch([c('x','Int','1,5',{skip_pct:100})], 10);
    for (const r of rows) expect([null,'',undefined]).toContain(r.x as any);
  });
  it('negative calc', () => {
    const rows = eng().generateBatch([c('a','Int','-5,-5'), c('z','Calculation','3-{a}')], 1);
    expect(rows[0].z).toBe(8);
  });
});

describe('smoke: regex', () => {
  it('patterns', () => {
    expect(generateRegexString('cat|dog')).toMatch(/^(cat|dog)$/);
    expect(generateRegexString('(a(b|c)|d){3}')).toMatch(/^(ab|ac|d){3}$/);
    expect(generateRegexString('\\d{5}')).toMatch(/^\d{5}$/);
    expect(generateRegexString('[a-f0-9]{16}')).toMatch(/^[a-f0-9]{16}$/);
    expect(generateRegexString('a{0}b')).toBe('b');
    expect(generateRegexString('ab+?c')).toMatch(/^ab+c$/);
  });
});

describe('smoke: export formats', () => {
  const specs = [c('id','Int'), c('name','String'), c('note','String')];
  const rows = [{id:1,name:'Al "Q" Smith',note:'line1\nline2, x'},{id:2,name:"O'Brien",note:'$& $1'}];
  for (const fmt of ['csv','tsv','json','jsonl','sql','xml','txt'] as const) {
    it(fmt, () => {
      const out = formatDataset(specs, rows, fmt, 'my table') as string;
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(10);
      if (fmt==='json') expect(JSON.parse(out)).toHaveLength(2);
      if (fmt==='jsonl') out.trim().split('\n').forEach(l=>JSON.parse(l));
      if (fmt==='csv') expect(out).toContain('"Al ""Q"" Smith"');
      if (fmt==='xml') expect(out).toContain('$&');
      if (fmt==='sql') expect(out).toContain("O''Brien");
    });
  }
  for (const fmt of ['xlsx','xls'] as const) {
    it(fmt, () => {
      const out = formatDataset(specs, rows, fmt) as Uint8Array;
      const wb = XLSX.read(out, {type:'array'});
      expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])).toHaveLength(2);
    });
  }
});

describe('smoke: custom json templates', () => {
  it('all presets validate and render valid JSON', () => {
    const rows = [{id:1,name:'a "b"'},{id:2,name:'c\nd'}];
    for (const p of JSON_TEMPLATE_PRESETS) {
      const cfg: any = { template: (p as any).template, ...(p as any).config };
      const v: any = validateJsonTemplate(cfg.template, ...([] as any));
      const out = renderCustomJsonTemplate(cfg, rows, { tableName: 't', count: 2 } as any);
      expect(() => JSON.parse(out), p.id ?? (p as any).name).not.toThrow();
    }
  });
});

describe('smoke: action dispatcher', () => {
  it('trigger conditions + headers + payload', () => {
    expect(matchesTriggerCondition).toBeTypeOf('function');
    expect(buildActionHeaders({ ...defaultActionConfig, headers: [] } as any)).toBeTypeOf('object');
    expect(formatActionPayload).toBeTypeOf('function');
  });
});
