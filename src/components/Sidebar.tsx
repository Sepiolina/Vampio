import React from 'react';
import { 
  ExportFormat, 
  OutputDestination, 
  GeneratorStats, 
  OutputStrategy, 
  MultiFileConfig, 
  ImportedFileContext,
  AppendConfig 
} from '../types';
import { formatBytes } from '../utils/export';
import { AnimatedTabs } from './AnimatedTabs';
import { useI18n } from '../i18n';
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
  X,
  Files,
  Archive,
  ArrowDownCircle,
  FileSpreadsheet,
  Upload,
  Layers,
  FileUp,
  CheckCircle2,
  Check,
  Table,
  SlidersHorizontal,
  FilePlus,
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  mode: 'Batch' | 'Continuous';
  setMode: (mode: 'Batch' | 'Continuous') => void;
  outputDestination: OutputDestination;
  setOutputDestination: (dest: OutputDestination) => void;
  outputStrategy: OutputStrategy;
  setOutputStrategy: (strat: OutputStrategy) => void;
  multiFileConfig: MultiFileConfig;
  setMultiFileConfig: React.Dispatch<React.SetStateAction<MultiFileConfig>>;
  appendConfig: AppendConfig;
  setAppendConfig: React.Dispatch<React.SetStateAction<AppendConfig>>;
  importedContext: ImportedFileContext | null;
  onClearImportedContext?: () => void;
  onSetImportedContext?: (ctx: ImportedFileContext) => void;
  onAttachAppendFile: (file: File) => Promise<void>;
  onOpenOfflineExtractor?: () => void;
  onOpenFolderMonitor?: () => void;
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
  outputStrategy,
  setOutputStrategy,
  multiFileConfig,
  setMultiFileConfig,
  appendConfig,
  setAppendConfig,
  importedContext,
  onClearImportedContext,
  onSetImportedContext,
  onAttachAppendFile,
  onOpenOfflineExtractor,
  onOpenFolderMonitor,
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
  const { t } = useI18n();
  const quickCounts = [500, 1000, 5000, 25000, 100000];
  const appendFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDraggingOverAppend, setIsDraggingOverAppend] = React.useState(false);
  const [appendAttachTab, setAppendAttachTab] = React.useState<'upload' | 'spec'>('upload');
  const [manualTargetFilename, setManualTargetFilename] = React.useState('existing_dataset.csv');
  const [manualTargetFormat, setManualTargetFormat] = React.useState<ExportFormat>('csv');
  const [manualExistingRows, setManualExistingRows] = React.useState<number>(5000);

  const handleAppendFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAttachAppendFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleAppendDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverAppend(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onAttachAppendFile(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) {
    return (
      <aside className="w-12 border-l border-border-subtle bg-secondary flex flex-col items-center py-4 gap-4 flex-shrink-0 transition-all z-20">
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle text-content-muted hover:text-accent transition shadow-xs"
          title={t('sidebar.title')}
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
              title={t('sidebar.stopContinuousStream')}
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isGeneratingBatch || totalColumns === 0}
              onClick={onStart}
              className="p-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white shadow-md disabled:opacity-40 transition"
              title={t('sidebar.generateBatch')}
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
            {t('sidebar.title')}
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
            {t('sidebar.executionMode')}
          </label>
          <AnimatedTabs
            tabs={[
              { id: 'Batch', label: t('sidebar.batchFile'), icon: <Download size={12} /> },
              {
                id: 'Continuous',
                label: t('sidebar.streamLive'),
                icon: <Radio size={12} className={isStreaming ? 'animate-pulse text-emerald-300' : ''} />
              }
            ]}
            activeTab={mode}
            onChange={(m) => setMode(m as 'Batch' | 'Continuous')}
            layoutId="sidebar-execution-mode"
            fullWidth
            size="sm"
          />
        </div>

        {/* Section 2: Output Destination */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-content uppercase tracking-wider flex items-center justify-between">
            <span>{t('sidebar.destination')}</span>
            <span className="text-[10px] text-content-muted lowercase font-normal">
              {outputDestination === 'folder' ? t('sidebar.directDiskWrite') : t('sidebar.browserDownload')}
            </span>
          </label>
          <AnimatedTabs
            tabs={[
              { id: 'download', label: t('sidebar.download'), icon: <Download size={11} /> },
              { id: 'folder', label: t('sidebar.localFolder'), icon: <FolderCheck size={11} /> }
            ]}
            activeTab={outputDestination}
            onChange={(dest) => {
              const d = dest as OutputDestination;
              setOutputDestination(d);
              if (d === 'folder' && !selectedFolderName) {
                onSelectFolder();
              }
            }}
            layoutId="sidebar-output-destination"
            fullWidth
            size="sm"
          />

          {/* Connected Folder Card */}
          {outputDestination === 'folder' && (
            <div className="p-2.5 rounded-lg bg-primary border border-accent/30 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-content-muted uppercase font-bold">
                  {t('sidebar.targetFolder')}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">FS Access API</span>
              </div>
              <div className="font-mono text-accent font-bold truncate">
                {selectedFolderName ? `📁 /${selectedFolderName}` : t('sidebar.noFolderSelected')}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onSelectFolder}
                  className="flex-1 py-1 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-semibold text-content transition"
                >
                  {selectedFolderName ? t('sidebar.changeDirectory') : t('sidebar.chooseDirectory')}
                </button>
                {selectedFolderName && (
                  <button
                    type="button"
                    onClick={onClearFolder}
                    className="px-2 py-1 text-rose-400 hover:text-rose-300 text-[11px] rounded bg-secondary border border-border-subtle transition"
                    title="Disconnect Folder"
                  >
                    {t('sidebar.reset')}
                  </button>
                )}
              </div>

              {onOpenFolderMonitor && (
                <button
                  type="button"
                  onClick={onOpenFolderMonitor}
                  className="w-full py-1.5 px-2 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent font-semibold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Monitor folder behaviors & auto-suggest mode and template (100% offline)"
                >
                  <Sparkles size={12} />
                  <span>Analyze Folder &amp; Suggest Mode</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section 2.5: Output Strategy (Single File vs Multi-File vs In-Place Append) */}
        <div className="space-y-2 p-3 bg-primary rounded-xl border border-border-subtle">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
              Output Strategy
            </label>
            <div className="flex items-center gap-2">
              {onOpenFolderMonitor && (
                <button
                  type="button"
                  onClick={onOpenFolderMonitor}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  title="Auto-detect strategy from locked folder"
                >
                  <Sparkles size={10} />
                  <span>Smart Detect</span>
                </button>
              )}
              {importedContext ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono text-[9px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Target Attached
                </span>
              ) : (
                <span className="text-[10px] text-content-muted font-mono">
                  {outputStrategy === 'single' ? 'Single output' : outputStrategy === 'multi_file' ? 'Partitioned' : 'In-Place append'}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setOutputStrategy('single')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition ${
                outputStrategy === 'single'
                  ? 'bg-secondary border-accent text-accent shadow-xs'
                  : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content hover:bg-secondary/70'
              }`}
            >
              <FileText size={15} className="mb-1" />
              <span className="text-[11px] font-bold leading-tight">Single File</span>
              <span className="text-[9px] text-content-muted mt-0.5 opacity-80">Fresh output</span>
            </button>

            <button
              type="button"
              onClick={() => setOutputStrategy('multi_file')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition ${
                outputStrategy === 'multi_file'
                  ? 'bg-secondary border-accent text-accent shadow-xs'
                  : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content hover:bg-secondary/70'
              }`}
            >
              <Files size={15} className="mb-1" />
              <span className="text-[11px] font-bold leading-tight">Multi-File</span>
              <span className="text-[9px] text-content-muted mt-0.5 opacity-80">1/row or chunks</span>
            </button>

            <button
              type="button"
              onClick={() => setOutputStrategy('append_existing')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition relative ${
                outputStrategy === 'append_existing'
                  ? 'bg-secondary border-emerald-500/80 text-emerald-400 shadow-xs'
                  : 'bg-secondary/40 border-border-subtle text-content-muted hover:text-content hover:bg-secondary/70'
              }`}
            >
              {importedContext && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-primary" />
              )}
              <ArrowDownCircle size={15} className={`mb-1 ${outputStrategy === 'append_existing' ? 'text-emerald-400' : ''}`} />
              <span className="text-[11px] font-bold leading-tight">In-Place Append</span>
              <span className="text-[9px] text-content-muted mt-0.5 opacity-80">Continue file</span>
            </button>
          </div>
        </div>

        {/* Section 3: Context-Adaptive Strategy Configuration */}
        {outputStrategy === 'single' && (
          <div className="space-y-2 p-3 bg-primary rounded-xl border border-border-subtle">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-content uppercase tracking-wider block">
                {t('sidebar.fileSpec')}
              </label>
              <span className="text-[10px] text-content-muted font-mono">Row #1 start</span>
            </div>
            
            <div className="space-y-1.5">
              <span className="text-[10px] text-content-muted block font-medium">{t('sidebar.filenameExtension')}:</span>
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
                  className="bg-secondary px-2 py-1.5 text-xs text-accent font-mono font-bold rounded-md border border-border-subtle focus:outline-none cursor-pointer"
                >
                  <option value="xlsx">.xlsx (Excel)</option>
                  <option value="xls">.xls (Excel 97)</option>
                  <option value="csv">.csv</option>
                  <option value="tsv">.tsv</option>
                  <option value="json">.json</option>
                  <option value="jsonl">.jsonl</option>
                  <option value="txt">.txt (Log)</option>
                  <option value="xml">.xml</option>
                  <option value="sql">.sql</option>
                </select>
              </div>
            </div>

            {format === 'sql' && (
              <div className="space-y-1 pt-1 border-t border-border-subtle/50">
                <span className="text-[10px] text-content-muted block font-medium">{t('sidebar.sqlTableName')}:</span>
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
        )}

        {outputStrategy === 'multi_file' && (
          <div className="space-y-2.5 p-3 bg-primary rounded-xl border border-accent/30">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <Files size={13} />
                Multi-File Partitioning
              </label>
              <span className="text-[10px] text-accent font-mono font-bold">
                {Math.ceil(count / Math.max(1, multiFileConfig.rowsPerFile))} files
              </span>
            </div>

            {/* Rows Per File Selector */}
            <div className="p-2 rounded-lg bg-secondary border border-border-subtle space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-content uppercase">Rows Per File:</span>
                <div className="flex items-center gap-1">
                  {[1, 10, 100, 1000].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMultiFileConfig((prev) => ({ ...prev, rowsPerFile: num }))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                        multiFileConfig.rowsPerFile === num
                          ? 'bg-accent/20 border-accent/50 text-accent'
                          : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                      }`}
                    >
                      {num === 1 ? '1 (Log)' : num}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={multiFileConfig.rowsPerFile}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setMultiFileConfig((prev) => ({ ...prev, rowsPerFile: val }));
                    }}
                    className="w-12 px-1 py-0.5 rounded bg-primary border border-border-subtle text-center font-mono text-[10px] text-content focus:outline-none"
                    title="Custom Rows per file"
                  />
                </div>
              </div>
              <p className="text-[9px] text-content-muted">
                {multiFileConfig.rowsPerFile === 1 
                  ? 'Each generated row creates a separate file (ideal for log event feeds or individual JSON documents).'
                  : `Generates chunks of ${multiFileConfig.rowsPerFile} records per file.`}
              </p>
            </div>

            {/* Base Filename & Format */}
            <div className="space-y-1">
              <span className="text-[10px] text-content-muted block font-medium">Base Name & Format:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="event_log"
                  className="flex-1 px-2.5 py-1.5 bg-secondary border border-border-subtle rounded-md text-xs font-mono font-bold text-content focus:outline-none focus:border-accent"
                />
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  className="bg-secondary px-2 py-1.5 text-xs text-accent font-mono font-bold rounded-md border border-border-subtle focus:outline-none cursor-pointer"
                >
                  <option value="json">.json</option>
                  <option value="jsonl">.jsonl</option>
                  <option value="txt">.txt</option>
                  <option value="csv">.csv</option>
                  <option value="tsv">.tsv</option>
                  <option value="xml">.xml</option>
                  <option value="sql">.sql</option>
                  <option value="xlsx">.xlsx</option>
                  <option value="xls">.xls</option>
                </select>
              </div>
            </div>

            {/* Naming Template Pattern */}
            <div className="space-y-1">
              <span className="text-[10px] text-content-muted block font-medium">Pattern Template:</span>
              <input
                type="text"
                value={multiFileConfig.filenamePattern}
                onChange={(e) => setMultiFileConfig((prev) => ({ ...prev, filenamePattern: e.target.value }))}
                placeholder="{filename}_{index}.{ext}"
                className="w-full px-2 py-1 bg-secondary border border-border-subtle rounded text-[11px] font-mono text-content focus:outline-none"
              />
              <span className="text-[9px] text-content-muted block font-mono">
                Sample: {filename}_00001.{format}
              </span>
            </div>

            {/* Packaging Delivery Notice */}
            <div className="p-2 rounded bg-secondary border border-border-subtle text-[10px] text-content-muted flex items-start gap-1.5">
              <Archive size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                {outputDestination === 'folder'
                  ? 'All files will be streamed directly into your connected folder directory.'
                  : 'Files will be packaged and compressed into a single .zip download archive.'}
              </span>
            </div>
          </div>
        )}

        {outputStrategy === 'append_existing' && (
          <div className="space-y-2.5 p-3 bg-primary rounded-xl border border-emerald-500/40">
            {/* Hidden target file input */}
            <input
              type="file"
              ref={appendFileInputRef}
              onChange={handleAppendFileSelected}
              accept=".xlsx,.xls,.csv,.tsv,.json,.jsonl,.ndjson,.xml,.txt"
              className="hidden"
            />

            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownCircle size={14} />
                In-Place Append Configuration
              </label>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                {importedContext ? 'File Linked' : 'No File Linked'}
              </span>
            </div>

            {/* Target File Card or Dropzone */}
            {importedContext ? (
              <div className="p-2.5 rounded-lg bg-secondary border border-emerald-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono text-[10px] uppercase">
                      {importedContext.format}
                    </span>
                    <span className="font-mono text-content font-bold truncate text-[11px]" title={importedContext.filename}>
                      {importedContext.filename}
                    </span>
                  </div>
                  {onClearImportedContext && (
                    <button
                      type="button"
                      onClick={onClearImportedContext}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-medium px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition"
                      title="Detach and return to clean single-file mode"
                    >
                      Detach
                    </button>
                  )}
                </div>

                {/* Projection Calculator Card */}
                <div className="p-2 rounded-lg bg-primary/90 border border-emerald-500/20 space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-content-muted text-[10px]">
                    <span>Existing Data:</span>
                    <span className="text-content font-bold">{importedContext.totalRows.toLocaleString()} rows</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400 text-[10px]">
                    <span>Appending Chunk:</span>
                    <span className="font-bold">+{count.toLocaleString()} rows</span>
                  </div>
                  <div className="flex items-center justify-between text-content border-t border-border-subtle/50 pt-1 font-bold">
                    <span>Projected Total:</span>
                    <span className="text-emerald-300">{(importedContext.totalRows + count).toLocaleString()} rows</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-content-muted pt-0.5">
                    <span>Continuous Range:</span>
                    <span className="text-accent">
                      #{importedContext.totalRows + 1} → #{importedContext.totalRows + count}
                    </span>
                  </div>
                </div>

                {/* Quick actions for file */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-border-subtle/50">
                  <button
                    type="button"
                    onClick={() => appendFileInputRef.current?.click()}
                    className="flex-1 py-1 px-2 rounded bg-primary hover:bg-tertiary border border-border-subtle text-[10px] font-semibold text-content transition flex items-center justify-center gap-1"
                  >
                    <FileUp size={11} className="text-accent" />
                    <span>Change File</span>
                  </button>
                  {onOpenOfflineExtractor && (
                    <button
                      type="button"
                      onClick={onOpenOfflineExtractor}
                      className="py-1 px-2 rounded bg-primary hover:bg-tertiary border border-border-subtle text-[10px] font-semibold text-accent transition flex items-center gap-1"
                      title="Inspect or sync column architecture"
                    >
                      <Table size={11} />
                      <span>Sync Columns</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Switcher: Upload File vs Manual Target Spec */}
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-secondary border border-border-subtle text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setAppendAttachTab('upload')}
                    className={`py-1 rounded transition text-center ${
                      appendAttachTab === 'upload'
                        ? 'bg-primary text-emerald-400 shadow-2xs font-bold'
                        : 'text-content-muted hover:text-content'
                    }`}
                  >
                    Upload / Drop File
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppendAttachTab('spec')}
                    className={`py-1 rounded transition text-center ${
                      appendAttachTab === 'spec'
                        ? 'bg-primary text-emerald-400 shadow-2xs font-bold'
                        : 'text-content-muted hover:text-content'
                    }`}
                  >
                    Manual Target Spec
                  </button>
                </div>

                {appendAttachTab === 'upload' ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOverAppend(true); }}
                    onDragLeave={() => setIsDraggingOverAppend(false)}
                    onDrop={handleAppendDrop}
                    onClick={() => appendFileInputRef.current?.click()}
                    className={`p-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition flex flex-col items-center justify-center gap-1.5 ${
                      isDraggingOverAppend
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-emerald-500/30 bg-secondary/50 hover:bg-secondary hover:border-emerald-500/60'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                      <Upload size={15} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-content block">Drop target file to append here</span>
                      <span className="text-[10px] text-content-muted">or click to browse (.xlsx, .csv, .jsonl, .txt, .xml)</span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400/80 mt-0.5">
                      100% Client-Side • In-Memory Analysis
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-secondary border border-emerald-500/20 space-y-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-content-muted uppercase">Target Filename:</label>
                      <input
                        type="text"
                        value={manualTargetFilename}
                        onChange={(e) => setManualTargetFilename(e.target.value)}
                        placeholder="existing_dataset.csv"
                        className="w-full px-2 py-1 bg-primary border border-border-subtle rounded text-xs font-mono font-bold text-content focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-content-muted uppercase">Target Format:</label>
                        <select
                          value={manualTargetFormat}
                          onChange={(e) => setManualTargetFormat(e.target.value as ExportFormat)}
                          className="w-full bg-primary px-2 py-1 text-xs text-emerald-400 font-mono font-bold rounded border border-border-subtle focus:outline-none cursor-pointer"
                        >
                          <option value="csv">.csv (Delimited)</option>
                          <option value="tsv">.tsv (Tab Delimited)</option>
                          <option value="xlsx">.xlsx (Excel)</option>
                          <option value="jsonl">.jsonl (NDJSON)</option>
                          <option value="txt">.txt (Text / Log)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-content-muted uppercase">Existing Rows Offset:</label>
                        <input
                          type="number"
                          min="0"
                          value={manualExistingRows}
                          onChange={(e) => setManualExistingRows(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full px-2 py-1 bg-primary border border-border-subtle rounded text-xs font-mono font-bold text-content focus:outline-none focus:border-emerald-400 text-right"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSetImportedContext) {
                          onSetImportedContext({
                            filename: manualTargetFilename,
                            format: manualTargetFormat,
                            totalRows: manualExistingRows,
                            startingRowNumber: manualExistingRows + 1,
                            headers: [],
                          });
                          setFormat(manualTargetFormat);
                        }
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Check size={12} />
                      <span>Bind Target Specification</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sequence & Continuity Configuration */}
            <div className="p-2.5 rounded-lg bg-secondary border border-border-subtle space-y-2 text-xs">
              <label className="text-[10px] font-bold text-content uppercase tracking-wider flex items-center justify-between">
                <span>Row Sequence & Autoincrements</span>
                <SlidersHorizontal size={11} className="text-content-muted" />
              </label>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={appendConfig.autoContinueSequence}
                  onChange={(e) => setAppendConfig((prev) => ({ ...prev, autoContinueSequence: e.target.checked }))}
                  className="mt-0.5 accent-emerald-500 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-content block">Auto-continue continuous sequence</span>
                  <span className="text-[10px] text-content-muted block leading-relaxed">
                    {appendConfig.autoContinueSequence
                      ? `Row index and autoincrements will continue seamlessly from row #${importedContext ? importedContext.totalRows + 1 : 1}.`
                      : 'Disabled: Specify manual starting row index offset below.'}
                  </span>
                </div>
              </label>

              {!appendConfig.autoContinueSequence && (
                <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-[11px]">
                  <span className="text-content-muted">Manual Start Row #:</span>
                  <input
                    type="number"
                    min="1"
                    value={appendConfig.manualStartOffset || 1}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setAppendConfig((prev) => ({ ...prev, manualStartOffset: val }));
                    }}
                    className="w-20 px-2 py-0.5 rounded bg-primary border border-border-subtle text-right font-mono font-bold text-content focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Excel Sheet Placement (Only for Excel workbooks) */}
            {(format === 'xlsx' || format === 'xls') && (
              <div className="p-2.5 rounded-lg bg-secondary border border-border-subtle space-y-2 text-xs">
                <label className="text-[10px] font-bold text-content uppercase tracking-wider flex items-center justify-between">
                  <span>Excel Worksheet Target</span>
                  <FileSpreadsheet size={12} className="text-emerald-400" />
                </label>

                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setAppendConfig((prev) => ({ ...prev, excelSheetMode: 'active_sheet' }))}
                    className={`py-1 px-2 rounded text-[11px] font-semibold border transition ${
                      appendConfig.excelSheetMode === 'active_sheet'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                    }`}
                  >
                    Append to Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppendConfig((prev) => ({ ...prev, excelSheetMode: 'new_sheet' }))}
                    className={`py-1 px-2 rounded text-[11px] font-semibold border transition ${
                      appendConfig.excelSheetMode === 'new_sheet'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                    }`}
                  >
                    New Sheet
                  </button>
                </div>

                {appendConfig.excelSheetMode === 'active_sheet' ? (
                  <div className="space-y-1">
                    <span className="text-[10px] text-content-muted block">Select Existing Sheet:</span>
                    {importedContext?.sheetNames && importedContext.sheetNames.length > 0 ? (
                      <select
                        value={appendConfig.targetSheetName || importedContext.targetSheetName || importedContext.sheetNames[0]}
                        onChange={(e) => setAppendConfig((prev) => ({ ...prev, targetSheetName: e.target.value }))}
                        className="w-full px-2 py-1 rounded bg-primary border border-border-subtle text-xs font-mono text-content focus:outline-none"
                      >
                        {importedContext.sheetNames.map((sn) => (
                          <option key={sn} value={sn}>{sn}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={appendConfig.targetSheetName || 'Sheet1'}
                        onChange={(e) => setAppendConfig((prev) => ({ ...prev, targetSheetName: e.target.value }))}
                        placeholder="Sheet1"
                        className="w-full px-2 py-1 rounded bg-primary border border-border-subtle text-xs font-mono text-content focus:outline-none"
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-[10px] text-content-muted block">New Worksheet Name:</span>
                    <input
                      type="text"
                      value={appendConfig.newSheetName || 'Appended_Data'}
                      onChange={(e) => setAppendConfig((prev) => ({ ...prev, newSheetName: e.target.value }))}
                      placeholder="Appended_Data"
                      className="w-full px-2 py-1 rounded bg-primary border border-border-subtle text-xs font-mono text-content focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Header Safety (For delimited & text formats) */}
            {format !== 'xlsx' && format !== 'xls' && (
              <div className="p-2.5 rounded-lg bg-secondary border border-border-subtle text-xs">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={appendConfig.skipDuplicateHeaders}
                    onChange={(e) => setAppendConfig((prev) => ({ ...prev, skipDuplicateHeaders: e.target.checked }))}
                    className="mt-0.5 accent-emerald-500 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-content block">Skip duplicate header line</span>
                    <span className="text-[10px] text-content-muted block">
                      Appends continuous data rows without inserting repeated column header names midway.
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Save Delivery & Versioning Policy */}
            <div className="p-2.5 rounded-lg bg-secondary border border-border-subtle space-y-2 text-xs">
              <label className="text-[10px] font-bold text-content uppercase tracking-wider block">
                Save & Versioning Policy
              </label>

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setAppendConfig((prev) => ({ ...prev, saveMode: 'overwrite' }))}
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold border transition text-center ${
                    appendConfig.saveMode === 'overwrite'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                  }`}
                >
                  Direct Overwrite
                </button>
                <button
                  type="button"
                  onClick={() => setAppendConfig((prev) => ({ ...prev, saveMode: 'suffix' }))}
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold border transition text-center ${
                    appendConfig.saveMode === 'suffix'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                  }`}
                >
                  Save as Copy
                </button>
              </div>

              {appendConfig.saveMode === 'suffix' && (
                <div className="space-y-1">
                  <span className="text-[10px] text-content-muted block">Filename Suffix:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={appendConfig.suffix || 'appended'}
                      onChange={(e) => setAppendConfig((prev) => ({ ...prev, suffix: e.target.value }))}
                      placeholder="appended"
                      className="w-full px-2 py-1 bg-primary border border-border-subtle rounded text-xs font-mono text-content focus:outline-none"
                    />
                  </div>
                  {importedContext && (
                    <span className="text-[9px] text-content-muted font-mono block">
                      Target: {importedContext.filename.replace(/\.[^/.]+$/, '')}_{appendConfig.suffix || 'appended'}.{format}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 4: Parameters (Count or Interval) */}
        <div className="space-y-2 p-3 bg-primary rounded-xl border border-border-subtle">
          {mode === 'Batch' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider">
                  {t('sidebar.targetRowCount')}
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
              <div className="pt-1">
                <AnimatedTabs
                  tabs={quickCounts.map((qc) => ({
                    id: String(qc),
                    label: qc >= 1000 ? `${qc / 1000}k` : String(qc),
                  }))}
                  activeTab={String(count)}
                  onChange={(val) => setCount(Number(val))}
                  layoutId="sidebar-quick-row-counts"
                  size="xs"
                  fullWidth
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-content uppercase tracking-wider">
                  {t('sidebar.streamingCadence')}
                </label>
                <span className="text-xs font-mono font-bold text-accent">
                  ~{Math.round(1000 / intervalMs)} {t('sidebar.rowsSec')}
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
              <span>{t('sidebar.stopContinuousStream')}</span>
            </button>
          ) : outputStrategy === 'append_existing' && !importedContext ? (
            <button
              type="button"
              onClick={() => appendFileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/25 active:scale-98"
            >
              <Upload size={13} />
              <span>Attach Target File to Append</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isGeneratingBatch || totalColumns === 0}
              onClick={onStart}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg active:scale-98 disabled:opacity-50 ${
                outputStrategy === 'append_existing'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
                  : 'bg-accent hover:bg-accent-hover shadow-accent/25'
              }`}
            >
              {isGeneratingBatch ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>{t('sidebar.generating')} {batchProgress}%...</span>
                </>
              ) : mode === 'Batch' ? (
                outputStrategy === 'append_existing' && importedContext ? (
                  <>
                    <ArrowDownCircle size={14} className="text-emerald-300 flex-shrink-0" />
                    <span className="truncate">
                      Append +{count.toLocaleString()} Rows to {importedContext.filename}
                    </span>
                  </>
                ) : outputStrategy === 'multi_file' ? (
                  <>
                    <Files size={13} className="fill-current flex-shrink-0" />
                    <span>
                      Generate {Math.ceil(count / Math.max(1, multiFileConfig.rowsPerFile))} Files ({count >= 1000 ? `${count / 1000}k` : count} rows)
                    </span>
                  </>
                ) : (
                  <>
                    <Zap size={13} className="fill-current flex-shrink-0" />
                    <span>
                      {outputDestination === 'folder'
                        ? t('sidebar.generateToFolder')
                        : `${t('sidebar.generateBatch')} (${count >= 1000 ? `${count / 1000}k` : count})`}
                    </span>
                  </>
                )
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  <span>{t('sidebar.startStreamingLive')}</span>
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
            {t('sidebar.engineTelemetry')}
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">{t('sidebar.generated')}</span>
              <span className="font-bold text-content">{stats.rowsGenerated.toLocaleString()}</span>
            </div>
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">{t('sidebar.speed')}</span>
              <span className="font-bold text-accent">
                {stats.rowsPerSec > 0 ? `${stats.rowsPerSec.toLocaleString()}/s` : '—'}
              </span>
            </div>
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">{t('sidebar.elapsed')}</span>
              <span className="font-bold text-content">
                {stats.elapsedSeconds > 0 ? `${stats.elapsedSeconds}s` : '0.0s'}
              </span>
            </div>
            <div className="bg-secondary p-2 rounded-lg border border-border-subtle/50">
              <span className="text-[10px] text-content-muted block">{t('sidebar.size')}</span>
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
