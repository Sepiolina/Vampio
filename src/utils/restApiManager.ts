/**
 * REST API Retrieval & Enrichment Engine for Columns and Rows.
 * Supports:
 * - Column-level REST API data retrieval (Bulk Pool or Per-Row Dynamic Query)
 * - Row-level Multi-Column REST API retrieval & Schema Auto-Detection
 * - In-memory caching & request deduplication
 * - Deep JSONPath extraction (dot notation, array indexing, wildcard mapping)
 * - Dynamic parameter interpolation ({rowIndex}, {row.colName})
 */

export type RestApiMethod = 'GET' | 'POST';

export type RestApiRetrievalMode = 'pool' | 'per_row';

export interface RestApiHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RestApiColumnConfig {
  url: string;
  method?: RestApiMethod;
  headers?: RestApiHeader[];
  body?: string;
  jsonPath?: string; // e.g. "users[].email", "products[].title", "data.items[].id"
  retrievalMode?: RestApiRetrievalMode;
  sampleStrategy?: 'sequential' | 'random';
  fallbackValue?: string;
  timeoutMs?: number;
}

export interface RestApiRowConfig {
  id: string;
  name: string;
  url: string;
  method: RestApiMethod;
  headers: RestApiHeader[];
  body?: string;
  rootPath?: string; // Path to array in JSON (e.g. "users", "products", or empty for root array)
  fieldMappings: {
    columnName: string;
    fieldPath: string; // e.g. "id", "email", "address.city"
    columnType?: string;
  }[];
  enabled: boolean;
  createdAt: number;
}

export interface RestApiPreset {
  id: string;
  name: string;
  description: string;
  url: string;
  method: RestApiMethod;
  jsonPath: string;
  rootPath: string;
  sampleStrategy: 'sequential' | 'random';
  suggestedColumns: { name: string; path: string; type: string }[];
}

export const CURATED_REST_API_PRESETS: RestApiPreset[] = [
  {
    id: 'dummyjson_users',
    name: 'DummyJSON Real Users',
    description: 'Realistic user profiles with names, emails, phones, and addresses',
    url: 'https://dummyjson.com/users?limit=100',
    method: 'GET',
    jsonPath: 'users[].email',
    rootPath: 'users',
    sampleStrategy: 'sequential',
    suggestedColumns: [
      { name: 'user_id', path: 'id', type: 'Int' },
      { name: 'first_name', path: 'firstName', type: 'String' },
      { name: 'last_name', path: 'lastName', type: 'String' },
      { name: 'email', path: 'email', type: 'String' },
      { name: 'phone', path: 'phone', type: 'String' },
      { name: 'username', path: 'username', type: 'String' },
      { name: 'city', path: 'address.city', type: 'String' }
    ]
  },
  {
    id: 'dummyjson_products',
    name: 'DummyJSON Product Catalog',
    description: 'E-commerce products with titles, categories, prices, and stock',
    url: 'https://dummyjson.com/products?limit=100',
    method: 'GET',
    jsonPath: 'products[].title',
    rootPath: 'products',
    sampleStrategy: 'sequential',
    suggestedColumns: [
      { name: 'product_id', path: 'id', type: 'Int' },
      { name: 'title', path: 'title', type: 'String' },
      { name: 'category', path: 'category', type: 'String' },
      { name: 'price', path: 'price', type: 'Float' },
      { name: 'stock', path: 'stock', type: 'Int' },
      { name: 'brand', path: 'brand', type: 'String' }
    ]
  },
  {
    id: 'jsonplaceholder_posts',
    name: 'JSONPlaceholder Articles & Posts',
    description: 'Blog posts and article titles with IDs and body text',
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'GET',
    jsonPath: '[].title',
    rootPath: '',
    sampleStrategy: 'sequential',
    suggestedColumns: [
      { name: 'post_id', path: 'id', type: 'Int' },
      { name: 'title', path: 'title', type: 'String' },
      { name: 'body', path: 'body', type: 'String' },
      { name: 'user_id', path: 'userId', type: 'Int' }
    ]
  },
  {
    id: 'jsonplaceholder_users',
    name: 'JSONPlaceholder Corporate Accounts',
    description: 'Enterprise contacts, companies, usernames, and websites',
    url: 'https://jsonplaceholder.typicode.com/users',
    method: 'GET',
    jsonPath: '[].company.name',
    rootPath: '',
    sampleStrategy: 'sequential',
    suggestedColumns: [
      { name: 'account_id', path: 'id', type: 'Int' },
      { name: 'contact_name', path: 'name', type: 'String' },
      { name: 'username', path: 'username', type: 'String' },
      { name: 'company_name', path: 'company.name', type: 'String' },
      { name: 'city', path: 'address.city', type: 'String' },
      { name: 'website', path: 'website', type: 'String' }
    ]
  },
  {
    id: 'randomuser_api',
    name: 'RandomUser Multi-National Data',
    description: 'Full international demographic records',
    url: 'https://randomuser.me/api/?results=100',
    method: 'GET',
    jsonPath: 'results[].name.first',
    rootPath: 'results',
    sampleStrategy: 'sequential',
    suggestedColumns: [
      { name: 'gender', path: 'gender', type: 'String' },
      { name: 'first_name', path: 'name.first', type: 'String' },
      { name: 'last_name', path: 'name.last', type: 'String' },
      { name: 'country', path: 'location.country', type: 'String' },
      { name: 'city', path: 'location.city', type: 'String' },
      { name: 'email', path: 'email', type: 'String' }
    ]
  }
];

// In-memory cache for API responses: Map<cacheKey, { data: unknown; timestamp: number }>
const apiResponseCache = new Map<string, { data: unknown; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Parses a REST API rule string into a RestApiColumnConfig object.
 */
export function parseRestApiConfig(rule: string): RestApiColumnConfig {
  const trimmed = (rule || '').trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'REST_API' && parsed.config) {
        return parsed.config;
      }
      if (parsed.url) {
        return parsed;
      }
    } catch {}
  }

  // If plain URL string (e.g. "https://dummyjson.com/users")
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      url: trimmed,
      method: 'GET',
      jsonPath: '',
      retrievalMode: 'pool',
      sampleStrategy: 'sequential'
    };
  }

  // Fallback default
  return {
    url: 'https://dummyjson.com/users?limit=50',
    method: 'GET',
    jsonPath: 'users[].email',
    retrievalMode: 'pool',
    sampleStrategy: 'sequential',
    fallbackValue: 'api_unavailable'
  };
}

/**
 * Serializes a RestApiColumnConfig into JSON format stored in column.rule.
 */
export function serializeRestApiConfig(config: RestApiColumnConfig): string {
  return JSON.stringify(
    {
      type: 'REST_API',
      config
    },
    null,
    2
  );
}

/**
 * Interpolates variables such as {rowIndex}, {row.colName}, {date}, etc.
 */
export function interpolateTemplate(
  template: string,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): string {
  if (!template) return '';
  return template.replace(/\{([^}]+)\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    if (key === 'rowIndex') {
      return String((context?.rowIndex ?? 0) + 1);
    }
    if (key === 'zeroIndex') {
      return String(context?.rowIndex ?? 0);
    }
    if (key === 'date') {
      return new Date().toISOString().split('T')[0];
    }
    if (key === 'timestamp') {
      return String(Date.now());
    }
    if (key.startsWith('row.') || key.startsWith('ROW:')) {
      const col = key.includes('.') ? key.split('.')[1] : key.substring(4);
      if (context?.row && col && col in context.row) {
        const v = context.row[col];
        return v !== null && v !== undefined ? String(v) : '';
      }
    }
    // Direct column lookup fallback
    if (context?.row && key in context.row) {
      const v = context.row[key];
      return v !== null && v !== undefined ? String(v) : '';
    }
    return match;
  });
}

/**
 * Resolves a nested property or array path from a response JSON payload.
 * Examples:
 * - "users[].email"
 * - "products[].title"
 * - "data.items[].id"
 * - "address.city"
 * - "[].name"
 */
export function extractValueByPath(
  data: unknown,
  path: string,
  index: number = 0,
  strategy: 'sequential' | 'random' = 'sequential'
): unknown {
  if (data === null || data === undefined) return null;
  const cleanPath = (path || '').trim();

  // If empty path, return root or indexed element if root is array
  if (!cleanPath || cleanPath === '@' || cleanPath === '$') {
    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      const targetIdx = strategy === 'random' ? Math.floor(Math.random() * data.length) : index % data.length;
      return data[targetIdx];
    }
    return typeof data === 'object' ? JSON.stringify(data) : data;
  }

  // Handle array wildcard [].field or field[].subfield
  if (cleanPath.includes('[]')) {
    const [arrayPrefix, subPath] = cleanPath.split('[]');
    let targetArray: unknown = data;

    if (arrayPrefix && arrayPrefix !== '') {
      targetArray = resolvePropertyPath(data, arrayPrefix.replace(/\.$/, ''));
    }

    if (Array.isArray(targetArray)) {
      if (targetArray.length === 0) return null;
      const targetIdx =
        strategy === 'random' ? Math.floor(Math.random() * targetArray.length) : index % targetArray.length;
      const item = targetArray[targetIdx];

      if (!subPath || subPath === '' || subPath === '.') {
        return item;
      }
      return resolvePropertyPath(item, subPath.replace(/^\./, ''));
    }
  }

  // If root data itself is an array without explicit [] in path
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const targetIdx = strategy === 'random' ? Math.floor(Math.random() * data.length) : index % data.length;
    const item = data[targetIdx];
    return resolvePropertyPath(item, cleanPath);
  }

  // Normal dot navigation on object
  return resolvePropertyPath(data, cleanPath);
}

/**
 * Helper to navigate standard nested dot properties: "user.profile.name" or "items.0.id"
 */
function resolvePropertyPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return null;
  if (!path) return obj;

  const segments = path
    .replace(/\[(\w+)\]/g, '.$1') // convert [0] to .0
    .split('.')
    .filter(Boolean);

  let current: any = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return null;
    current = current[seg];
  }
  return current;
}

/**
 * Computes a unique cache key for an API request.
 */
function computeCacheKey(url: string, method: string, headers?: RestApiHeader[], body?: string): string {
  const activeHeaders = (headers || [])
    .filter((h) => h.enabled && h.key)
    .map((h) => `${h.key}:${h.value}`)
    .sort()
    .join('|');
  return `${method.toUpperCase()}:${url}:${activeHeaders}:${body || ''}`;
}

/**
 * Executes a live fetch to an external REST API endpoint with caching and timeout.
 */
export async function executeRestApiFetch(
  config: RestApiColumnConfig,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): Promise<{
  success: boolean;
  value: unknown;
  rawResponse?: unknown;
  status?: number;
  durationMs?: number;
  error?: string;
}> {
  const startTime = performance.now();
  const rawUrl = config.url || '';
  const finalUrl = interpolateTemplate(rawUrl, context);
  const method = (config.method || 'GET').toUpperCase();
  const finalBody = config.body ? interpolateTemplate(config.body, context) : undefined;

  const cacheKey = computeCacheKey(finalUrl, method, config.headers, finalBody);

  // Check in-memory cache
  const cached = apiResponseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const extracted = extractValueByPath(
      cached.data,
      config.jsonPath || '',
      context?.rowIndex ?? 0,
      config.sampleStrategy || 'sequential'
    );
    return {
      success: true,
      value: extracted ?? config.fallbackValue ?? null,
      rawResponse: cached.data,
      status: 200,
      durationMs: Math.round(performance.now() - startTime)
    };
  }

  // Deduplicate in-flight identical requests
  if (inFlightRequests.has(cacheKey)) {
    try {
      const data = await inFlightRequests.get(cacheKey)!;
      const extracted = extractValueByPath(
        data,
        config.jsonPath || '',
        context?.rowIndex ?? 0,
        config.sampleStrategy || 'sequential'
      );
      return {
        success: true,
        value: extracted ?? config.fallbackValue ?? null,
        rawResponse: data,
        status: 200,
        durationMs: Math.round(performance.now() - startTime)
      };
    } catch (err: any) {
      return {
        success: false,
        value: config.fallbackValue || 'api_error',
        error: err.message
      };
    }
  }

  // Build fetch headers
  const fetchHeaders: Record<string, string> = {
    Accept: 'application/json, text/plain, */*'
  };
  if (config.headers) {
    for (const h of config.headers) {
      if (h.enabled && h.key.trim()) {
        fetchHeaders[h.key.trim()] = interpolateTemplate(h.value, context);
      }
    }
  }
  if (method === 'POST' && finalBody && !fetchHeaders['Content-Type']) {
    fetchHeaders['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 8000);

  const requestPromise = (async () => {
    const res = await fetch(finalUrl, {
      method,
      headers: fetchHeaders,
      body: method === 'POST' ? finalBody : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    let parsedData: unknown;
    if (contentType.includes('application/json')) {
      parsedData = await res.json();
    } else {
      const text = await res.text();
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = text;
      }
    }

    // Cache the response
    apiResponseCache.set(cacheKey, { data: parsedData, timestamp: Date.now() });
    return parsedData;
  })();

  inFlightRequests.set(cacheKey, requestPromise);

  try {
    const data = await requestPromise;
    inFlightRequests.delete(cacheKey);

    const extracted = extractValueByPath(
      data,
      config.jsonPath || '',
      context?.rowIndex ?? 0,
      config.sampleStrategy || 'sequential'
    );

    return {
      success: true,
      value: extracted ?? config.fallbackValue ?? null,
      rawResponse: data,
      status: 200,
      durationMs: Math.round(performance.now() - startTime)
    };
  } catch (err: any) {
    inFlightRequests.delete(cacheKey);
    const isAbort = err.name === 'AbortError';
    const isCors = err.message?.toLowerCase().includes('failed to fetch') || err.message?.toLowerCase().includes('networkerror');
    const msg = isAbort
      ? 'Request timed out'
      : isCors
      ? 'Network/CORS error: The endpoint blocked cross-origin access from browser.'
      : err.message || 'Unknown network error';

    return {
      success: false,
      value: config.fallbackValue || 'api_error',
      error: msg,
      durationMs: Math.round(performance.now() - startTime)
    };
  }
}

/**
 * Pre-fetches REST API pools for all columns in advance of batch generation.
 * This guarantees instantaneous synchronous row generation during large exports!
 */
export async function prefetchRestApiBatch(
  columns: { type: string; rule?: string }[],
  targetRowCount: number = 100
): Promise<void> {
  const fetchPromises: Promise<unknown>[] = [];

  for (const col of columns) {
    if (col.type === 'REST_API' || (col.rule && col.rule.includes('"type": "REST_API"'))) {
      const config = parseRestApiConfig(col.rule || '');
      if (config.url && config.retrievalMode !== 'per_row') {
        fetchPromises.push(executeRestApiFetch(config, { rowIndex: 0 }));
      }
    }
  }

  if (fetchPromises.length > 0) {
    await Promise.allSettled(fetchPromises);
  }
}

/**
 * Synchronously retrieves value from in-memory cache if available,
 * or returns fallback and triggers async fetch in background.
 */
export function getSynchronousRestApiValue(
  config: RestApiColumnConfig,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): unknown {
  const finalUrl = interpolateTemplate(config.url || '', context);
  const method = (config.method || 'GET').toUpperCase();
  const finalBody = config.body ? interpolateTemplate(config.body, context) : undefined;
  const cacheKey = computeCacheKey(finalUrl, method, config.headers, finalBody);

  const cached = apiResponseCache.get(cacheKey);
  if (cached) {
    const val = extractValueByPath(
      cached.data,
      config.jsonPath || '',
      context?.rowIndex ?? 0,
      config.sampleStrategy || 'sequential'
    );
    if (val !== null && val !== undefined) return val;
  }

  // Not in cache yet: trigger background fetch so subsequent renders/rows have it
  if (!inFlightRequests.has(cacheKey)) {
    executeRestApiFetch(config, context).catch(() => {});
  }

  // Return fallback or friendly placeholder while fetching
  return config.fallbackValue !== undefined && config.fallbackValue !== ''
    ? config.fallbackValue
    : 'Fetching API...';
}

/**
 * Discovers and flattens properties from a sample JSON record to suggest columns.
 */
export function discoverJsonSchemaFields(
  sampleItem: unknown,
  prefix: string = ''
): { name: string; path: string; type: string; sample: string }[] {
  if (!sampleItem || typeof sampleItem !== 'object') {
    return [];
  }

  const fields: { name: string; path: string; type: string; sample: string }[] = [];

  for (const [key, val] of Object.entries(sampleItem as Record<string, unknown>)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const colName = currentPath.replace(/\./g, '_').toLowerCase();

    if (val === null || val === undefined) {
      fields.push({ name: colName, path: currentPath, type: 'String', sample: 'null' });
    } else if (typeof val === 'number') {
      fields.push({
        name: colName,
        path: currentPath,
        type: Number.isInteger(val) ? 'Int' : 'Float',
        sample: String(val)
      });
    } else if (typeof val === 'boolean') {
      fields.push({ name: colName, path: currentPath, type: 'Boolean', sample: String(val) });
    } else if (typeof val === 'string') {
      // Detect UUID or Date
      const isDate = !isNaN(Date.parse(val)) && (val.includes('-') || val.includes('/')) && val.length >= 8;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      fields.push({
        name: colName,
        path: currentPath,
        type: isUuid ? 'UUID' : isDate ? 'DateTime' : 'String',
        sample: val.length > 30 ? `${val.substring(0, 30)}...` : val
      });
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      // Recurse 1 level deep
      const nested = discoverJsonSchemaFields(val, currentPath);
      fields.push(...nested);
    } else if (Array.isArray(val)) {
      fields.push({
        name: colName,
        path: currentPath,
        type: 'String',
        sample: `[${val.length} items]`
      });
    }
  }

  return fields;
}

export const REST_API_ROW_SOURCES_KEY = 'data_forge_rest_api_row_sources_v1';

/**
 * Retrieves registered Table/Row REST API sources.
 */
export function getRegisteredRowApiSources(): RestApiRowConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(REST_API_ROW_SOURCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Saves a registered Row API source.
 */
export function saveRowApiSource(source: RestApiRowConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = getRegisteredRowApiSources();
    const idx = list.findIndex((s) => s.id === source.id);
    let updated: RestApiRowConfig[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = source;
    } else {
      updated = [source, ...list];
    }
    localStorage.setItem(REST_API_ROW_SOURCES_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Deletes a registered Row API source.
 */
export function deleteRowApiSource(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = getRegisteredRowApiSources();
    const updated = list.filter((s) => s.id !== id);
    localStorage.setItem(REST_API_ROW_SOURCES_KEY, JSON.stringify(updated));
  } catch {}
}
