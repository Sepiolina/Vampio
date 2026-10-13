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
 * True when `offset` in `text` falls inside a JSON string literal
 * (an odd number of unescaped double quotes precede it).
 */
function isInsideJsonString(text: string, offset: number): boolean {
  let inString = false;
  for (let i = 0; i < offset; i++) {
    const ch = text[i];
    if (ch === '\\' && inString) {
      i++;
      continue;
    }
    if (ch === '"') inString = !inString;
  }
  return inString;
}

/** Escapes a value so it can be embedded inside an existing JSON string literal. */
function toJsonStringContent(value: unknown): string {
  const text = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  return JSON.stringify(text).slice(1, -1);
}

/**
 * Single-pass placeholder substitution.
 *
 * - "{{name}}" (placeholder is the whole JSON value) -> raw JSON literal for that value
 * - {{name}} inside a larger string -> escaped text, so quotes/newlines in data can't break the JSON
 * - {{name}} outside a string -> raw JSON literal
 *
 * Because everything is replaced in ONE pass, text that happens to look like a placeholder
 * inside substituted data (e.g. a name column containing "{{count}}") is never re-expanded.
 * `lookup` returns `undefined` for unknown names, which leaves the placeholder untouched.
 */
function substitutePlaceholders(
  template: string,
  lookup: (name: string) => { json: string; text: string } | undefined,
  onUnknown?: (inString: boolean) => string | undefined
): string {
  return template.replace(
    /"\{\{([^{}]+)\}\}"|\{\{([^{}]+)\}\}/g,
    (match: string, quotedName: string | undefined, bareName: string | undefined, offset: number) => {
      const name = (quotedName ?? bareName) as string;
      const found = lookup(name);
      if (!found) {
        if (onUnknown) {
          const replacement = onUnknown(quotedName === undefined && isInsideJsonString(template, offset));
          if (replacement !== undefined) return replacement;
        }
        return match;
      }
      if (quotedName !== undefined) return found.json;
      return isInsideJsonString(template, offset) ? found.text : found.json;
    }
  );
}

function valueEntry(value: unknown): { json: string; text: string } {
  return {
    json: JSON.stringify(value === undefined ? null : value),
    text: toJsonStringContent(value),
  };
}

/**
 * Interpolates single row with {{column_name}} placeholders
 */
function interpolateRowTemplate(
  rowTemplate: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const renderedStr = substitutePlaceholders(
    rowTemplate,
    (name) => (Object.prototype.hasOwnProperty.call(row, name) ? valueEntry(row[name]) : undefined),
    // Unpopulated placeholders become null (or an empty string inside a string literal)
    (inString) => (inString ? '' : 'null')
  );

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
  const indent = config.prettyPrint !== false ? 2 : undefined;

  // If a rowTemplate is specified, transform each row
  let effectiveRows: Record<string, unknown>[] = rows;
  if (config.rowTemplate && config.rowTemplate.trim()) {
    effectiveRows = rows.map((r) => interpolateRowTemplate(config.rowTemplate!, r));
  }

  const recordsJson = JSON.stringify(effectiveRows, null, indent);
  const singleRecordJson = JSON.stringify(effectiveRows[0] || {}, null, indent);
  const firstRow = effectiveRows[0] || {};

  const result = substitutePlaceholders(rawTemplate, (name) => {
    switch (name) {
      case 'records':
        return { json: recordsJson, text: toJsonStringContent(recordsJson) };
      case 'record':
        return { json: singleRecordJson, text: toJsonStringContent(singleRecordJson) };
      case 'count':
        return { json: String(count), text: String(count) };
      case 'epochMs':
        return { json: String(epochMs), text: String(epochMs) };
      case 'tableName':
        return valueEntry(tableName);
      case 'timestamp':
        return valueEntry(timestamp);
      default:
        return Object.prototype.hasOwnProperty.call(firstRow, name) ? valueEntry(firstRow[name]) : undefined;
    }
  });

  // Format with consistent indentation if valid JSON
  try {
    return JSON.stringify(JSON.parse(result), null, indent);
  } catch {
    // If not strictly parsable (user typing halfway), return interpolated string
    return result;
  }
}
