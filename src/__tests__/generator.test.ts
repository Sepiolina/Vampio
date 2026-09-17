import { describe, it, expect } from 'vitest';
import { GeneratorEngine } from '../utils/generator';
import { ColumnSpec } from '../types';

describe('GeneratorEngine', () => {
  it('should generate sequence numbers correctly', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'id', type: 'Sequence', rule: '100', skip_pct: 0, condition: '' }
    ];
    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 5);

    expect(rows).toHaveLength(5);
    expect(rows[0].id).toBe(100);
    expect(rows[1].id).toBe(101);
    expect(rows[2].id).toBe(102);
    expect(rows[3].id).toBe(103);
    expect(rows[4].id).toBe(104);
  });

  it('should generate integer ranges correctly', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'age', type: 'Int', rule: '18, 65', skip_pct: 0, condition: '' }
    ];
    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 50);

    for (const row of rows) {
      expect(typeof row.age).toBe('number');
      expect(row.age).toBeGreaterThanOrEqual(18);
      expect(row.age).toBeLessThanOrEqual(65);
    }
  });

  it('should generate float values with precision', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'price', type: 'Float', rule: '10.5, 99.9, 2', skip_pct: 0, condition: '' }
    ];
    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 25);

    for (const row of rows) {
      expect(typeof row.price).toBe('number');
      expect(row.price).toBeGreaterThanOrEqual(10.5);
      expect(row.price).toBeLessThanOrEqual(99.9);
      const decimalStr = String(row.price).split('.')[1] || '';
      expect(decimalStr.length).toBeLessThanOrEqual(2);
    }
  });

  it('should pick from set/enum options', () => {
    const allowed = ['Active', 'Pending', 'Suspended'];
    const columns: ColumnSpec[] = [
      { id: '1', name: 'status', type: 'Set/Enum', rule: allowed.join(', '), skip_pct: 0, condition: '' }
    ];
    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 30);

    for (const row of rows) {
      expect(allowed).toContain(row.status);
    }
  });

  it('should generate valid UUID v4 values', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'guid', type: 'UUID', rule: '', skip_pct: 0, condition: '' }
    ];
    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 10);
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const row of rows) {
      expect(String(row.guid)).toMatch(uuidV4Regex);
    }
  });

  it('should handle parent-child conditional dependencies (skip if parent equals)', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'account_type', type: 'Set/Enum', rule: 'Personal, Business', skip_pct: 0, condition: '' },
      { 
        id: '2', 
        name: 'tax_id', 
        type: 'RegEx', 
        rule: '\\d{2}-\\d{7}', 
        skip_pct: 0, 
        condition: 'account_type',
        dependencyCases: [
          {
            id: 'c1',
            parentColumn: 'account_type',
            operator: 'equals',
            value: 'Personal',
            action: 'skip'
          },
          {
            id: 'c2',
            parentColumn: 'account_type',
            operator: 'equals',
            value: 'Business',
            action: 'set_value',
            actionValue: 'CORP-TAX-999'
          }
        ]
      }
    ];

    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 40);

    for (const row of rows) {
      if (row.account_type === 'Personal') {
        expect(row.tax_id).toBeNull();
      } else if (row.account_type === 'Business') {
        expect(row.tax_id).toBe('CORP-TAX-999');
      }
    }
  });

  it('should support parent is_null condition', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'parent_val', type: 'Set/Enum', rule: 'Present', skip_pct: 100, condition: '' },
      { 
        id: '2', 
        name: 'child_val', 
        type: 'String', 
        rule: '10', 
        skip_pct: 0, 
        condition: 'parent_val',
        dependencyCases: [
          {
            id: 'c1',
            parentColumn: 'parent_val',
            operator: 'is_null',
            value: '',
            action: 'set_value',
            actionValue: 'PARENT_WAS_NULL'
          }
        ]
      }
    ];

    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 10);

    for (const row of rows) {
      expect(row.parent_val).toBeNull();
      expect(row.child_val).toBe('PARENT_WAS_NULL');
    }
  });

  it('should calculate formula values based on other columns', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'qty', type: 'Int', rule: '5, 5', skip_pct: 0, condition: '' },
      { id: '2', name: 'unit_price', type: 'Float', rule: '10.0, 10.0, 2', skip_pct: 0, condition: '' },
      { id: '3', name: 'total', type: 'Calculation', rule: '{qty} * {unit_price}', skip_pct: 0, condition: '' }
    ];

    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 5);

    for (const row of rows) {
      expect(row.qty).toBe(5);
      expect(row.unit_price).toBe(10);
      expect(row.total).toBe(50);
    }
  });

  it('should respect 100% skip percentage producing nulls', () => {
    const columns: ColumnSpec[] = [
      { id: '1', name: 'optional_field', type: 'String', rule: '8', skip_pct: 100, condition: '' }
    ];
    const engine = new GeneratorEngine();
    const rows = engine.generateBatch(columns, 20);

    for (const row of rows) {
      expect(row.optional_field).toBeNull();
    }
  });
});
