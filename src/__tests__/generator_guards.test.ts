import { describe, it, expect } from 'vitest';
import { GeneratorEngine } from '../utils/generator';
import { ColumnSpec } from '../types';

describe('Generator Engine Boundary Guards & Edge Case Handling', () => {
  const engine = new GeneratorEngine();

  it('handles inverted min and max in Int rules safely', () => {
    // User passes min=100, max=10 instead of min=10, max=100
    const col: ColumnSpec = {
      id: 'c1',
      name: 'inverted_int',
      type: 'Int',
      rule: '100, 10',
      skip_pct: 0,
      condition: '',
    };

    for (let i = 0; i < 50; i++) {
      const val = engine.generateRow([col], i).inverted_int as number;
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('handles inverted min and max in Float rules safely', () => {
    // User passes min=50.5, max=5.0
    const col: ColumnSpec = {
      id: 'c2',
      name: 'inverted_float',
      type: 'Float',
      rule: '50.5, 5.0, 2',
      skip_pct: 0,
      condition: '',
    };

    for (let i = 0; i < 50; i++) {
      const val = engine.generateRow([col], i).inverted_float as number;
      expect(val).toBeGreaterThanOrEqual(5.0);
      expect(val).toBeLessThanOrEqual(50.5);
    }
  });

  it('handles sequence with custom step and zero step boundary safely', () => {
    const engineStep = new GeneratorEngine();
    const colStep: ColumnSpec = {
      id: 'seq1',
      name: 'seq',
      type: 'Sequence',
      rule: '100, 5', // start 100, step 5
      skip_pct: 0,
      condition: '',
    };

    const row0 = engineStep.generateRow([colStep], 0).seq;
    const row1 = engineStep.generateRow([colStep], 1).seq;
    const row2 = engineStep.generateRow([colStep], 2).seq;

    expect(row0).toBe(100);
    expect(row1).toBe(105);
    expect(row2).toBe(110);

    // If step is 0, defaults safely to step 1 rather than infinite loop
    const engineZero = new GeneratorEngine();
    const colZero: ColumnSpec = {
      id: 'seq2',
      name: 'seq_zero',
      type: 'Sequence',
      rule: '10, 0',
      skip_pct: 0,
      condition: '',
    };

    const z0 = engineZero.generateRow([colZero], 0).seq_zero;
    const z1 = engineZero.generateRow([colZero], 1).seq_zero;
    expect(z0).toBe(10);
    expect(z1).toBe(11);
  });

  it('handles calculation division by zero and null tokens gracefully', () => {
    const colA: ColumnSpec = {
      id: 'cA',
      name: 'A',
      type: 'Int',
      rule: '10, 10',
      skip_pct: 0,
      condition: '',
    };
    const colB: ColumnSpec = {
      id: 'cB',
      name: 'B',
      type: 'Int',
      rule: '0, 0',
      skip_pct: 0,
      condition: '',
    };
    const colCalc: ColumnSpec = {
      id: 'cCalc',
      name: 'Calc',
      type: 'Calculation',
      rule: '{A} / {B}', // 10 / 0 => infinity => guarded to 0
      skip_pct: 0,
      condition: '',
    };

    const row = engine.generateRow([colA, colB, colCalc], 0);
    expect(row.Calc).toBe(0);
  });

  it('clamps Boolean ratio between 0% and 100% boundary values', () => {
    const colOver: ColumnSpec = {
      id: 'b1',
      name: 'always_true',
      type: 'Boolean',
      rule: '999', // > 100%
      skip_pct: 0,
      condition: '',
    };
    const colUnder: ColumnSpec = {
      id: 'b2',
      name: 'always_false',
      type: 'Boolean',
      rule: '-50', // < 0%
      skip_pct: 0,
      condition: '',
    };

    for (let i = 0; i < 20; i++) {
      expect(engine.generateRow([colOver], i).always_true).toBe(true);
      expect(engine.generateRow([colUnder], i).always_false).toBe(false);
    }
  });
});
