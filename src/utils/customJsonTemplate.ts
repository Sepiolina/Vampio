import { CustomJsonConfig } from '../types';

export interface JsonTemplatePreset {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'webhook' | 'graphql' | 'geo';
  template: string;
  rowTemplate?: string;
}

export const DEFAULT_CUSTOM_JSON_TEMPLATE = `{
  "status": "success",
  "timestamp": "{{timestamp}}",
  "tableName": "{{tableName}}",
  "count": "{{count}}",
  "data": {
    "items": "{{records}}"
  }
}`;

export const DEFAULT_CUSTOM_JSON_CONFIG: CustomJsonConfig = {
  enabled: false,
  template: DEFAULT_CUSTOM_JSON_TEMPLATE,
  prettyPrint: true,
};

export const JSON_TEMPLATE_PRESETS: JsonTemplatePreset[] = [
  {
    id: 'api_envelope',
    name: 'REST API Envelope',
    description: 'Standard enterprise API wrapper with status, metadata and data object',
    category: 'api',
    template: `{
  "status": "success",
  "timestamp": "{{timestamp}}",
  "meta": {
    "table": "{{tableName}}",
    "totalCount": "{{count}}"
  },
  "data": "{{records}}"
}`,
  },
  {
    id: 'paginated_list',
    name: 'Paginated Items Wrapper',
    description: 'Standard pagination envelope with pagination info and items list',
    category: 'api',
    template: `{
  "pagination": {
    "page": 1,
    "pageSize": "{{count}}",
    "totalRecords": "{{count}}"
  },
  "items": "{{records}}"
}`,
  },
  {
    id: 'graphql_response',
    name: 'GraphQL Query Result',
    description: 'Nested GraphQL-compliant response structure with dataset nodes',
    category: 'graphql',
    template: `{
  "data": {
    "dataset": {
      "tableName": "{{tableName}}",
      "totalCount": "{{count}}",
      "nodes": "{{records}}"
    }
  }
}`,
  },
  {
    id: 'webhook_event',
    name: 'Webhook Event Dispatch',
    description: 'Event-driven payload with event name, timestamp and payload wrapper',
    category: 'webhook',
    template: `{
  "event": "dataset.generated",
  "event_id": "evt_{{epochMs}}",
  "occurred_at": "{{timestamp}}",
  "source": "vampio-engine",
  "payload": {
    "table": "{{tableName}}",
    "recordCount": "{{count}}",
    "records": "{{records}}"
  }
}`,
  },
  {
    id: 'geojson_features',
    name: 'GeoJSON FeatureCollection',
    description: 'Standard spatial FeatureCollection wrapping coordinate features',
    category: 'geo',
    template: `{
  "type": "FeatureCollection",
  "generatedAt": "{{timestamp}}",
  "features": "{{records}}"
}`,
  },
  {
    id: 'custom_row_mapping',
    name: 'Custom Row Schema Mapping',
    description: 'Transforms every record into a custom nested schema',
    category: 'api',
    template: `{
  "dataset": "{{tableName}}",
  "count": "{{count}}",
  "results": "{{records}}"
}`,
    rowTemplate: `{
  "record_id": "{{id}}",
  "attributes": {
    "name": "{{name}}",
    "email": "{{email}}"
  }
}`,
  },
];

export interface TemplateMetadata {
  tableName?: string;
  count?: number;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Validates a JSON template string.
 * Performs mock substitution on common placeholder variables and checks JSON syntax.
 */
export function validateJsonTemplate(
  templateStr: string,
  sampleColumns: string[] = ['id', 'name', 'email']
): { valid: boolean; error?: string } {
  if (!templateStr || !templateStr.trim()) {
    return { valid: false, error: 'Template cannot be empty' };
  }

  try {
    const mockRow: Record<string, unknown> = {};
    for (const col of sampleColumns) {
      mockRow[col] = `sample_${col}`;
    }
    const mockRows = [mockRow];

    const rendered = renderCustomJsonTemplate(
      { enabled: true, template: templateStr },
      mockRows,
      { tableName: 'test_table', count: 1 }
    );

    JSON.parse(rendered);
    return { valid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}

/**
 * Interpolates single row with {{column_name}} placeholders
 */
function interpolateRowTemplate(
  rowTemplate: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  let renderedStr = rowTemplate;

  // Substitute each column
  for (const [key, value] of Object.entries(row)) {
    const escapedValue = JSON.stringify(value ?? null);
    // Replace "{{col}}"
    renderedStr = renderedStr.replaceAll(`"{{${key}}}"`, escapedValue);
    // Replace {{col}}
    renderedStr = renderedStr.replaceAll(`{{${key}}}`, escapedValue);
  }

  // Clean up any remaining unpopulated {{var}} placeholders
  renderedStr = renderedStr.replace(/\{\{[^}]+\}\}/g, 'null');

  try {
    return JSON.parse(renderedStr);
  } catch {
    return row;
  }
}

/**
 * Interpolates and renders the final JSON payload
 */
export function renderCustomJsonTemplate(
  config: Partial<CustomJsonConfig>,
  rows: Record<string, unknown>[],
  metadata: TemplateMetadata = {}
): string {
  const rawTemplate = config?.template || DEFAULT_CUSTOM_JSON_TEMPLATE;
  const count = metadata.count ?? rows.length;
  const tableName = metadata.tableName || 'dataset';
  const timestamp = metadata.timestamp || new Date().toISOString();
  const epochMs = Date.now();

  // If a rowTemplate is specified, transform each row
  let effectiveRows: Record<string, unknown>[] = rows;
  if (config.rowTemplate && config.rowTemplate.trim()) {
    effectiveRows = rows.map((r) => interpolateRowTemplate(config.rowTemplate!, r));
  }

  const recordsJson = JSON.stringify(effectiveRows, null, config.prettyPrint !== false ? 2 : undefined);
  const singleRecordJson = JSON.stringify(effectiveRows[0] || {}, null, config.prettyPrint !== false ? 2 : undefined);

  let result = rawTemplate;

  // 1. Substitute structural variables (replace quoted and unquoted instances)
  // "{{records}}" -> JSON array string (without outer extra quotes)
  result = result.replaceAll('"{{records}}"', recordsJson);
  result = result.replaceAll('{{records}}', recordsJson);

  // "{{record}}" (single entry)
  result = result.replaceAll('"{{record}}"', singleRecordJson);
  result = result.replaceAll('{{record}}', singleRecordJson);

  // 2. Substitute numeric primitives
  // "{{count}}" -> numeric count or quoted count
  // If written as "{{count}}", preserve as number if possible or string
  result = result.replaceAll('"{{count}}"', String(count));
  result = result.replaceAll('{{count}}', String(count));

  result = result.replaceAll('"{{epochMs}}"', String(epochMs));
  result = result.replaceAll('{{epochMs}}', String(epochMs));

  // 3. Substitute strings
  result = result.replaceAll('{{tableName}}', tableName);
  result = result.replaceAll('{{timestamp}}', timestamp);

  // If single row and column placeholders exist at root level
  if (effectiveRows.length > 0) {
    const firstRow = effectiveRows[0];
    for (const [col, val] of Object.entries(firstRow)) {
      const valStr = JSON.stringify(val ?? null);
      result = result.replaceAll(`"{{${col}}}"`, valStr);
      result = result.replaceAll(`{{${col}}}`, String(val ?? ''));
    }
  }

  // Format with consistent indentation if valid JSON
  try {
    const parsed = JSON.parse(result);
    return JSON.stringify(parsed, null, config.prettyPrint !== false ? 2 : undefined);
  } catch {
    // If not strictly parsable (user typing halfway), return interpolated string
    return result;
  }
}
