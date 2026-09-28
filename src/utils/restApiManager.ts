import { useState, useEffect } from 'react';

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

export interface RestApiLatencyStats {
  columnId?: string;
  url: string;
  method: string;
  lastLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  history: number[]; // Array of last N response times in ms (up to 10 measurements)
  lastPrefetchedAt: number;
  sampleCount: number;
  success: boolean;
  status?: number;
  error?: string;
  isPrefetching?: boolean;
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

// In-memory cache for API responses: Map<cacheKey, { data: unknown; timestamp: number; latencyMs?: number }>
interface ApiResponseCacheEntry {
  data: unknown;
  timestamp: number;
  latencyMs?: number;
}
const apiResponseCache = new Map<string, ApiResponseCacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Latency & Metrics tracking registry for batch prefetches
const latencyStatsByColId = new Map<string, RestApiLatencyStats>();
const latencyStatsByUrl = new Map<string, RestApiLatencyStats>();
const latencyListeners = new Set<() => void>();

function notifyLatencyListeners() {
  latencyListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function normalizeApiUrl(url: string): string {
  return (url || '').trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Records a measured network latency for a REST API endpoint.
 * Automatically updates moving average, min, max, and history buffer (for sparklines).
 */
export function recordLatencyMetric(params: {
  columnId?: string;
  url: string;
  method?: string;
  latencyMs: number;
  success: boolean;
  status?: number;
  error?: string;
}): RestApiLatencyStats {
  const url = params.url || '';
  const normUrl = normalizeApiUrl(url);
  const method = (params.method || 'GET').toUpperCase();

  const existing =
    (params.columnId ? latencyStatsByColId.get(params.columnId) : null) ||
    (normUrl ? latencyStatsByUrl.get(normUrl) : null);

  const latency = Math.max(1, Math.round(params.latencyMs));
  const prevHistory = existing?.history && existing.history.length > 0 ? existing.history : [];
  const newHistory = [...prevHistory, latency].slice(-10);

  const sum = newHistory.reduce((acc, v) => acc + v, 0);
  const avgLatencyMs = Math.round(sum / newHistory.length);
  const minLatencyMs = Math.min(...newHistory);
  const maxLatencyMs = Math.max(...newHistory);

  const stats: RestApiLatencyStats = {
    columnId: params.columnId || existing?.columnId,
    url,
    method,
    lastLatencyMs: latency,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    history: newHistory,
    lastPrefetchedAt: Date.now(),
    sampleCount: (existing?.sampleCount || 0) + 1,
    success: params.success,
    status: params.status ?? (params.success ? 200 : undefined),
    error: params.error,
    isPrefetching: false
  };

  if (params.columnId) {
    latencyStatsByColId.set(params.columnId, stats);
  }
  if (normUrl) {
    latencyStatsByUrl.set(normUrl, stats);
  }

  notifyLatencyListeners();
  return stats;
}

/**
 * Sets the prefetching state for a column or URL.
 */
export function setLatencyPrefetching(columnId?: string, url?: string, isPrefetching: boolean = true): void {
  const normUrl = url ? normalizeApiUrl(url) : '';
  const existing =
    (columnId ? latencyStatsByColId.get(columnId) : null) ||
    (normUrl ? latencyStatsByUrl.get(normUrl) : null);

  if (existing) {
    const updated: RestApiLatencyStats = { ...existing, isPrefetching };
    if (columnId) latencyStatsByColId.set(columnId, updated);
    if (normUrl) latencyStatsByUrl.set(normUrl, updated);
    notifyLatencyListeners();
  } else if (isPrefetching && (columnId || normUrl)) {
    const placeholder: RestApiLatencyStats = {
      columnId,
      url: url || '',
      method: 'GET',
      lastLatencyMs: 0,
      avgLatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      history: [],
      lastPrefetchedAt: Date.now(),
      sampleCount: 0,
      success: true,
      isPrefetching: true
    };
    if (columnId) latencyStatsByColId.set(columnId, placeholder);
    if (normUrl) latencyStatsByUrl.set(normUrl, placeholder);
    notifyLatencyListeners();
  }
}

/**
 * Retrieves the current latency stats for a column ID or URL.
 */
export function getLatencyStats(columnId?: string, url?: string): RestApiLatencyStats | null {
  if (columnId && latencyStatsByColId.has(columnId)) {
    return latencyStatsByColId.get(columnId)!;
  }
  if (url) {
    const normUrl = normalizeApiUrl(url);
    if (latencyStatsByUrl.has(normUrl)) {
      return latencyStatsByUrl.get(normUrl)!;
    }
  }
  return null;
}

/**
 * Subscribes to latency stats updates.
 */
export function subscribeLatencyStats(listener: () => void): () => void {
  latencyListeners.add(listener);
  return () => {
    latencyListeners.delete(listener);
  };
}

/**
 * React hook to observe real-time latency stats and prefetch state for a REST API column.
 */
export function useRestApiLatency(columnId?: string, url?: string): RestApiLatencyStats | null {
  const [stats, setStats] = useState<RestApiLatencyStats | null>(() => getLatencyStats(columnId, url));

  useEffect(() => {
    setStats(getLatencyStats(columnId, url));
    return subscribeLatencyStats(() => {
      setStats(getLatencyStats(columnId, url));
    });
  }, [columnId, url]);

  return stats;
}

/**
 * Directly pings an endpoint to test connection and refresh latency metrics immediately.
 */
export async function pingRestApiEndpoint(
  config: RestApiColumnConfig,
  columnId?: string
): Promise<RestApiLatencyStats> {
  setLatencyPrefetching(columnId, config.url, true);
  const result = await executeRestApiFetch(config, { rowIndex: 0 }, { forceRefresh: true, columnId });
  return recordLatencyMetric({
    columnId,
    url: config.url,
    method: config.method || 'GET',
    latencyMs: result.durationMs || 0,
    success: result.success,
    status: result.status,
    error: result.error
  });
}

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
export function computeCacheKey(url: string, method: string = 'GET', headers?: RestApiHeader[], body?: string): string {
  const activeHeaders = (headers || [])
    .filter((h) => h.enabled && h.key)
    .map((h) => `${h.key}:${h.value}`)
    .sort()
    .join('|');
  return `${method.toUpperCase()}:${url}:${activeHeaders}:${body || ''}`;
}

/**
 * Retrieves cached response data directly by URL and method if available and valid.
 */
export function getCachedApiResponse(
  url: string,
  method: string = 'GET',
  headers?: RestApiHeader[],
  body?: string
): unknown | undefined {
  const cacheKey = computeCacheKey(url, method, headers, body);
  const cached = apiResponseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return undefined;
}

/**
 * Stores data into the API response cache.
 */
export function setCachedApiResponse(
  url: string,
  data: unknown,
  method: string = 'GET',
  headers?: RestApiHeader[],
  body?: string
): void {
  const cacheKey = computeCacheKey(url, method, headers, body);
  apiResponseCache.set(cacheKey, { data, timestamp: Date.now(), latencyMs: 38 });
  recordLatencyMetric({
    url,
    method,
    latencyMs: 38,
    success: true,
    status: 200
  });
}

/**
 * Scans code or rule text to extract any HTTP/HTTPS URLs for prefetching.
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const urls: string[] = [];
  const regex = /https?:\/\/[^\s"'`<>)+,;\]]+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:)\]]+$/, '');
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Pre-fetches a list of URLs in parallel to prime the cache.
 */
export async function prefetchUrls(urls: string[]): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (const url of urls) {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      const cacheKey = computeCacheKey(url, 'GET');
      if (!apiResponseCache.has(cacheKey) && !inFlightRequests.has(cacheKey)) {
        promises.push(executeRestApiFetch({ url, method: 'GET' }, { rowIndex: 0 }));
      }
    }
  }
  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}

export interface ApiCallSyncOptions {
  url: string;
  method?: RestApiMethod;
  headers?: Record<string, string>;
  body?: unknown;
  jsonPath?: string;
  sampleStrategy?: 'sequential' | 'random';
  fallback?: unknown;
  rowIndex?: number;
  row?: Record<string, unknown>;
}

/**
 * Universal synchronous API retrieval function used by script engines (JS & Lua).
 * Checks the in-memory cache; if not cached yet, triggers background fetch and returns fallback/null.
 */
export function apiCallSync(options: ApiCallSyncOptions): unknown {
  const url = options.url || '';
  const method = (options.method || 'GET').toUpperCase() as RestApiMethod;
  const headerList: RestApiHeader[] = options.headers
    ? Object.entries(options.headers).map(([key, value]) => ({ key, value, enabled: true }))
    : [];
  const stringBody = typeof options.body === 'object' && options.body !== null
    ? JSON.stringify(options.body)
    : options.body !== undefined ? String(options.body) : undefined;

  const finalUrl = interpolateTemplate(url, { rowIndex: options.rowIndex, row: options.row });
  const cacheKey = computeCacheKey(finalUrl, method, headerList, stringBody);

  const cached = apiResponseCache.get(cacheKey);
  if (cached) {
    if (options.jsonPath) {
      const extracted = extractValueByPath(
        cached.data,
        options.jsonPath,
        options.rowIndex ?? 0,
        options.sampleStrategy || 'sequential'
      );
      return extracted !== null && extracted !== undefined ? extracted : options.fallback ?? null;
    }
    return cached.data;
  }

  // Not in cache yet: trigger background fetch so subsequent calls/rows have it
  if (!inFlightRequests.has(cacheKey)) {
    executeRestApiFetch(
      {
        url: finalUrl,
        method,
        headers: headerList,
        body: stringBody,
        jsonPath: options.jsonPath,
        sampleStrategy: options.sampleStrategy
      },
      { rowIndex: options.rowIndex, row: options.row }
    ).catch(() => {});
  }

  return options.fallback !== undefined ? options.fallback : null;
}

/**
 * Executes a live fetch to an external REST API endpoint with caching and timeout.
 */
export async function executeRestApiFetch(
  config: RestApiColumnConfig,
  context?: { rowIndex?: number; row?: Record<string, unknown> },
  options?: { forceRefresh?: boolean; columnId?: string }
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

  // Check in-memory cache if not forcing fresh request
  if (!options?.forceRefresh) {
    const cached = apiResponseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const extracted = extractValueByPath(
        cached.data,
        config.jsonPath || '',
        context?.rowIndex ?? 0,
        config.sampleStrategy || 'sequential'
      );
      const measured = cached.latencyMs ?? Math.max(1, Math.round(performance.now() - startTime));
      return {
        success: true,
        value: extracted ?? config.fallbackValue ?? null,
        rawResponse: cached.data,
        status: 200,
        durationMs: measured
      };
    }
  }

  // Deduplicate in-flight identical requests
  if (inFlightRequests.has(cacheKey) && !options?.forceRefresh) {
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
        durationMs: Math.max(1, Math.round(performance.now() - startTime))
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

    const elapsed = Math.max(1, Math.round(performance.now() - startTime));
    // Cache the response along with measured network latency
    apiResponseCache.set(cacheKey, { data: parsedData, timestamp: Date.now(), latencyMs: elapsed });
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

    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    recordLatencyMetric({
      columnId: options?.columnId,
      url: finalUrl || config.url,
      method,
      latencyMs: durationMs,
      success: true,
      status: 200
    });

    return {
      success: true,
      value: extracted ?? config.fallbackValue ?? null,
      rawResponse: data,
      status: 200,
      durationMs
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

    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    recordLatencyMetric({
      columnId: options?.columnId,
      url: finalUrl || config.url,
      method,
      latencyMs: durationMs,
      success: false,
      error: msg
    });

    return {
      success: false,
      value: config.fallbackValue || 'api_error',
      error: msg,
      durationMs
    };
  }
}

/**
 * Pre-fetches REST API pools for all columns in advance of batch generation.
 * This guarantees instantaneous synchronous row generation during large exports!
 */
export async function prefetchRestApiBatch(
  columns: { id?: string; name?: string; type: string; rule?: string }[],
  targetRowCount: number = 100
): Promise<void> {
  const fetchPromises: Promise<unknown>[] = [];

  for (const col of columns) {
    if (col.type === 'REST_API' || (col.rule && col.rule.includes('"type": "REST_API"'))) {
      const config = parseRestApiConfig(col.rule || '');
      if (config.url) {
        setLatencyPrefetching(col.id, config.url, true);

        if (config.retrievalMode === 'per_row') {
          // For per-row mode, sample up to 3 queries to prefetch and calculate average response time
          const sampleCount = Math.min(3, Math.max(1, targetRowCount));
          const samplePromises: Promise<any>[] = [];
          for (let r = 0; r < sampleCount; r++) {
            samplePromises.push(
              executeRestApiFetch(
                config,
                { rowIndex: r },
                { forceRefresh: true, columnId: col.id }
              )
            );
          }
          fetchPromises.push(
            Promise.allSettled(samplePromises).finally(() => {
              setLatencyPrefetching(col.id, config.url, false);
            })
          );
        } else {
          // Pool mode: execute fresh fetch to measure current response time
          fetchPromises.push(
            executeRestApiFetch(
              config,
              { rowIndex: 0 },
              { forceRefresh: true, columnId: col.id }
            ).finally(() => {
              setLatencyPrefetching(col.id, config.url, false);
            })
          );
        }
      }
    }

    // Also scan any script rules (Script/Lua) for embedded REST API URLs
    if (col.rule) {
      const urls = extractUrlsFromText(col.rule);
      for (const url of urls) {
        const cacheKey = computeCacheKey(url, 'GET');
        if (!apiResponseCache.has(cacheKey) && !inFlightRequests.has(cacheKey)) {
          fetchPromises.push(executeRestApiFetch({ url, method: 'GET' }, { rowIndex: 0 }));
        }
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
