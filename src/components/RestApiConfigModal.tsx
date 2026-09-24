import React, { useState, useEffect } from 'react';
import {
  Globe,
  ArrowRight,
  Play,
  Check,
  X,
  RefreshCw,
  Layers,
  Plus,
  Trash2,
  Database,
  Code2,
  Sparkles,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Settings2,
  Table,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  RestApiColumnConfig,
  RestApiHeader,
  RestApiMethod,
  RestApiRetrievalMode,
  CURATED_REST_API_PRESETS,
  executeRestApiFetch,
  discoverJsonSchemaFields,
  parseRestApiConfig,
  serializeRestApiConfig,
  RestApiPreset
} from '../utils/restApiManager';
import { ColumnSpec, StandardColumnType } from '../types';

interface RestApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  // For Column configuration:
  currentConfig?: RestApiColumnConfig;
  onSaveColumnConfig?: (config: RestApiColumnConfig) => void;
  columnName?: string;
  // For Row & Table enrichment:
  existingColumns?: ColumnSpec[];
  onImportRowColumns?: (newColumns: ColumnSpec[], fetchedRows?: Record<string, unknown>[]) => void;
  initialTab?: 'column' | 'row';
}

export const RestApiConfigModal: React.FC<RestApiConfigModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveColumnConfig,
  columnName = 'api_field',
  existingColumns = [],
  onImportRowColumns,
  initialTab = 'column'
}) => {
  const [activeTab, setActiveTab] = useState<'column' | 'row'>(initialTab);

  // Column mode state
  const [url, setUrl] = useState('https://dummyjson.com/users?limit=50');
  const [method, setMethod] = useState<RestApiMethod>('GET');
  const [headers, setHeaders] = useState<RestApiHeader[]>([]);
  const [body, setBody] = useState('');
  const [jsonPath, setJsonPath] = useState('users[].email');
  const [retrievalMode, setRetrievalMode] = useState<RestApiRetrievalMode>('pool');
  const [sampleStrategy, setSampleStrategy] = useState<'sequential' | 'random'>('sequential');
  const [fallbackValue, setFallbackValue] = useState('');

  // Execution & Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    value: unknown;
    rawResponse?: unknown;
    status?: number;
    durationMs?: number;
    error?: string;
  } | null>(null);

  // Row enrichment state
  const [rowEndpointUrl, setRowEndpointUrl] = useState('https://dummyjson.com/users?limit=30');
  const [rowMethod, setRowMethod] = useState<RestApiMethod>('GET');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredFields, setDiscoveredFields] = useState<
    { name: string; path: string; type: string; sample: string; selected: boolean }[]
  >([]);
  const [rowDiscoveryRawData, setRowDiscoveryRawData] = useState<unknown[]>([]);
  const [rowDiscoveryError, setRowDiscoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (currentConfig) {
        setUrl(currentConfig.url || 'https://dummyjson.com/users?limit=50');
        setMethod(currentConfig.method || 'GET');
        setHeaders(currentConfig.headers || []);
        setBody(currentConfig.body || '');
        setJsonPath(currentConfig.jsonPath || '');
        setRetrievalMode(currentConfig.retrievalMode || 'pool');
        setSampleStrategy(currentConfig.sampleStrategy || 'sequential');
        setFallbackValue(currentConfig.fallbackValue || '');
      }
      setTestResult(null);
      setRowDiscoveryError(null);
    }
  }, [isOpen, currentConfig, initialTab]);

  if (!isOpen) return null;

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }]);
  };

  const handleUpdateHeader = (index: number, field: keyof RestApiHeader, val: any) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], [field]: val };
    setHeaders(updated);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleApplyPreset = (preset: RestApiPreset) => {
    setUrl(preset.url);
    setMethod(preset.method);
    setJsonPath(preset.jsonPath);
    setSampleStrategy(preset.sampleStrategy);
    setRowEndpointUrl(preset.url);
    setTestResult(null);
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const cfg: RestApiColumnConfig = {
      url,
      method,
      headers,
      body,
      jsonPath,
      retrievalMode,
      sampleStrategy,
      fallbackValue
    };
    const res = await executeRestApiFetch(cfg, { rowIndex: 0 });
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSaveColumn = () => {
    if (!onSaveColumnConfig) return;
    const config: RestApiColumnConfig = {
      url: url.trim(),
      method,
      headers: headers.filter((h) => h.key.trim() !== ''),
      body: method === 'POST' ? body : undefined,
      jsonPath: jsonPath.trim(),
      retrievalMode,
      sampleStrategy,
      fallbackValue: fallbackValue.trim()
    };
    onSaveColumnConfig(config);
    onClose();
  };

  // Row Discovery Workflow
  const handleDiscoverRows = async () => {
    setIsDiscovering(true);
    setRowDiscoveryError(null);
    setDiscoveredFields([]);
    try {
      const cfg: RestApiColumnConfig = {
        url: rowEndpointUrl,
        method: rowMethod,
        retrievalMode: 'pool'
      };
      const res = await executeRestApiFetch(cfg);
      if (!res.success || !res.rawResponse) {
        throw new Error(res.error || 'Failed to fetch from endpoint');
      }

      let itemsArray: unknown[] = [];
      const raw = res.rawResponse;

      if (Array.isArray(raw)) {
        itemsArray = raw;
      } else if (typeof raw === 'object' && raw !== null) {
        // Find first array property (e.g. users, products, data, items, results)
        const arrayKey = Object.keys(raw).find((k) => Array.isArray((raw as any)[k]));
        if (arrayKey) {
          itemsArray = (raw as any)[arrayKey];
        } else {
          itemsArray = [raw];
        }
      }

      if (itemsArray.length === 0) {
        throw new Error('API returned an empty dataset or no array was found in response.');
      }

      setRowDiscoveryRawData(itemsArray);
      const fields = discoverJsonSchemaFields(itemsArray[0]);
      setDiscoveredFields(fields.map((f) => ({ ...f, selected: true })));
    } catch (err: any) {
      setRowDiscoveryError(err.message || 'Failed to inspect REST API schema');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleApplyRowEnrichment = (includeRows: boolean) => {
    if (!onImportRowColumns) return;
    const selected = discoveredFields.filter((f) => f.selected);
    if (selected.length === 0) {
      alert('Please select at least one field to import.');
      return;
    }

    // Determine root array path from rowDiscoveryRawData / URL
    const isRootArray = url.includes('[].');
    const newColumns: ColumnSpec[] = selected.map((f, idx) => {
      const colId = Date.now().toString() + Math.random().toString(36).substring(2, 6) + idx;
      // Configure each column to pull from this API with its specific jsonPath
      const colCfg: RestApiColumnConfig = {
        url: rowEndpointUrl,
        method: rowMethod,
        jsonPath: f.path.includes('.') ? f.path : `${f.path}`,
        retrievalMode: 'pool',
        sampleStrategy: 'sequential',
        fallbackValue: ''
      };

      return {
        id: colId,
        name: f.name,
        type: 'REST_API' as StandardColumnType,
        rule: serializeRestApiConfig(colCfg),
        skip_pct: 0,
        condition: '',
        notes: `Extracted from ${f.path}`
      };
    });

    let transformedRows: Record<string, unknown>[] | undefined = undefined;
    if (includeRows && rowDiscoveryRawData.length > 0) {
      transformedRows = rowDiscoveryRawData.map((item: any, rowIdx) => {
        const rowObj: Record<string, unknown> = {};
        for (const f of selected) {
          // extract from item
          const parts = f.path.split('.');
          let val = item;
          for (const p of parts) {
            if (val !== null && val !== undefined) {
              val = val[p];
            }
          }
          rowObj[f.name] = val !== undefined ? val : null;
        }
        return rowObj;
      });
    }

    onImportRowColumns(newColumns, transformedRows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-secondary border border-border-subtle rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-primary/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <span>REST API Retrieval & Enrichment</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  HTTP GET / POST
                </span>
              </h2>
              <p className="text-xs text-content-muted">
                Connect live API endpoints to populate columns and rows with authentic remote data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 border-b border-border-subtle bg-secondary">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('column')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'column'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              <Code2 size={14} />
              <span>Column Retrieval ({columnName})</span>
            </button>
            <button
              onClick={() => setActiveTab('row')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'row'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              <Table size={14} />
              <span>Row & Multi-Column Enrichment</span>
            </button>
          </div>

          {/* Quick Preset Inspiration */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[10px] text-content-muted font-medium">Presets:</span>
            {CURATED_REST_API_PRESETS.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2 py-0.5 text-[10px] bg-primary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'column' ? (
            <div className="space-y-4">
              {/* Endpoint URL & Method */}
              <div>
                <label className="text-xs font-semibold text-content block mb-1.5">
                  Endpoint URL <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as RestApiMethod)}
                    className="px-3 py-2 text-xs font-bold bg-primary border border-border-subtle rounded-xl text-accent focus:outline-none focus:border-accent shrink-0"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://api.example.com/data or https://dummyjson.com/users"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-primary border border-border-subtle rounded-xl text-content focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleRunTest}
                    disabled={isTesting || !url.trim()}
                    className="px-3.5 py-2 rounded-xl bg-accent text-accent-content font-bold text-xs shadow-sm hover:opacity-95 disabled:opacity-50 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isTesting ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                    <span>Test API</span>
                  </button>
                </div>
                <p className="text-[11px] text-content-muted mt-1">
                  Supports dynamic parameters: <code className="text-accent">{'{rowIndex}'}</code>,{' '}
                  <code className="text-accent">{'{row.other_column}'}</code>, <code className="text-accent">{'{date}'}</code>
                </p>
              </div>

              {/* Retrieval Strategy & JSON Path */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-content block mb-1">
                    Retrieval Mode
                  </label>
                  <select
                    value={retrievalMode}
                    onChange={(e) => setRetrievalMode(e.target.value as RestApiRetrievalMode)}
                    className="w-full px-3 py-2 text-xs bg-primary border border-border-subtle rounded-xl text-content focus:outline-none focus:border-accent"
                  >
                    <option value="pool">Dataset Pool (Fetch once, distribute items)</option>
                    <option value="per_row">Per-Row Request (Dynamic parameter fetch)</option>
                  </select>
                  <p className="text-[10px] text-content-muted mt-1">
                    {retrievalMode === 'pool'
                      ? 'Ideal for high volume & rate-limited APIs: queries once and reuses items.'
                      : 'Executes a dedicated HTTP request per row using preceding row values.'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-content block mb-1">
                    Response JSON Path <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={jsonPath}
                    onChange={(e) => setJsonPath(e.target.value)}
                    placeholder="e.g. users[].email or products[].title or [].id"
                    className="w-full px-3 py-2 text-xs font-mono bg-primary border border-border-subtle rounded-xl text-content focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-content-muted mt-1">
                    Examples: <code className="text-accent">users[].email</code>, <code className="text-accent">[].title</code>, <code className="text-accent">address.city</code>
                  </p>
                </div>
              </div>

              {/* Advanced Configuration: Headers & Fallback Value */}
              <div className="bg-primary/30 border border-border-subtle rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-content flex items-center gap-1.5">
                    <Settings2 size={13} className="text-accent" />
                    <span>HTTP Headers & Fallbacks</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-[11px] text-accent hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Header</span>
                  </button>
                </div>

                {headers.length > 0 && (
                  <div className="space-y-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => handleUpdateHeader(i, 'enabled', e.target.checked)}
                          className="rounded text-accent focus:ring-accent"
                        />
                        <input
                          type="text"
                          placeholder="Header Name (e.g. Authorization)"
                          value={h.key}
                          onChange={(e) => handleUpdateHeader(i, 'key', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g. Bearer token...)"
                          value={h.value}
                          onChange={(e) => handleUpdateHeader(i, 'value', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(i)}
                          className="p-1.5 text-content-muted hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-content block mb-1">
                      Fallback Value (Offline / Rate Limit)
                    </label>
                    <input
                      type="text"
                      value={fallbackValue}
                      onChange={(e) => setFallbackValue(e.target.value)}
                      placeholder="e.g. fallback_val or leave blank"
                      className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-content block mb-1">
                      Sample Distribution Strategy
                    </label>
                    <select
                      value={sampleStrategy}
                      onChange={(e) => setSampleStrategy(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                    >
                      <option value="sequential">Sequential (Index 0, 1, 2, ...)</option>
                      <option value="random">Random Sampling</option>
                    </select>
                  </div>
                </div>

                {method === 'POST' && (
                  <div>
                    <label className="text-[11px] font-semibold text-content block mb-1">
                      JSON Request Body (POST)
                    </label>
                    <textarea
                      rows={3}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={'{\n  "query": "{row.name}"\n}'}
                      className="w-full px-3 py-2 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>

              {/* Test Results Inspector */}
              {testResult && (
                <div
                  className={`rounded-xl border p-4 space-y-2.5 animate-in fade-in ${
                    testResult.success
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-rose-500/5 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          testResult.success ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-xs font-bold text-content">
                        {testResult.success ? 'HTTP 200 OK — Data Retrieved' : 'Fetch Failed'}
                      </span>
                      {testResult.durationMs !== undefined && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border-subtle text-content-muted">
                          {testResult.durationMs} ms
                        </span>
                      )}
                    </div>
                  </div>

                  {testResult.error && (
                    <div className="text-xs text-rose-400 font-mono bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                      {testResult.error}
                    </div>
                  )}

                  {testResult.success && (
                    <div className="space-y-2">
                      <div className="bg-secondary p-2.5 rounded-lg border border-border-subtle flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-content-muted mr-1.5">Extracted Value:</span>
                          <strong className="text-accent font-mono">
                            {testResult.value !== null && testResult.value !== undefined
                              ? typeof testResult.value === 'object'
                                ? JSON.stringify(testResult.value)
                                : String(testResult.value)
                              : 'null'}
                          </strong>
                        </div>
                        <span className="text-[10px] text-content-muted font-mono">
                          path: {jsonPath || '(root)'}
                        </span>
                      </div>

                      {/* Raw Response Preview */}
                      <details className="text-xs text-content-muted">
                        <summary className="cursor-pointer hover:text-content select-none font-semibold">
                          Inspect Raw JSON Response Payload
                        </summary>
                        <pre className="mt-2 p-2.5 bg-primary rounded-lg border border-border-subtle max-h-40 overflow-auto font-mono text-[11px] text-content whitespace-pre-wrap">
                          {JSON.stringify(testResult.rawResponse, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Row & Multi-Column Enrichment Tab */
            <div className="space-y-4">
              <div className="bg-primary/40 border border-border-subtle rounded-xl p-3.5 space-y-2">
                <p className="text-xs text-content font-medium">
                  Fetch an array of records from any REST API to automatically discover fields and populate multiple columns simultaneously:
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={rowMethod}
                    onChange={(e) => setRowMethod(e.target.value as RestApiMethod)}
                    className="px-3 py-2 text-xs font-bold bg-secondary border border-border-subtle rounded-xl text-accent focus:outline-none focus:border-accent shrink-0"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                  <input
                    type="url"
                    value={rowEndpointUrl}
                    onChange={(e) => setRowEndpointUrl(e.target.value)}
                    placeholder="https://dummyjson.com/users?limit=30"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-secondary border border-border-subtle rounded-xl text-content focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleDiscoverRows}
                    disabled={isDiscovering || !rowEndpointUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-accent text-accent-content font-bold text-xs shadow-sm hover:opacity-95 disabled:opacity-50 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isDiscovering ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>Fetch & Detect Columns</span>
                  </button>
                </div>
              </div>

              {rowDiscoveryError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-400 font-mono">
                  {rowDiscoveryError}
                </div>
              )}

              {/* Discovered Fields List */}
              {discoveredFields.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-content">
                        Detected Fields ({discoveredFields.filter((f) => f.selected).length}/{discoveredFields.length} selected)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                        {rowDiscoveryRawData.length} records fetched
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setDiscoveredFields(discoveredFields.map((f) => ({ ...f, selected: true })))
                        }
                        className="text-accent hover:underline font-medium text-[11px] cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-border-subtle">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDiscoveredFields(discoveredFields.map((f) => ({ ...f, selected: false })))
                        }
                        className="text-content-muted hover:text-content font-medium text-[11px] cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-border-subtle rounded-xl divide-y divide-border-subtle bg-primary/20">
                    {discoveredFields.map((field, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const updated = [...discoveredFields];
                          updated[idx].selected = !updated[idx].selected;
                          setDiscoveredFields(updated);
                        }}
                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-secondary/60 transition ${
                          field.selected ? 'bg-accent/5' : 'opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {field.selected ? (
                            <CheckSquare size={16} className="text-accent shrink-0" />
                          ) : (
                            <Square size={16} className="text-content-muted shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-content font-mono mr-2">
                              {field.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                              {field.type}
                            </span>
                            <span className="text-[10px] text-content-muted ml-2 truncate font-mono">
                              path: {field.path}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-content font-mono truncate max-w-xs shrink-0 opacity-80">
                          e.g. "{field.sample}"
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions for importing */}
                  <div className="bg-secondary p-3.5 rounded-xl border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-content-muted">
                      Ready to add <strong className="text-accent">{discoveredFields.filter((f) => f.selected).length}</strong> columns to schema
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyRowEnrichment(false)}
                        className="px-3 py-1.5 text-xs font-semibold text-content bg-secondary hover:bg-tertiary rounded-lg border border-border-subtle transition cursor-pointer"
                      >
                        Add Columns Only
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyRowEnrichment(true)}
                        className="px-3.5 py-1.5 text-xs font-bold text-accent-content bg-accent hover:opacity-95 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Table size={13} />
                        <span>Add Columns & Populate Rows</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border-subtle bg-primary/40">
          <div className="text-xs text-content-muted">
            {activeTab === 'column' ? (
              <span>Target Column: <strong className="text-accent">{columnName}</strong></span>
            ) : (
              <span>Row Multi-Column Enrichment</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-content-muted hover:text-content bg-secondary hover:bg-tertiary rounded-xl border border-border-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            {activeTab === 'column' && (
              <button
                type="button"
                onClick={handleSaveColumn}
                disabled={!url.trim()}
                className="px-4 py-2 text-xs font-bold text-accent-content bg-accent hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                <span>Save API Configuration</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
