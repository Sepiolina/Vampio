import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  saveCustomColumnType,
  getCustomColumnTypes,
  getActiveCustomColumnTypes,
  toggleCustomTypeActive,
  setCustomTypeActive,
  deleteCustomColumnType,
  clearAllCustomTypes,
  CustomColumnType
} from '../utils/customTypesManager';

describe('Custom Types Turn ON/OFF (Activate/Deactivate)', () => {
  const store = new Map<string, string>();

  beforeAll(() => {
    const mockLocalStorage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => Array.from(store.keys())[i] || null
    };
    globalThis.localStorage = mockLocalStorage as unknown as Storage;
  });

  beforeEach(() => {
    store.clear();
  });

  it('should save custom type as active by default', () => {
    const type: CustomColumnType = {
      id: 'custom:test_id_1',
      name: 'Test Type 1',
      category: 'Custom',
      description: 'Test description',
      baseMode: 'Base',
      defaultRule: '[A-Z]{3}',
      createdAt: Date.now()
    };

    saveCustomColumnType(type);
    const all = getCustomColumnTypes();
    expect(all.length).toBe(1);
    expect(all[0].isActive).toBe(true);

    const active = getActiveCustomColumnTypes();
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('custom:test_id_1');
  });

  it('should toggle active state on/off', () => {
    const type: CustomColumnType = {
      id: 'custom:test_id_toggle',
      name: 'Toggle Type',
      category: 'Custom',
      description: 'Toggle description',
      baseMode: 'Script',
      defaultRule: 'return ctx.index;',
      createdAt: Date.now()
    };

    saveCustomColumnType(type);

    // Turn OFF
    const offResult = toggleCustomTypeActive('custom:test_id_toggle');
    expect(offResult).toBe(false);

    let all = getCustomColumnTypes();
    expect(all[0].isActive).toBe(false);

    let active = getActiveCustomColumnTypes();
    expect(active.length).toBe(0);

    // Turn ON
    const onResult = toggleCustomTypeActive('custom:test_id_toggle');
    expect(onResult).toBe(true);

    all = getCustomColumnTypes();
    expect(all[0].isActive).toBe(true);

    active = getActiveCustomColumnTypes();
    expect(active.length).toBe(1);
  });

  it('should set active state explicitly using setCustomTypeActive', () => {
    const type1: CustomColumnType = {
      id: 'custom:t1',
      name: 'Type 1',
      category: 'Finance',
      description: 'desc',
      baseMode: 'Lua',
      defaultRule: 'return "LUA"',
      createdAt: Date.now()
    };
    const type2: CustomColumnType = {
      id: 'custom:t2',
      name: 'Type 2',
      category: 'Identity',
      description: 'desc',
      baseMode: 'Template',
      defaultRule: 'SKU-{NUM:4}',
      createdAt: Date.now()
    };

    saveCustomColumnType(type1);
    saveCustomColumnType(type2);

    setCustomTypeActive('custom:t1', false);

    const all = getCustomColumnTypes();
    const t1 = all.find(t => t.id === 'custom:t1');
    const t2 = all.find(t => t.id === 'custom:t2');

    expect(t1?.isActive).toBe(false);
    expect(t2?.isActive).toBe(true);

    const active = getActiveCustomColumnTypes();
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('custom:t2');
  });

  it('should preserve isActive status when editing an existing custom type', () => {
    const type: CustomColumnType = {
      id: 'custom:edit_test',
      name: 'Original Name',
      category: 'Custom',
      description: 'desc',
      baseMode: 'Base',
      defaultRule: '[0-9]{5}',
      createdAt: Date.now()
    };

    saveCustomColumnType(type);
    setCustomTypeActive('custom:edit_test', false);

    // Update rule without explicitly setting isActive
    saveCustomColumnType({
      ...type,
      name: 'Updated Name',
      defaultRule: '[0-9]{6}'
    });

    const all = getCustomColumnTypes();
    const updated = all.find(t => t.id === 'custom:edit_test');
    expect(updated?.name).toBe('Updated Name');
    expect(updated?.defaultRule).toBe('[0-9]{6}');
    expect(updated?.isActive).toBe(false);
  });
});
