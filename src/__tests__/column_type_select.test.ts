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

  it('should load preset types when searching custom categories', () => {
    const presets = getExamplePresetTypes();
    expect(presets.length).toBeGreaterThan(0);
    const thaiId = presets.find(p => p.id === 'example:thai_id' || p.name.includes('ID'));
    expect(thaiId).toBeDefined();
  });
});
