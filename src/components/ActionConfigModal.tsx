import React, { useState } from 'react';
import { ActionConfig, ActionHeaderItem, ColumnSpec } from '../types';
import { testActionEndpoint, formatActionPayload } from '../utils/actionDispatcher';
import { 
  X, 
  Send, 
  Key, 
  Sliders, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Code, 
  Play, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Filter,
  Sparkles
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
  const [activeTab, setActiveTab] = useState<'endpoint' | 'auth' | 'headers' | 'retry' | 'test'>('endpoint');
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
    mockRow['name'] = 'Alice Demo';
    mockRow['email'] = 'alice@example.com';
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div 
        className="bg-primary border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border-subtle bg-secondary/70 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/25">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-content flex items-center gap-2">
                <span>Action Dispatch Configuration</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-accent/20 text-accent">
                  REST / Webhook Egress
                </span>
              </h2>
              <p className="text-[11px] text-content-muted">
                Transmit generated synthetic records to remote HTTP endpoints or webhooks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="px-5 pt-2 border-b border-border-subtle bg-secondary/30 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('endpoint')}
            className={`pb-2 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'endpoint'
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <Send size={13} />
            <span>Endpoint &amp; Cadence</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`pb-2 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'auth'
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <Key size={13} />
            <span>Auth ({localConfig.authType})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`pb-2 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'headers'
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <Sliders size={13} />
            <span>Headers ({localConfig.customHeaders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('retry')}
            className={`pb-2 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'retry'
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <RotateCcw size={13} />
            <span>Retry &amp; Throttling</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`pb-2 px-1 font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer ml-auto ${
              activeTab === 'test'
                ? 'border-accent text-accent'
                : 'border-transparent text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Play size={13} />
            <span>Test Ping</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: ENDPOINT & CADENCE */}
          {activeTab === 'endpoint' && (
            <div className="space-y-4">
              {/* Master Enable/Disable Switch */}
              <div className="p-3 rounded-xl bg-secondary/60 border border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${localConfig.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-content-muted/40'}`} />
                  <div>
                    <h4 className="text-xs font-bold text-content flex items-center gap-2">
                      <span>Action Egress Pipeline</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        localConfig.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary text-content-muted'
                      }`}>
                        {localConfig.enabled ? 'ENABLED' : 'DISABLED (OFF BY DEFAULT)'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-content-muted">
                      Action is off by default to protect file synthesis performance with zero network calls.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    localConfig.enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                      : 'bg-primary border border-border-subtle text-content-muted hover:text-content'
                  }`}
                >
                  <span>{localConfig.enabled ? 'Enabled (ON)' : 'Disabled (OFF)'}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
                  Target Endpoint URL
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={localConfig.method}
                    onChange={(e) => setLocalConfig({ ...localConfig, method: e.target.value as any })}
                    className="h-8 px-2.5 rounded-lg bg-secondary border border-border-subtle font-mono font-bold text-accent focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                  <input
                    type="url"
                    value={localConfig.endpointUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, endpointUrl: e.target.value })}
                    placeholder="https://api.example.com/v1/records or webhook URL"
                    className="flex-1 h-8 px-3 rounded-lg bg-secondary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                  />
                </div>
                <p className="text-[10px] text-content-muted">
                  The destination endpoint will receive JSON payloads via HTTP {localConfig.method}.
                </p>
              </div>

              {/* Cadence Selection */}
              <div className="space-y-2 pt-2 border-t border-border-subtle/60">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
                  Trigger Cadence
                </label>
                <div className="grid grid-cols-2 gap-2">
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
                      <span className="font-bold text-xs">Every Row Complete</span>
                      <Zap size={14} />
                    </div>
                    <span className="text-[10px] text-content-muted">
                      Dispatches each generated record as an individual HTTP payload in real-time.
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
                      <span className="font-bold text-xs">Every X Rows (Batch Chunk)</span>
                      <Clock size={14} />
                    </div>
                    <span className="text-[10px] text-content-muted">
                      Aggregates multiple rows and dispatches every X records together in a single request.
                    </span>
                  </button>
                </div>
              </div>

              {/* Batch Settings */}
              {localConfig.mode === 'batch' && (
                <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Batch Size (X rows per request)
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
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Payload Wrapper Key
                      </label>
                      <input
                        type="text"
                        value={localConfig.batchPayloadKey}
                        onChange={(e) => setLocalConfig({ ...localConfig, batchPayloadKey: e.target.value })}
                        placeholder="records (or leave blank for root array)"
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Quick Chunk Size Chips */}
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-content-muted">Quick chunk presets:</span>
                    {[10, 50, 100, 500].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setLocalConfig({ ...localConfig, batchSize: size })}
                        className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                          localConfig.batchSize === size
                            ? 'bg-accent/20 border-accent text-accent font-bold'
                            : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                        }`}
                      >
                        {size} rows
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-content-muted">
                    {localConfig.batchPayloadKey.trim()
                      ? `Payload sent as { "${localConfig.batchPayloadKey.trim()}": [...rows], meta: {...} }`
                      : 'Payload sent directly as root JSON array [...rows]'}
                  </p>
                </div>
              )}

              {/* Conditional Trigger Filter Rules (e.g. only when column error = 1) */}
              <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-accent" />
                    <div>
                      <h4 className="text-xs font-bold text-content">Conditional Trigger Filter</h4>
                      <p className="text-[10px] text-content-muted">Only dispatch rows matching a specific column value (e.g. error = 1)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocalConfig((prev) => ({
                      ...prev,
                      triggerCondition: {
                        ...prev.triggerCondition,
                        enabled: !prev.triggerCondition?.enabled,
                        column: prev.triggerCondition?.column || (sampleColumns[0]?.name || 'error'),
                        operator: prev.triggerCondition?.operator || 'equals',
                        value: prev.triggerCondition?.value || '1'
                      }
                    }))}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border transition cursor-pointer ${
                      localConfig.triggerCondition?.enabled
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-primary border border-border-subtle text-content-muted hover:text-content'
                    }`}
                  >
                    {localConfig.triggerCondition?.enabled ? 'FILTER ACTIVE' : 'ENABLE FILTER'}
                  </button>
                </div>

                {localConfig.triggerCondition?.enabled && (
                  <div className="p-2.5 rounded-lg bg-primary border border-accent/30 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 space-y-1">
                        <label className="text-[9px] uppercase font-bold text-content-muted block">Column</label>
                        <select
                          value={localConfig.triggerCondition.column}
                          onChange={(e) => setLocalConfig((prev) => ({
                            ...prev,
                            triggerCondition: { ...prev.triggerCondition, column: e.target.value }
                          }))}
                          className="w-full h-8 px-2 bg-secondary rounded-lg border border-border-subtle font-mono text-xs text-content focus:outline-none focus:border-accent"
                        >
                          {sampleColumns.length > 0 ? (
                            sampleColumns.map((c) => (
                              <option key={c.id || c.name} value={c.name}>
                                {c.name} ({c.type})
                              </option>
                            ))
                          ) : (
                            <option value="error">error</option>
                          )}
                        </select>
                      </div>

                      <div className="col-span-3 space-y-1">
                        <label className="text-[9px] uppercase font-bold text-content-muted block">Condition</label>
                        <select
                          value={localConfig.triggerCondition.operator}
                          onChange={(e) => setLocalConfig((prev) => ({
                            ...prev,
                            triggerCondition: { ...prev.triggerCondition, operator: e.target.value as any }
                          }))}
                          className="w-full h-8 px-2 bg-secondary rounded-lg border border-border-subtle font-mono text-xs text-accent font-bold focus:outline-none"
                        >
                          <option value="equals">= (Equals)</option>
                          <option value="not_equals">!= (Not Equals)</option>
                          <option value="greater_than">&gt; (Greater Than)</option>
                          <option value="less_than">&lt; (Less Than)</option>
                          <option value="contains">contains</option>
                        </select>
                      </div>

                      <div className="col-span-4 space-y-1">
                        <label className="text-[9px] uppercase font-bold text-content-muted block">Target Value</label>
                        <input
                          type="text"
                          placeholder='e.g. 1, "active", true'
                          value={localConfig.triggerCondition.value}
                          onChange={(e) => setLocalConfig((prev) => ({
                            ...prev,
                            triggerCondition: { ...prev.triggerCondition, value: e.target.value }
                          }))}
                          className="w-full h-8 px-2.5 bg-secondary rounded-lg border border-border-subtle font-mono text-xs text-content focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border-subtle/50 text-[10px]">
                      <span className="text-content-muted">Quick presets:</span>
                      <button
                        type="button"
                        onClick={() => setLocalConfig((prev) => ({
                          ...prev,
                          triggerCondition: {
                            enabled: true,
                            column: sampleColumns.some(c => c.name === 'error') ? 'error' : (sampleColumns[0]?.name || 'error'),
                            operator: 'equals',
                            value: '1'
                          }
                        }))}
                        className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle font-mono text-accent transition cursor-pointer"
                      >
                        error = 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocalConfig((prev) => ({
                          ...prev,
                          triggerCondition: {
                            enabled: true,
                            column: sampleColumns.some(c => c.name === 'status') ? 'status' : (sampleColumns[0]?.name || 'status'),
                            operator: 'equals',
                            value: 'failed'
                          }
                        }))}
                        className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle font-mono text-accent transition cursor-pointer"
                      >
                        status = &quot;failed&quot;
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocalConfig((prev) => ({
                          ...prev,
                          triggerCondition: {
                            enabled: true,
                            column: sampleColumns.some(c => c.name === 'error') ? 'error' : (sampleColumns[0]?.name || 'error'),
                            operator: 'equals',
                            value: 'true'
                          }
                        }))}
                        className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle font-mono text-accent transition cursor-pointer"
                      >
                        error = true
                      </button>
                    </div>

                    <p className="text-[10px] text-accent/90 font-mono">
                      🎯 Example: Dispatches only records where <strong>{localConfig.triggerCondition.column || 'column'}</strong> {localConfig.triggerCondition.operator === 'equals' ? '=' : localConfig.triggerCondition.operator} <strong>&quot;{localConfig.triggerCondition.value || '1'}&quot;</strong>. Other rows are skipped.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUTHENTICATION */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
                  Authentication Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'bearer', 'api_key', 'basic'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, authType: type })}
                      className={`py-2 px-2 rounded-lg border text-center font-bold capitalize transition cursor-pointer ${
                        localConfig.authType === type
                          ? 'bg-secondary border-accent text-accent shadow-xs'
                          : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content'
                      }`}
                    >
                      {type === 'api_key' ? 'API Key' : type}
                    </button>
                  ))}
                </div>
              </div>

              {localConfig.authType === 'bearer' && (
                <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-2">
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                    Bearer Token
                  </label>
                  <input
                    type="password"
                    value={localConfig.authToken || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, authToken: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-8 px-3 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-content-muted">
                    Automatically attached as <code className="text-accent font-mono">Authorization: Bearer &lt;token&gt;</code>
                  </p>
                </div>
              )}

              {localConfig.authType === 'api_key' && (
                <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Header Name
                      </label>
                      <input
                        type="text"
                        value={localConfig.apiKeyHeader || 'X-API-Key'}
                        onChange={(e) => setLocalConfig({ ...localConfig, apiKeyHeader: e.target.value })}
                        placeholder="X-API-Key"
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        API Key Value
                      </label>
                      <input
                        type="password"
                        value={localConfig.apiKeyValue || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, apiKeyValue: e.target.value })}
                        placeholder="key_secret_..."
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {localConfig.authType === 'basic' && (
                <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Username
                      </label>
                      <input
                        type="text"
                        value={localConfig.basicUser || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, basicUser: e.target.value })}
                        placeholder="user"
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Password
                      </label>
                      <input
                        type="password"
                        value={localConfig.basicPass || ''}
                        onChange={(e) => setLocalConfig({ ...localConfig, basicPass: e.target.value })}
                        placeholder="password"
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-content-muted">
                    Base64-encoded and sent via standard <code className="text-accent font-mono">Authorization: Basic</code>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM HEADERS */}
          {activeTab === 'headers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
                    HTTP Request Headers
                  </label>
                  <p className="text-[10px] text-content-muted">
                    Add custom headers like tenant IDs, correlation keys, or routing tags
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="px-2.5 py-1 rounded-lg bg-accent text-white font-semibold text-xs flex items-center gap-1 shadow-2xs hover:bg-accent-hover transition cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add Header</span>
                </button>
              </div>

              {localConfig.customHeaders.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border-subtle rounded-xl text-content-muted">
                  <Sliders size={20} className="mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No custom headers configured</p>
                  <p className="text-[10px] mt-0.5">Content-Type is automatically set to application/json</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {localConfig.customHeaders.map((header) => (
                    <div key={header.id} className="flex items-center gap-2 bg-secondary/50 p-2 rounded-lg border border-border-subtle">
                      <input
                        type="checkbox"
                        checked={header.enabled}
                        onChange={(e) => handleUpdateHeader(header.id, 'enabled', e.target.checked)}
                        className="rounded border-border-subtle text-accent focus:ring-0 cursor-pointer"
                        title="Enable/disable header"
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
                        title="Remove header"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RETRY & THROTTLING */}
          {activeTab === 'retry' && (
            <div className="space-y-4">
              {/* Auto Retry */}
              <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-content block">
                      Auto-Retry Failed Dispatches
                    </label>
                    <p className="text-[10px] text-content-muted">
                      Automatically retry on network failures, 5xx server errors, or 429 rate limits
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localConfig.retryOnError}
                    onChange={(e) => setLocalConfig({ ...localConfig, retryOnError: e.target.checked })}
                    className="w-4 h-4 rounded text-accent focus:ring-0 cursor-pointer"
                  />
                </div>

                {localConfig.retryOnError && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-subtle/50">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Max Retry Attempts
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={localConfig.maxRetries}
                        onChange={(e) => setLocalConfig({ ...localConfig, maxRetries: Number(e.target.value) })}
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                        Base Backoff Delay (ms)
                      </label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={localConfig.retryDelayMs}
                        onChange={(e) => setLocalConfig({ ...localConfig, retryDelayMs: Number(e.target.value) })}
                        className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Rate Limit Throttle & Timeout */}
              <div className="p-3 bg-secondary/40 rounded-xl border border-border-subtle space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                      Throttle Delay (ms between requests)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={localConfig.throttleMs}
                      onChange={(e) => setLocalConfig({ ...localConfig, throttleMs: Number(e.target.value) })}
                      className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none"
                    />
                    <p className="text-[9px] text-content-muted">Prevents overwhelming endpoint rate limits</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
                      Per-Request Timeout (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="500"
                      value={localConfig.timeoutMs}
                      onChange={(e) => setLocalConfig({ ...localConfig, timeoutMs: Number(e.target.value) })}
                      className="w-full h-8 px-2.5 rounded-lg bg-primary border border-border-subtle font-mono text-content focus:outline-none"
                    />
                    <p className="text-[9px] text-content-muted">Aborts request if no response received</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                  <div>
                    <label className="text-xs font-bold text-content block">
                      Pause Generation on Unrecoverable Error
                    </label>
                    <p className="text-[10px] text-content-muted">
                      Stops the batch if all retries fail, instead of skipping to the next chunk
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localConfig.stopOnError}
                    onChange={(e) => setLocalConfig({ ...localConfig, stopOnError: e.target.checked })}
                    className="w-4 h-4 rounded text-accent focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TEST PING & PAYLOAD PREVIEW */}
          {activeTab === 'test' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
                    Payload Preview &amp; Dry Run
                  </label>
                  <p className="text-[10px] text-content-muted">
                    Preview the formatted JSON payload and test connection to your remote endpoint
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={testResult?.running}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-60"
                >
                  <Play size={12} className={testResult?.running ? 'animate-spin' : ''} />
                  <span>{testResult?.running ? 'Sending Ping...' : 'Send Test Ping'}</span>
                </button>
              </div>

              {/* Test Result Banner */}
              {testResult && !testResult.running && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-150 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {testResult.success ? <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold flex items-center justify-between">
                      <span>{testResult.message}</span>
                      {testResult.durationMs !== undefined && (
                        <span className="font-mono text-[10px] opacity-80">{testResult.durationMs}ms</span>
                      )}
                    </div>
                    {testResult.responseBody && (
                      <pre className="mt-1.5 p-2 rounded bg-black/40 font-mono text-[10px] max-h-24 overflow-auto text-content-muted">
                        {testResult.responseBody}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* JSON Payload preview */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-content-muted uppercase">Sample Request Body</span>
                <pre className="p-3 rounded-xl bg-secondary font-mono text-[11px] text-content max-h-48 overflow-auto border border-border-subtle">
                  {formatActionPayload(localConfig, [mockRow])}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border-subtle bg-secondary/50 flex items-center justify-between flex-shrink-0">
          <div className="text-[11px] text-content-muted flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Direct In-Browser Dispatch · Zero Cloud Intermediary</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border-subtle text-content-muted hover:text-content hover:bg-tertiary transition text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white transition text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>Apply Action Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
