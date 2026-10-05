import { ActionConfig, ActionDispatchLog, ActionTriggerCondition } from '../types';

export const defaultActionConfig: ActionConfig = {
  enabled: false, // Off by default to avoid unexpected network calls & preserve maximum performance
  endpointUrl: '',
  method: 'POST',
  protocol: 'rest_json',
  mode: 'batch', // 'per_entry' (Every row complete) or 'batch' (Every X rows complete)
  batchSize: 50,
  batchPayloadKey: 'records',
  customHeaders: [
    { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
    { id: '2', key: 'X-Source', value: 'Vampio-Data-Engine', enabled: true }
  ],
  authType: 'none',
  retryOnError: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 10000,
  stopOnError: false,
  throttleMs: 50,
  triggerCondition: {
    enabled: false,
    column: '',
    operator: 'equals',
    value: ''
  }
};

/**
 * Checks if a generated row matches the configured trigger condition
 */
export function matchesTriggerCondition(
  row: Record<string, unknown>,
  condition?: ActionTriggerCondition
): boolean {
  if (!condition || !condition.enabled || !condition.column?.trim()) {
    return true; // No conditional filter active -> all rows match
  }

  const rawVal = row[condition.column.trim()];
  const rowStr = rawVal === null || rawVal === undefined ? '' : String(rawVal);
  let cleanTarget = (condition.value ?? '').trim();

  // Strip surrounding quotes if entered by user (e.g. "value y" or '1')
  if (
    (cleanTarget.startsWith('"') && cleanTarget.endsWith('"')) ||
    (cleanTarget.startsWith("'") && cleanTarget.endsWith("'"))
  ) {
    cleanTarget = cleanTarget.slice(1, -1).trim();
  }

  const rowLower = rowStr.toLowerCase();
  const targetLower = cleanTarget.toLowerCase();

  switch (condition.operator) {
    case 'equals':
      if (rowLower === targetLower) return true;
      // Handle boolean vs numeric (e.g. error = 1 when column is boolean true)
      if ((targetLower === '1' || targetLower === 'true') && (rowLower === '1' || rowLower === 'true')) return true;
      if ((targetLower === '0' || targetLower === 'false') && (rowLower === '0' || rowLower === 'false')) return true;
      return false;
    case 'not_equals':
      if (rowLower === targetLower) return false;
      if ((targetLower === '1' || targetLower === 'true') && (rowLower === '1' || rowLower === 'true')) return false;
      if ((targetLower === '0' || targetLower === 'false') && (rowLower === '0' || rowLower === 'false')) return false;
      return true;
    case 'greater_than': {
      const numRow = Number(rawVal);
      const numTarget = Number(cleanTarget);
      return !isNaN(numRow) && !isNaN(numTarget) && numRow > numTarget;
    }
    case 'less_than': {
      const numRow = Number(rawVal);
      const numTarget = Number(cleanTarget);
      return !isNaN(numRow) && !isNaN(numTarget) && numRow < numTarget;
    }
    case 'contains':
      return rowLower.includes(targetLower);
    default:
      return true;
  }
}

/**
 * Filters rows based on trigger condition if enabled
 */
export function filterRowsForAction(
  rows: Record<string, unknown>[],
  condition?: ActionTriggerCondition
): Record<string, unknown>[] {
  if (!condition || !condition.enabled || !condition.column?.trim()) {
    return rows;
  }
  return rows.filter((r) => matchesTriggerCondition(r, condition));
}

/**
 * Builds HTTP Headers object from ActionConfig
 */
export function buildActionHeaders(config: ActionConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
  };

  // Inject Authentication
  if (config.authType === 'bearer' && config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken.trim()}`;
  } else if (config.authType === 'basic' && (config.basicUser || config.basicPass)) {
    const creds = btoa(`${config.basicUser || ''}:${config.basicPass || ''}`);
    headers['Authorization'] = `Basic ${creds}`;
  } else if (config.authType === 'api_key' && config.apiKeyHeader && config.apiKeyValue) {
    headers[config.apiKeyHeader.trim()] = config.apiKeyValue.trim();
  }

  // Inject Custom Headers
  if (config.customHeaders && config.customHeaders.length > 0) {
    for (const h of config.customHeaders) {
      if (h.enabled && h.key.trim()) {
        headers[h.key.trim()] = h.value;
      }
    }
  }

  return headers;
}

/**
 * Formats data rows into JSON payload string according to config
 */
export function formatActionPayload(config: ActionConfig, rows: Record<string, unknown>[]): string {
  if (config.mode === 'per_entry') {
    return JSON.stringify(rows[0] || {}, null, 2);
  }

  const key = config.batchPayloadKey?.trim();
  if (key) {
    return JSON.stringify({
      [key]: rows,
      meta: {
        timestamp: new Date().toISOString(),
        count: rows.length,
        source: 'vampio-synthetic-engine'
      }
    }, null, 2);
  }

  return JSON.stringify(rows, null, 2);
}

/**
 * Sleep helper for backoff delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dispatches an Action HTTP request with retry and exponential backoff
 */
export async function dispatchActionRequest(
  config: ActionConfig,
  rows: Record<string, unknown>[],
  batchIndex: number,
  onLog?: (log: ActionDispatchLog) => void
): Promise<{
  success: boolean;
  statusCode?: number;
  durationMs: number;
  error?: string;
  responseBody?: string;
}> {
  if (!config.endpointUrl.trim()) {
    const err = 'No Endpoint URL configured';
    onLog?.({
      id: `dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      batchIndex,
      rowCount: rows.length,
      status: 'error',
      durationMs: 0,
      errorMessage: err,
      payloadPreview: formatActionPayload(config, rows).slice(0, 1000),
      records: rows
    });
    return { success: false, durationMs: 0, error: err };
  }

  const headers = buildActionHeaders(config);
  const payloadStr = formatActionPayload(config, rows);
  const maxAttempts = config.retryOnError ? Math.max(1, config.maxRetries || 3) : 1;
  const timeoutMs = Math.max(1000, config.timeoutMs || 10000);

  let lastError: string | undefined;
  let lastStatusCode: number | undefined;
  let lastResponseBody: string | undefined;
  let totalDuration = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (attempt > 1) {
        onLog?.({
          id: `dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          batchIndex,
          rowCount: rows.length,
          status: 'retrying',
          durationMs: Math.round(performance.now() - startTime),
          retryAttempt: attempt,
          payloadPreview: payloadStr.slice(0, 1000),
          records: rows
        });
      }

      const response = await fetch(config.endpointUrl.trim(), {
        method: config.method || 'POST',
        headers,
        body: payloadStr,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const reqDuration = Math.round(performance.now() - startTime);
      totalDuration += reqDuration;
      lastStatusCode = response.status;

      let responseText = '';
      try {
        responseText = await response.text();
        lastResponseBody = responseText.slice(0, 2000);
      } catch {
        // Ignore response body read failure
      }

      if (response.ok) {
        onLog?.({
          id: `dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          batchIndex,
          rowCount: rows.length,
          status: 'success',
          statusCode: response.status,
          durationMs: reqDuration,
          payloadPreview: payloadStr.slice(0, 1000),
          responsePreview: lastResponseBody,
          records: rows
        });

        return {
          success: true,
          statusCode: response.status,
          durationMs: reqDuration,
          responseBody: lastResponseBody
        };
      }

      // If status is 4xx (client error), retrying usually won't help unless 429 (rate limited)
      lastError = `HTTP ${response.status} (${response.statusText || 'Error'})`;
      const isRetryable = response.status === 429 || response.status >= 500;

      if (!isRetryable || attempt >= maxAttempts) {
        break;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const reqDuration = Math.round(performance.now() - startTime);
      totalDuration += reqDuration;

      if (err.name === 'AbortError') {
        lastError = `Request timed out after ${timeoutMs}ms`;
      } else {
        lastError = err.message || 'Network request failed (Check CORS or server reachability)';
      }

      if (attempt >= maxAttempts) {
        break;
      }
    }

    // Exponential backoff before next attempt
    const backoffMs = Math.round((config.retryDelayMs || 1000) * Math.pow(1.5, attempt - 1));
    await sleep(backoffMs);
  }

  // Failed after all retry attempts
  onLog?.({
    id: `dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    batchIndex,
    rowCount: rows.length,
    status: 'error',
    statusCode: lastStatusCode,
    durationMs: totalDuration,
    errorMessage: lastError,
    payloadPreview: payloadStr.slice(0, 1000),
    responsePreview: lastResponseBody,
    records: rows
  });

  return {
    success: false,
    statusCode: lastStatusCode,
    durationMs: totalDuration,
    error: lastError,
    responseBody: lastResponseBody
  };
}

/**
 * Executes a single dry-run test ping with 1 sample record
 */
export async function testActionEndpoint(
  config: ActionConfig,
  sampleRow: Record<string, unknown>
): Promise<{
  success: boolean;
  statusCode?: number;
  durationMs: number;
  message: string;
  responseBody?: string;
}> {
  if (!config.endpointUrl.trim()) {
    return {
      success: false,
      durationMs: 0,
      message: 'Please provide an Endpoint URL'
    };
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.min(10000, config.timeoutMs || 8000));

  try {
    const headers = buildActionHeaders(config);
    const payload = formatActionPayload(config, [sampleRow]);

    const res = await fetch(config.endpointUrl.trim(), {
      method: config.method || 'POST',
      headers,
      body: payload,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startTime);

    let resBody = '';
    try {
      resBody = await res.text();
    } catch {
      // ignore
    }

    if (res.ok) {
      return {
        success: true,
        statusCode: res.status,
        durationMs,
        message: `Connected successfully! (${res.status} ${res.statusText || 'OK'} in ${durationMs}ms)`,
        responseBody: resBody.slice(0, 2000)
      };
    }

    return {
      success: false,
      statusCode: res.status,
      durationMs,
      message: `Endpoint returned HTTP ${res.status} ${res.statusText}`,
      responseBody: resBody.slice(0, 2000)
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startTime);
    if (err.name === 'AbortError') {
      return {
        success: false,
        durationMs,
        message: 'Test ping timed out'
      };
    }
    return {
      success: false,
      durationMs,
      message: err.message?.includes('Failed to fetch')
        ? 'Failed to fetch (Check URL, server online status, and CORS access headers)'
        : err.message || 'Connection error'
    };
  }
}
