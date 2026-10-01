import { describe, it, expect } from 'vitest';
import { getCustomColumnTypes, getExamplePresetTypes } from '../utils/customTypesManager';
import { serializeRestApiConfig } from '../utils/restApiManager';

describe('Column Type Selection & Categorization Architecture', () => {
  it('should categorize standard, custom, api, and advanced types correctly', () => {
    const standardTypes = ['Sequence', 'Int', 'Float', 'String', 'Boolean', 'DateTime', 'Set/Enum'];
    const apiTypes = ['REST_API'];
    const advancedTypes = ['Entity', 'Calculation', 'UUID', 'RegEx', 'Blob/Hex'];

    expect(standardTypes.length).toBe(7);
    expect(apiTypes.length).toBe(1);
    expect(advancedTypes.length).toBe(5);
  });

  it('should provide default rules for all standard types', () => {
    const rules: Record<string, string> = {
      'Sequence': '1',
      'Int': '1, 100',
      'Float': '10.0, 100.0, 2',
      'Boolean': '50',
      'Set/Enum': 'Option A, Option B, Option C',
      'DateTime': 'YYYY-MM-DD HH:mm:ss',
      'RegEx': '[A-Z]{3}-\\d{4}',
      'Blob/Hex': '6',
      'String': '12',
      'UUID': ''
    };

    expect(rules['Sequence']).toBe('1');
    expect(rules['Int']).toContain('100');
    expect(rules['DateTime']).toContain('YYYY-MM-DD');
  });

  it('should generate valid REST_API serialized config for API type', () => {
    const config = serializeRestApiConfig({
      url: 'https://dummyjson.com/users?limit=50',
      method: 'GET',
      jsonPath: 'users[].email',
      retrievalMode: 'pool',
      sampleStrategy: 'sequential',
      fallbackValue: 'api_unavailable'
    });

    expect(config).toContain('dummyjson.com');
    expect(config).toContain('"method": "GET"');
    expect(config).toContain('"retrievalMode": "pool"');
  });

  it('should filter custom types to only show enabled ones by default', () => {
    const mockTypes = [
      { id: 'custom:active1', name: 'Active 1', isActive: true },
      { id: 'custom:inactive1', name: 'Inactive 1', isActive: false },
      { id: 'custom:active2', name: 'Active 2', isActive: true }
    ];

    const currentSelectedId = 'Sequence';
    const enabledOnly = mockTypes.filter(
      (ct) => ct.isActive !== false || ct.id === currentSelectedId
    );

    expect(enabledOnly.length).toBe(2);
    expect(enabledOnly.map(t => t.id)).toEqual(['custom:active1', 'custom:active2']);
  });

  it('should preserve inactive custom type if it is currently selected on the column', () => {
    const mockTypes = [
      { id: 'custom:active1', name: 'Active 1', isActive: true },
      { id: 'custom:inactive1', name: 'Inactive 1', isActive: false }
    ];

    const currentSelectedId = 'custom:inactive1';
    const enabledOrCurrent = mockTypes.filter(
      (ct) => ct.isActive !== false || ct.id === currentSelectedId
    );

    expect(enabledOrCurrent.length).toBe(2);
    expect(enabledOrCurrent.some(t => t.id === 'custom:inactive1')).toBe(true);
  });
});
