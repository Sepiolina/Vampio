import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnumRule, sampleEnumRule, serializeEnumRule } from '../utils/enumRules';
import { GeneratorEngine } from '../utils/generator';
import { parseBaseConfigFromRule } from '../utils/customTypesManager';

afterEach(() => vi.restoreAllMocks());

describe('lossless weighted enum rules', () => {
  it('keeps existing plain and weighted rules working without changing their labels', () => {
    expect(parseEnumRule('OK, Error, not OK')).toEqual([
      { value: 'OK', weight: 1 }, { value: 'Error', weight: 1 }, { value: 'not OK', weight: 1 },
    ]);
    expect(sampleEnumRule('OK:8, Error:1, not OK:1', () => 0.79)).toBe('OK');
    expect(sampleEnumRule('OK:8, Error:1, not OK:1', () => 0.85)).toBe('Error');
    expect(sampleEnumRule('OK:8, Error:1, not OK:1', () => 0.99)).toBe('not OK');
    expect(serializeEnumRule([{ value: 'OK', weight: 2 }, { value: 'not OK', weight: 1 }])).toBe('OK:2, not OK:1');
  });

  it('round-trips delimiter, colon, whitespace and newline labels through the real generator and Base editor parser', () => {
    const choices = [
      { value: 'OK, with note', weight: 2 }, { value: 'Error: code:42', weight: 3 },
      { value: ' not OK ', weight: 1 }, { value: 'line\nbreak', weight: 1 },
    ];
    const rule = serializeEnumRule(choices);
    expect(parseEnumRule(rule)).toEqual(choices);
    const base = parseBaseConfigFromRule(rule, 'Set/Enum');
    expect(base.type).toBe('Set/Enum');
    expect((base.config as any).items).toEqual(choices);
    for (const [index, random] of [0, 0.4, 0.8, 0.99].entries()) {
      vi.spyOn(Math, 'random').mockReturnValue(random);
      const row = new GeneratorEngine().generateBatch([{ id: 'result', name: 'result', type: 'Set/Enum', rule, skip_pct: 0, condition: '' }], 1)[0];
      expect(row.result).toBe(choices[index].value);
    }
  });

  it('handles zero and large weights predictably and rejects malformed structured rules', () => {
    expect(sampleEnumRule('ignored:0, OK:1', () => 0)).toBe('OK');
    expect(sampleEnumRule('ignored:0', () => 0)).toBe('');
    expect(sampleEnumRule(serializeEnumRule([{ value: 'A', weight: 1e308 }, { value: 'B', weight: 1e308 }]), () => 0.75)).toBe('B');
    expect(parseEnumRule('{"values":[{"value":"A","weight":-1}]}')).toEqual([]);
    expect(parseEnumRule('{"values":[')).toEqual([]);
    expect(sampleEnumRule('')).toBe('');
  });
});
