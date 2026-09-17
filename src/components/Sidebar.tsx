import React from 'react';
import { ExportFormat, OutputDestination, GeneratorStats } from '../types';
import { formatBytes } from '../utils/export';
import { 
  Download, 
  Radio, 
  FolderCheck, 
  HardDrive, 
  Play, 
  Square, 
  RefreshCw, 
  Zap, 
  FileText, 
  Database,
  Sliders,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  mode: 'Batch' | 'Continuous';
  setMode: (mode: 'Batch' | 'Continuous') => void;
  outputDestination: OutputDestination;
  setOutputDestination: (dest: OutputDestination) => void;
  selectedFolderName: string | null;
  onSelectFolder: () => void;
  onClearFolder: () => void;
  filename: string;
  setFilename: (f: string) => void;
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  tableName: string;
  setTableName: (t: string) => void;
  count: number;
  setCount: (c: number) => void;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  isStreaming: boolean;
  isGeneratingBatch: boolean;
  batchProgress: number;
  stats: GeneratorStats;
  statusMessage: string;
  totalColumns: number;
  onStart: () => void;
  onStop: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  mode,
  setMode,
  outputDestination,
  setOutputDestination,
  selectedFolderName,
  onSelectFolder,
  onClearFolder,
  filename,
  setFilename,
  format,
  setFormat,
  tableName,
  setTableName,
  count,
  setCount,
  intervalMs,
  setIntervalMs,
  isStreaming,
  isGeneratingBatch,
  batchProgress,
  stats,
  statusMessage,
  totalColumns,
  onStart,
  onStop
}) => {
  const quickCounts = [500, 1000, 5000, 25000, 100000];

  if (!isOpen) {
    return (
      <aside className="w-12 border-l border-border-subtle bg-secondary flex flex-col items-center py-4 gap-4 flex-shrink-0 transition-all z-20">
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle text-content-muted hover:text-accent transition shadow-xs"
          title="Open Generation Deck"
        >
          <Sliders size={16} />
        </button>

        {/* Vertical mode badge */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider -rotate-90 origin-center py-3">
            {mode}
          </span>
          {isStreaming && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </div>

        {/* Floating Start button shortcut in collapsed mode */}
        <div className="mt-auto">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="p-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md transition"
              title="Stop Stream"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isGeneratingBatch || totalColumns === 0}
              onClick={onStart}
              className="p-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white shadow-md disabled:opacity-40 transition"
              title="Generate"
            >
              {isGeneratingBatch ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Zap size={14} className="fill-current" />
              )}
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 sm:w-88 border-l border-border-subtle bg-secondary flex flex-col h-full flex-shrink-0 overflow-y-auto transition-all z-20 shadow-lg">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-secondary sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-accent" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-content">
            Generation Deck
          </h3>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded-md text-content-muted hover:text-content hover:bg-tertiary transition"
          title="Collapse Panel"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Section 1: Execution Mode (Batch vs Continuous) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-content uppercase tracking-wider">
            Execution Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-primary p-1 rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => setMode('Batch')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                mode === 'Batch'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-content-muted hover:text-content hover:bg-tertiary/50'
              }`}
            >
              <Download size={12} />
              <span>Batch File</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('Continuous')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                mode === 'Continuous'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-content-muted hover:text-content hover:bg-tertiary/50'
              }`}
            >
              <Radio size={12} className={isStreaming ? 'animate-pulse text-emerald-300' : ''} />
              <span>Stream Live</span>
            </button>
          </div>
        </div>

        {/* Section 2: Output Destination */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-content uppercase tracking-wider flex items-center justify-between">
            <span>Destination</span>
            <span className="text-[10px] text-content-muted lowercase font-normal">
              {outputDestination === 'folder' ? 'direct disk write' : 'browser download'}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-primary p-1 rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => setOutputDestination('download')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                outputDestination === 'download'
                  ? 'bg-accent text-white font-semibold shadow-xs'
                  : 'text-content-muted hover:text-content'
              }`}
            >
              <Download size={11} />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOutputDestination('folder');
                if (!selectedFolderName) {
                  onSelectFolder();
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                outputDestination === 'folder'
                  ? 'bg-accent text-white font-semibold shadow-xs'
                  : 'text-content-muted hover:text-content'
              }`}
            >
              <FolderCheck size={11} />
              <span>Local Folder</span>
            </button>
          </div>

          {/* Connected Folder Card */}
          {outputDestination === 'folder' && (
            <div className="p-2.5 rounded-lg bg-primary border border-accent/30 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-content-muted uppercase font-bold">
                  Target Folder
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">FS Access API</span>
              </div>
              <div className="font-mono text-accent font-bold truncate">
                {selectedFolderName ? `📁 /${selectedFolderName}` : 'No folder selected'}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onSelectFolder}
                  className="flex-1 py-1 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-semibold text-content transition"
                >
                  {selectedFolderName ? 'Change Directory' : 'Choose Directory'}
                </button>
                {selectedFolderName && (
                  <button
                    type="button"
                    onClick={onClearFolder}
                    className="px-2 py-1 text-rose-400 hover:text-rose-300 text-[11px] rounded bg-secondary border border-border-subtle transition"
                    title="Disconnect Folder"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: File & Format Config */}
        <div className="space-y-2 p-3 bg-primary rounded-xl border border-border-subtle">
          <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
            File Specification
          </label>
          
          <div className="space-y-1.5">
            <span className="text-[10px] text-content-muted block font-medium">Filename & Extension:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="synthetic_dataset"
                className="flex-1 px-2.5 py-1.5 bg-secondary border border-border-subtle rounded-md text-xs font-mono font-bold text-content focus:outline-none focus:border-accent"
              />
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="bg-secondary px-2.5 py-1.5 text-xs text-accent font-mono font-bold rounded-md border border-border-subtle focus:outline-none cursor-pointer"
              >
                <option value="csv">.csv</option>
                <option value="jsonl">.jsonl</option>
                <option value="json">.json</option>
                <option value="sql">.sql</option>
                <option value="tsv">.tsv</option>
              </select>
            </div>
          </div>

          {format === 'sql' && (
            <div className="space-y-1 pt-1 border-t border-border-subtle/50">
              <span className="text-[10px] text-content-muted block font-medium">SQL Table Name:</span>
              <div className="flex items-center gap-1.5">
                <Database size={12} className="text-accent flex-shrink-0" />
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="table_name"
                  className="w-full px-2 py-1 bg-secondary border border-border-subtle rounded-md text-xs font-mono text-content focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Parameters (Count or Interval) */}
        <div className="space-y-2 p-3 bg-primary rounded-xl border border-border-subtle">
          {mode === 'Batch' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider">
                  Target Row Count
                </label>
                <span className="text-xs font-mono font-bold text-accent">
                  {count.toLocaleString()} rows
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="500000"
                step="500"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(500000, Number(e.target.value) || 1)))}
                className="w-full px-2.5 py-1.5 bg-secondary border border-border-subtle rounded-md text-xs font-mono font-bold text-content focus:outline-none focus:border-accent text-right"
              />
              <div className="flex items-center gap-1 pt-1">
                {quickCounts.map((qc) => (
                  <button
                    key={qc}
                    type="button"
                    onClick={() => setCount(qc)}
                    className={`flex-1 py-1 text-[10px] font-mono rounded transition ${
                      count === qc
                        ? 'bg-accent text-white font-bold'
                        : 'bg-secondary text-content-muted hover:text-content hover:bg-tertiary border border-border-subtle'
                    }`}
                  >
                    {qc >= 1000 ? `${qc / 1000}k` : qc}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider">
                  Streaming Cadence
                </label>
                <span className="text-xs font-mono font-bold text-accent">
                  ~{Math.round(1000 / intervalMs)} rows/sec
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="20"
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))}
                  className="flex-1 accent-accent cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-content w-16 text-right">
                  {intervalMs}ms
                </span>
              </div>
            </>
          )}
        </div>

        {/* Section 5: Primary Action Button */}
        <div className="space-y-2 pt-1">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/25 active:scale-98"
            >
              <Square size={13} fill="currentColor" />
              <span>Stop Continuous Stream</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isGeneratingBatch || totalColumns === 0}
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-accent/25 active:scale-98"
            >
              {isGeneratingBatch ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Generating {batchProgress}%...</span>
                </>
              ) : mode === 'Batch' ? (
                <>
                  <Zap size={13} className="fill-current" />
                  <span>
                    {outputDestination === 'folder'
                      ? 'Generate to Folder'
                      : `Generate (${count >= 1000 ? `${count / 1000}k` : count})`}
                  </span>
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  <span>Start Streaming Live</span>
                </>
              )}
            </button>
          )}

          {/* Batch Progress Bar */}
          {isGeneratingBatch && (
            <div className="w-full bg-primary h-1.5 rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-accent transition-all duration-150"
                style={{ width: `${batchProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Section 6: Telemetry & Metrics */}
        <div className="p-3 bg-primary rounded-xl border border-border-subtle space-y-2">
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">
            Engine Telemetry
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">Generated</span>
              <span className="font-bold text-content">{stats.rowsGenerated.toLocaleString()}</span>
            </div>
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">Speed</span>
              <span className="font-bold text-accent">
                {stats.rowsPerSec > 0 ? `${stats.rowsPerSec.toLocaleString()}/s` : '—'}
              </span>
            </div>
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">Elapsed</span>
              <span className="font-bold text-content">
                {stats.elapsedSeconds > 0 ? `${stats.elapsedSeconds}s` : '0.0s'}
              </span>
            </div>
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">Size</span>
              <span className="font-bold text-content">
                {stats.fileSizeBytes > 0 ? formatBytes(stats.fileSizeBytes) : '0 B'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Ticker */}
        <div className="p-2.5 rounded-lg bg-primary/70 border border-border-subtle text-[11px] font-mono text-content-muted flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${
              isStreaming
                ? 'bg-emerald-400 animate-ping'
                : isGeneratingBatch
                ? 'bg-amber-400 animate-spin'
                : 'bg-emerald-500'
            }`}
          />
          <span className="truncate">{statusMessage}</span>
        </div>
      </div>
    </aside>
  );
};
