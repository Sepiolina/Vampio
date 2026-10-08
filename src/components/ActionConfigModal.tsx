import React, { useState } from 'react';
import { ActionConfig, ActionHeaderItem, ColumnSpec } from '../types';
import { testActionEndpoint, formatActionPayload } from '../utils/actionDispatcher';
import { 
  X, 
  Send, 
  Sliders, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Play, 
  Webhook,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: ActionConfig;
  onSaveConfig: (updated: ActionConfig) => void;
  sampleColumns: ColumnSpec[];
}

export const ActionConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  sampleColumns
}) => {
  const [localConfig, setLocalConfig] = useState<ActionConfig>({ ...config });
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'test'>('general');
  const [testResult, setTestResult] = useState<{
    running: boolean;
    success?: boolean;
    message?: string;
    statusCode?: number;
    durationMs?: number;
    responseBody?: string;
  } | null>(null);

  if (!isOpen) return null;

  // Generate 1 mock row based on current columns for test payload preview
  const mockRow: Record<string, unknown> = {};
  if (sampleColumns && sampleColumns.length > 0) {
    sampleColumns.forEach((c) => {
      if (c.type === 'Int') mockRow[c.name] = 1042;
      else if (c.type === 'Float') mockRow[c.name] = 99.5;
      else if (c.type === 'Boolean') mockRow[c.name] = true;
      else if (c.type === 'UUID') mockRow[c.name] = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      else if (c.type === 'DateTime') mockRow[c.name] = new Date().toISOString();
      else mockRow[c.name] = `sample_${c.name.toLowerCase()}`;
    });
  } else {
    mockRow['id'] = 1;
    mockRow['name'] = 'Sample Record';
    mockRow['status'] = 'active';
  }

  const handleAddHeader = () => {
    const newHeader: ActionHeaderItem = {
      id: Date.now().toString(),
      key: '',
      value: '',
      enabled: true
    };
    setLocalConfig((prev) => ({
      ...prev,
      customHeaders: [...prev.customHeaders, newHeader]
    }));
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    setLocalConfig((prev) => ({
      ...prev,
      customHeaders: prev.customHeaders.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    }));
  };

  const handleRemoveHeader = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      customHeaders: prev.customHeaders.filter((h) => h.id !== id)
    }));
  };

  const handleRunTest = async () => {
    setTestResult({ running: true });
    const res = await testActionEndpoint(localConfig, mockRow);
    setTestResult({
      running: false,
      success: res.success,
      message: res.message,
      statusCode: res.statusCode,
      durationMs: res.durationMs,
      responseBody: res.responseBody
    });
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div 
        className="bg-primary border border-border-subtle rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border-subtle bg-secondary/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/20">
              <Webhook size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-content">
                Webhook &amp; API Delivery
              </h2>
              <p className="text-[11px] text-content-muted">
                Send generated records to a remote webhook or HTTP endpoint alongside file generation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-5 pt-2 border-b border-border-subtle bg-secondary/20 flex items-center gap-4 text-xs flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'general'
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <Send size={13} />
            <span>General</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`pb-2.5 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'advanced'
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <Sliders size={13} />
            <span>Advanced Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ml-auto ${
              activeTab === 'test'
                ? 'border-accent text-accent'
                : 'border-transparent text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Play size={13} />
            <span>Test Connection</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Enable / Disable Switch */}
              <div className="p-3.5 rounded-xl bg-secondary/50 border border-border-subtle flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-content">
                    Enable Webhook Add-on
                  </h4>
                  <p className="text-[11px] text-content-muted mt-0.5">
                    Transmit records to your endpoint while generating data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    localConfig.enabled ? 'bg-accent' : 'bg-tertiary border border-border-subtle'
                  }`}
                  role="switch"
                  aria-checked={localConfig.enabled}
                  title={localConfig.enabled ? 'Click to disable' : 'Click to enable'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      localConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Endpoint URL & Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-content block">
                  Webhook URL
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={localConfig.method}
                    onChange={(e) => setLocalConfig({ ...localConfig, method: e.target.value as any })}
                    className="h-8.5 px-2.5 rounded-lg bg-secondary border border-border-subtle font-mono font-bold text-accent text-xs focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                  <input
                    type="url"
                    value={localConfig.endpointUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, endpointUrl: e.target.value })}
                    placeholder="https://api.example.com/v1/webhook"
                    className="flex-1 h-8.5 px-3 rounded-lg bg-secondary border border-border-subtle font-mono text-content text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Delivery Mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-content block">
                  Delivery Mode
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLocalConfig({ ...localConfig, mode: 'per_entry' })}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                      localConfig.mode === 'per_entry'
                        ? 'bg-secondary border-accent text-accent shadow-xs'
                        : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">Per Record</span>
                      <ArrowRight size={13} className={localConfig.mode === 'per_entry' ? 'text-accent' : 'opacity-40'} />
                    </div>
                    <span className="text-[11px] text-content-muted">
                      Send each row individually as generated
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalConfig({ ...localConfig, mode: 'batch' })}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                      localConfig.mode === 'batch'
                        ? 'bg-secondary border-accent text-accent shadow-xs'
                        : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">Batch Chunk</span>
                      <Layers size={13} className={localConfig.mode === 'batch' ? 'text-accent' : 'opacity-40'} />
                    </div>
                    <span className="text-[11px] text-content-muted">
                      Send grouped in batches
                    </span>
                  </button>
                </div>
              </div>

              {/* Batch Settings (when batch mode selected) */}
              {localConfig.mode === 'batch' && (
                <div className="p-3 bg-secondary/30 rounded-xl border border-border-subtle grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-content-muted block">
                      Batch Size (rows per request)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      value={localConfig.batchSize}
                      onChange={(e) => setLocalConfig({ ...localConfig, batchSize: Math.max(1, Number(e.target.value)) })}
                      className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-content-muted block">
                      Payload Key <span className="opacity-60">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={localConfig.batchPayloadKey}
                      onChange={(e) => setLocalConfig({ ...localConfig, batchPayloadKey: e.target.value })}
                      placeholder="records (blank for root array)"
                      className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              {/* Authentication */}
              <div className="space-y-2 pt-1 border-t border-border-subtle/50">
                <label className="text-xs font-medium text-content block">
                  Authentication
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'bearer', 'api_key', 'basic'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, authType: type })}
                      className={`py-1.5 px-2 rounded-lg border text-center font-medium capitalize text-xs transition cursor-pointer ${
                        localConfig.authType === type
                          ? 'bg-secondary border-accent text-accent font-semibold shadow-xs'
                          : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content'
                      }`}
                    >
                      {type === 'api_key' ? 'API Key' : type === 'none' ? 'None' : type}
                    </button>
                  ))}
                </div>

                {localConfig.authType === 'bearer' && (
                  <div className="pt-1.5">
                    <input
                      type="password"
                      value={localConfig.authToken || ''}
                      onChange={(e) => setLocalConfig({ ...localConfig, authToken: e.target.value })}
                      placeholder="Bearer token..."
                      className="w-full h-8 px-3 rounded-lg bg-secondary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                {localConfig.authType === 'api_key' && (
                  <div className="grid grid-cols-2 gap-2 pt-1.5">
                    <input
                      type="text"
                      value={localConfig.apiKeyHeader || 'X-API-Key'}
                      onChange={(e) => setLocalConfig({ ...localConfig, apiKeyHeader: e.target.value })}
                      placeholder="Header Name (e.g. X-API-Key)"
                      className="h-8 px-2.5 rounded-lg bg-secondary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                    <input
                      type="password"
                      value={localConfig.apiKeyValue || ''}
                      onChange={(e) => setLocalConfig({ ...localConfig, apiKeyValue: e.target.value })}
                      placeholder="API Key value..."
                      className="h-8 px-2.5 rounded-lg bg-secondary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                {localConfig.authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-2 pt-1.5">
                    <input
                      type="text"
                      value={localConfig.basicUser || ''}
                      onChange={(e) => setLocalConfig({ ...localConfig, basicUser: e.target.value })}
                      placeholder="Username"
                      className="h-8 px-2.5 rounded-lg bg-secondary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                    <input
                      type="password"
                      value={localConfig.basicPass || ''}
                      onChange={(e) => setLocalConfig({ ...localConfig, basicPass: e.target.value })}
                      placeholder="Password"
                      className="h-8 px-2.5 rounded-lg bg-secondary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCED */}
          {activeTab === 'advanced' && (
            <div className="space-y-4">
              {/* Custom HTTP Headers */}
              <div className="p-3.5 bg-secondary/30 rounded-xl border border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-content">Custom HTTP Headers</h4>
                    <p className="text-[11px] text-content-muted">Add custom headers like tenant or routing keys</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="px-2 py-1 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus size={11} />
                    <span>Add</span>
                  </button>
                </div>

                {localConfig.customHeaders.length === 0 ? (
                  <p className="text-[11px] text-content-muted italic py-1">No custom headers configured</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {localConfig.customHeaders.map((header) => (
                      <div key={header.id} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={header.enabled}
                          onChange={(e) => handleUpdateHeader(header.id, 'enabled', e.target.checked)}
                          className="rounded border-border-subtle text-accent focus:ring-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={header.key}
                          onChange={(e) => handleUpdateHeader(header.id, 'key', e.target.value)}
                          placeholder="Header-Name"
                          className="flex-1 h-7 px-2 bg-primary border border-border-subtle rounded text-xs font-mono text-content focus:outline-none focus:border-accent"
                        />
                        <span className="text-content-muted font-mono">:</span>
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => handleUpdateHeader(header.id, 'value', e.target.value)}
                          placeholder="value"
                          className="flex-1 h-7 px-2 bg-primary border border-border-subtle rounded text-xs font-mono text-content focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(header.id)}
                          className="p-1 text-content-muted hover:text-rose-400 rounded transition cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Retry & Timing */}
              <div className="p-3.5 bg-secondary/30 rounded-xl border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-content">Auto-Retry on Error</h4>
                    <p className="text-[11px] text-content-muted">Retry on transient network drops or 5xx server errors</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localConfig.retryOnError}
                    onChange={(e) => setLocalConfig({ ...localConfig, retryOnError: e.target.checked })}
                    className="w-4 h-4 rounded text-accent focus:ring-0 cursor-pointer"
                  />
                </div>

                {localConfig.retryOnError && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-content-muted block">Max Retries</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={localConfig.maxRetries}
                        onChange={(e) => setLocalConfig({ ...localConfig, maxRetries: Number(e.target.value) })}
                        className="w-full h-7 px-2 bg-primary border border-border-subtle rounded font-mono text-xs text-content"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-content-muted block">Retry Delay (ms)</label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={localConfig.retryDelayMs}
                        onChange={(e) => setLocalConfig({ ...localConfig, retryDelayMs: Number(e.target.value) })}
                        className="w-full h-7 px-2 bg-primary border border-border-subtle rounded font-mono text-xs text-content"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border-subtle/40">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-content-muted block">Throttle Delay (ms)</label>
                    <input
                      type="number"
                      min="0"
                      step="25"
                      value={localConfig.throttleMs}
                      onChange={(e) => setLocalConfig({ ...localConfig, throttleMs: Number(e.target.value) })}
                      className="w-full h-7 px-2 bg-primary border border-border-subtle rounded font-mono text-xs text-content"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-content-muted block">Timeout (ms)</label>
                    <input
                      type="number"
                      min="1000"
                      step="500"
                      value={localConfig.timeoutMs}
                      onChange={(e) => setLocalConfig({ ...localConfig, timeoutMs: Number(e.target.value) })}
                      className="w-full h-7 px-2 bg-primary border border-border-subtle rounded font-mono text-xs text-content"
                    />
                  </div>
                </div>
              </div>

              {/* Conditional Trigger Filter */}
              <div className="p-3.5 bg-secondary/30 rounded-xl border border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-accent" />
                    <div>
                      <h4 className="font-semibold text-xs text-content">Conditional Row Filter</h4>
                      <p className="text-[11px] text-content-muted">Only dispatch rows matching a column rule</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localConfig.triggerCondition?.enabled ?? false}
                    onChange={(e) => setLocalConfig((prev) => ({
                      ...prev,
                      triggerCondition: {
                        ...prev.triggerCondition,
                        enabled: e.target.checked,
                        column: prev.triggerCondition?.column || (sampleColumns[0]?.name || 'error'),
                        operator: prev.triggerCondition?.operator || 'equals',
                        value: prev.triggerCondition?.value || '1'
                      }
                    }))}
                    className="w-4 h-4 rounded text-accent focus:ring-0 cursor-pointer"
                  />
                </div>

                {localConfig.triggerCondition?.enabled && (
                  <div className="grid grid-cols-12 gap-2 pt-1">
                    <select
                      value={localConfig.triggerCondition.column}
                      onChange={(e) => setLocalConfig((prev) => ({
                        ...prev,
                        triggerCondition: { ...prev.triggerCondition, column: e.target.value }
                      }))}
                      className="col-span-5 h-7 px-2 bg-primary rounded border border-border-subtle font-mono text-xs text-content"
                    >
                      {sampleColumns.length > 0 ? (
                        sampleColumns.map((c) => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))
                      ) : (
                        <option value="error">error</option>
                      )}
                    </select>

                    <select
                      value={localConfig.triggerCondition.operator}
                      onChange={(e) => setLocalConfig((prev) => ({
                        ...prev,
                        triggerCondition: { ...prev.triggerCondition, operator: e.target.value as any }
                      }))}
                      className="col-span-3 h-7 px-1.5 bg-primary rounded border border-border-subtle font-mono text-xs text-accent font-bold"
                    >
                      <option value="equals">=</option>
                      <option value="not_equals">!=</option>
                      <option value="contains">contains</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Value"
                      value={localConfig.triggerCondition.value}
                      onChange={(e) => setLocalConfig((prev) => ({
                        ...prev,
                        triggerCondition: { ...prev.triggerCondition, value: e.target.value }
                      }))}
                      className="col-span-4 h-7 px-2 bg-primary rounded border border-border-subtle font-mono text-xs text-content"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TEST & PREVIEW */}
          {activeTab === 'test' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-content">Connection Test &amp; Preview</h4>
                  <p className="text-[11px] text-content-muted">Send a test ping and inspect the payload format</p>
                </div>
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={testResult?.running}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {testResult?.running ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  <span>{testResult?.running ? 'Testing...' : 'Send Test Ping'}</span>
                </button>
              </div>

              {/* Ping Result Banner */}
              {testResult && !testResult.running && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {testResult.success ? (
                    <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center justify-between">
                      <span>{testResult.message}</span>
                      {testResult.durationMs !== undefined && (
                        <span className="font-mono text-[10px] opacity-80">{testResult.durationMs}ms</span>
                      )}
                    </div>
                    {testResult.responseBody && (
                      <pre className="mt-1.5 p-2 rounded bg-black/30 font-mono text-[10px] max-h-24 overflow-auto text-content-muted">
                        {testResult.responseBody}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Sample Payload Preview */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-content-muted">Sample JSON Payload</span>
                <pre className="p-3 rounded-xl bg-secondary/80 font-mono text-[11px] text-content max-h-48 overflow-auto border border-border-subtle">
                  {formatActionPayload(localConfig, [mockRow])}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border-subtle bg-secondary/40 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-content-muted hover:text-content hover:bg-tertiary transition text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white transition text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
