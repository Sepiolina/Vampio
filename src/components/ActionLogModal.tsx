import React, { useState } from 'react';
import { ActionDispatchLog, ActionStats, ActionConfig, ColumnSpec } from '../types';
import { formatDataset } from '../utils/export';
import { downloadFile } from '../utils/export';
import { 
  X, 
  Trash2, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Zap,
  Filter,
  Layers,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: ActionDispatchLog[];
  stats: ActionStats;
  config: ActionConfig;
  columns: ColumnSpec[];
  onClearLogs: () => void;
  onRetryFailedRecords?: (records: Record<string, unknown>[]) => void;
}

export const ActionLogModal: React.FC<Props> = ({
  isOpen,
  onClose,
  logs,
  stats,
  config,
  columns,
  onClearLogs,
  onRetryFailedRecords
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'dead_letter'>('logs');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'retrying'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredLogs = logs.filter((log) => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  const handleExportFailedJson = () => {
    if (!stats.failedRecords || stats.failedRecords.length === 0) return;
    const jsonStr = JSON.stringify(stats.failedRecords, null, 2);
    downloadFile(jsonStr, `dead_letter_records_${Date.now()}.json`, 'application/json');
  };

  const handleExportFailedCsv = () => {
    if (!stats.failedRecords || stats.failedRecords.length === 0) return;
    const cols = columns.length > 0 
      ? columns 
      : Object.keys(stats.failedRecords[0] || {}).map((k) => ({
          id: k,
          name: k,
          type: 'String' as const
        }));
    const csvContent = formatDataset(cols, stats.failedRecords, 'csv');
    downloadFile(csvContent, `dead_letter_records_${Date.now()}.csv`, 'text/csv');
  };

  const handleReDispatch = async () => {
    if (!onRetryFailedRecords || stats.failedRecords.length === 0) return;
    setRetrying(true);
    try {
      await onRetryFailedRecords(stats.failedRecords);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl bg-primary border border-border-subtle rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between bg-secondary/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
              <Zap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-content tracking-wide">
                  Action Dispatch Logs & Dead-Letter Queue
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                  {config.method} {config.mode === 'per_entry' ? 'Streaming' : `Batched (${config.batchSize}/req)`}
                </span>
              </div>
              <p className="text-[11px] text-content-muted font-mono truncate max-w-md">
                Target: {config.endpointUrl || 'No endpoint specified'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="px-2.5 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Clear all logs"
              >
                <Trash2 size={13} />
                <span>Clear Logs</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-secondary/40 border-b border-border-subtle flex-shrink-0">
          <div className="p-2.5 rounded-xl bg-primary border border-border-subtle">
            <div className="text-[10px] uppercase font-bold tracking-wider text-content-muted">Total Dispatched</div>
            <div className="text-lg font-mono font-bold text-content mt-0.5">
              {stats.totalDispatched.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-primary border border-border-subtle">
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Delivered (2xx)</div>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              {stats.successCount.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-primary border border-border-subtle">
            <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Retries</div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-0.5 flex items-center gap-1.5">
              <RotateCcw size={16} />
              {stats.retryCount.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-primary border border-border-subtle">
            <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400">Dead-Letter / Failed</div>
            <div className="text-lg font-mono font-bold text-rose-400 mt-0.5 flex items-center gap-1.5">
              <AlertTriangle size={16} />
              {stats.failedRecords.length.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-primary border border-border-subtle col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-content-muted">Avg Response</div>
            <div className="text-lg font-mono font-bold text-accent mt-0.5 flex items-center gap-1.5">
              <Clock size={16} />
              {stats.avgLatencyMs ? `${stats.avgLatencyMs}ms` : '--'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Filter Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-primary text-accent shadow-xs border border-border-subtle'
                  : 'text-content-muted hover:text-content'
              }`}
            >
              <Send size={13} />
              <span>Request Log ({logs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dead_letter')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'dead_letter'
                  ? 'bg-primary text-rose-400 shadow-xs border border-border-subtle'
                  : 'text-content-muted hover:text-content'
              }`}
            >
              <AlertTriangle size={13} />
              <span>Dead-Letter Queue ({stats.failedRecords.length})</span>
            </button>
          </div>

          {activeTab === 'logs' && (
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-content-muted" />
              {(['all', 'success', 'error', 'retrying'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                    statusFilter === filter
                      ? 'bg-accent/20 text-accent border border-accent/40'
                      : 'text-content-muted hover:text-content hover:bg-tertiary'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab Content: Logs View */}
        {activeTab === 'logs' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-14 text-content-muted">
                <Send size={36} className="mx-auto mb-2 opacity-30 text-accent" />
                <p className="text-sm font-bold text-content">No dispatch logs recorded yet</p>
                <p className="text-xs text-content-muted mt-1 max-w-sm mx-auto">
                  When you generate data with Action destination selected, outgoing HTTP requests, status codes, and payloads will appear here in real time.
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const isSuccess = log.status === 'success';
                const isError = log.status === 'error';
                const isRetrying = log.status === 'retrying';

                return (
                  <div
                    key={log.id}
                    className={`rounded-xl border transition overflow-hidden ${
                      isSuccess
                        ? 'border-border-subtle bg-secondary/50 hover:bg-secondary/70'
                        : isError
                        ? 'border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10'
                        : 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'
                    }`}
                  >
                    {/* Log Header Row */}
                    <div
                      className="p-3 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown size={15} className="text-content-muted" />
                        ) : (
                          <ChevronRight size={15} className="text-content-muted" />
                        )}

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isError
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {log.statusCode ? `HTTP ${log.statusCode}` : log.status.toUpperCase()}
                        </span>

                        <span className="text-xs font-mono font-bold text-content">
                          Batch #{log.batchIndex + 1}
                        </span>

                        <span className="text-xs text-content-muted">
                          ({log.rowCount.toLocaleString()} {log.rowCount === 1 ? 'row' : 'rows'})
                        </span>

                        {log.retryAttempt && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                            Attempt #{log.retryAttempt}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-content-muted">
                        <span>{log.durationMs}ms</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-border-subtle/50 space-y-3 bg-primary/40">
                        {log.errorMessage && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                            <strong>Error:</strong> {log.errorMessage}
                          </div>
                        )}

                        {/* Request Payload Preview */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1">
                            <span>Request Payload ({log.rowCount} records)</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(log.payloadPreview, `req-${log.id}`)}
                              className="text-[10px] text-accent hover:underline flex items-center gap-1 font-mono lowercase"
                            >
                              {copiedId === `req-${log.id}` ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedId === `req-${log.id}` ? 'Copied' : 'Copy Payload'}</span>
                            </button>
                          </div>
                          <pre className="p-2.5 rounded-lg bg-secondary text-[11px] font-mono text-content overflow-x-auto max-h-48 border border-border-subtle">
                            {log.payloadPreview}
                          </pre>
                        </div>

                        {/* Response Body Preview */}
                        {log.responsePreview && (
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1">
                              <span>Response Body</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(log.responsePreview || '', `res-${log.id}`)}
                                className="text-[10px] text-accent hover:underline flex items-center gap-1 font-mono lowercase"
                              >
                                {copiedId === `res-${log.id}` ? <Check size={11} /> : <Copy size={11} />}
                                <span>{copiedId === `res-${log.id}` ? 'Copied' : 'Copy Response'}</span>
                              </button>
                            </div>
                            <pre className="p-2.5 rounded-lg bg-secondary text-[11px] font-mono text-content-muted overflow-x-auto max-h-36 border border-border-subtle">
                              {log.responsePreview}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Content: Dead-Letter Queue View */}
        {activeTab === 'dead_letter' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {stats.failedRecords.length === 0 ? (
              <div className="text-center py-14 text-content-muted">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-400 opacity-80" />
                <p className="text-sm font-bold text-content">Dead-Letter Queue is Empty</p>
                <p className="text-xs text-content-muted mt-1 max-w-sm mx-auto">
                  All dispatched records were successfully acknowledged by your endpoint or retried cleanly.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-rose-300">
                        {stats.failedRecords.length.toLocaleString()} Failed Records in Dead-Letter Queue
                      </div>
                      <div className="text-[11px] text-rose-200/70">
                        These synthetic records exhausted all retry attempts and were withheld from dropping silently.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportFailedJson}
                      className="px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content flex items-center gap-1.5 transition"
                    >
                      <FileCode size={13} className="text-accent" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportFailedCsv}
                      className="px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content flex items-center gap-1.5 transition"
                    >
                      <FileSpreadsheet size={13} className="text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    {onRetryFailedRecords && (
                      <button
                        type="button"
                        onClick={handleReDispatch}
                        disabled={retrying}
                        className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
                        <span>Re-Dispatch All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dead Letter Records Preview */}
                <div className="border border-border-subtle rounded-xl overflow-hidden bg-primary">
                  <div className="px-3 py-2 bg-secondary border-b border-border-subtle flex items-center justify-between text-xs font-bold text-content">
                    <span>Failed Records Sample (First 20 of {stats.failedRecords.length})</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(stats.failedRecords, null, 2), 'dlq-all')}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 font-mono font-normal"
                    >
                      {copiedId === 'dlq-all' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedId === 'dlq-all' ? 'Copied' : 'Copy All JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-content overflow-x-auto max-h-96">
                    {JSON.stringify(stats.failedRecords.slice(0, 20), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle bg-secondary/80 flex items-center justify-between flex-shrink-0">
          <div className="text-[11px] text-content-muted">
            Auto-retry policy: {config.retryOnError ? `Enabled (Max ${config.maxRetries} retries)` : 'Disabled'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
