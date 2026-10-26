import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderLock,
  Upload,
  FileText,
  X,
  Sparkles,
  HardDrive,
  FileSpreadsheet,
  Terminal,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AnimatedTabs } from './AnimatedTabs';
import { ColumnSpec, ExportFormat, OutputStrategy } from '../types';
import {
  formatFileSize,
} from '../utils/folderBehaviorAnalyzer';
import { getSimulationFormat } from '../utils/profileExports';
import { useFolderMonitor } from '../hooks/useFolderMonitor';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { ProfileExportControls } from './folderMonitor/ProfileExportControls';
import { FolderMonitorRecommendationsTab } from './folderMonitor/FolderMonitorRecommendationsTab';
import { FolderMonitorMetricsTab } from './folderMonitor/FolderMonitorMetricsTab';
import { FolderMonitorSchemaTab } from './folderMonitor/FolderMonitorSchemaTab';
import { FolderMonitorEventsTab } from './folderMonitor/FolderMonitorEventsTab';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDirectoryHandle: any | null;
  currentFolderName: string | null;
  onSelectLockedFolder: (dirHandle: any, folderName: string) => void;
  onApplyRecommendations: (recommendations: {
    strategy: OutputStrategy;
    format: ExportFormat;
    destination: 'folder';
    filename: string;
    filenamePattern?: string;
    rowsPerFile?: number;
    targetFile?: string;
    columns: ColumnSpec[];
    tableName: string;
    batchCount?: number;
    intervalMs?: number;
    generationMode?: 'Batch' | 'Continuous';
  }) => void;
  currentStrategy: OutputStrategy;
  currentFormat: ExportFormat;
  currentColumnsCount: number;
  currentColumns?: ColumnSpec[];
}

type MonitorTab = 'recommendations' | 'metrics' | 'schema' | 'live_events';

export const FolderMonitorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentDirectoryHandle,
  currentFolderName,
  onSelectLockedFolder,
  onApplyRecommendations,
  currentStrategy,
  currentFormat,
  currentColumns,
}) => {
  const [activeTab, setActiveTab] = useState<MonitorTab>('recommendations');
  const [hasApplied, setHasApplied] = useState(false);

  const monitor = useFolderMonitor({
    isOpen,
    initialDirectoryHandle: currentDirectoryHandle,
    initialFolderName: currentFolderName,
    onSelectLockedFolder,
    currentColumns,
  });

  const dialogRef = useModalAccessibility(isOpen, onClose);
  useEffect(() => setHasApplied(false), [isOpen, monitor.folderHandle]);

  const selectFiles = () => { void monitor.filePicker.selectFiles().catch(() => {}); };
  const selectFolderSnapshot = () => { void monitor.filePicker.selectFolder({ allowFallback: true }).catch(() => {}); };

  // One-click apply handlers
  const handleApplyAll = () => {
    if (!monitor.analysis || monitor.analysis.extractedColumns.length === 0) return;
    onApplyRecommendations({
      strategy: monitor.analysis.suggestedMode.outputStrategy,
      format: getSimulationFormat(monitor.analysis),
      destination: 'folder',
      filename: monitor.analysis.suggestedMode.suggestedFilename,
      filenamePattern: monitor.analysis.suggestedMode.suggestedFilenamePattern,
      rowsPerFile: monitor.analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: monitor.analysis.suggestedMode.suggestedTargetFile,
      columns: monitor.analysis.suggestedTemplate.columns,
      tableName: monitor.analysis.suggestedTemplate.tableName,
      batchCount: monitor.analysis.suggestedMode.suggestedBatchCount || 1000,
      intervalMs: monitor.analysis.suggestedMode.suggestedIntervalMs || 150,
      generationMode: monitor.analysis.suggestedMode.suggestedGenerationMode,
    });
    setHasApplied(true);
    setTimeout(() => onClose(), 800);
  };

  const handleApplyModeOnly = () => {
    if (!monitor.analysis || monitor.analysis.extractedColumns.length === 0) return;
    onApplyRecommendations({
      strategy: monitor.analysis.suggestedMode.outputStrategy,
      format: getSimulationFormat(monitor.analysis),
      destination: 'folder',
      filename: monitor.analysis.suggestedMode.suggestedFilename,
      filenamePattern: monitor.analysis.suggestedMode.suggestedFilenamePattern,
      rowsPerFile: monitor.analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: monitor.analysis.suggestedMode.suggestedTargetFile,
      columns: [],
      tableName: monitor.analysis.suggestedTemplate.tableName,
      batchCount: monitor.analysis.suggestedMode.suggestedBatchCount || 1000,
      intervalMs: monitor.analysis.suggestedMode.suggestedIntervalMs || 150,
      generationMode: monitor.analysis.suggestedMode.suggestedGenerationMode,
    });
    setHasApplied(true);
    setTimeout(() => onClose(), 800);
  };

  const handleApplyTemplateOnly = () => {
    if (!monitor.analysis || monitor.analysis.extractedColumns.length === 0) return;
    onApplyRecommendations({
      strategy: currentStrategy,
      format: currentFormat,
      destination: 'folder',
      filename: monitor.analysis.suggestedTemplate.tableName,
      columns: monitor.analysis.suggestedTemplate.columns,
      tableName: monitor.analysis.suggestedTemplate.tableName,
      batchCount: monitor.analysis.suggestedMode.suggestedBatchCount || 1000,
      intervalMs: monitor.analysis.suggestedMode.suggestedIntervalMs || 150,
      generationMode: 'Batch',
    });
    setHasApplied(true);
    setTimeout(() => onClose(), 800);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm -z-10"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0.1 }}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-monitor-title"
            tabIndex={-1}
            {...monitor.filePicker.dragProps}
            className="bg-primary border border-border-subtle rounded-2xl min-w-0 w-full max-w-4xl h-[90dvh] max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden relative"
          >
            {/* Drag & Drop Visual Overlay */}
            {monitor.filePicker.isDraggingOver && (
              <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs border-2 border-dashed border-accent rounded-2xl flex flex-col items-center justify-center gap-3 p-6 pointer-events-none transition-all">
                <div className="h-16 w-16 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg animate-bounce">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-white">Drop Target Folder Here</h3>
                  <p className="text-xs text-white/80 mt-1 max-w-xs">
                    Inspect local files and infer schemas. Uploaded selections are snapshots; choose a directory for live refresh.
                  </p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="shrink-0 flex items-start justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-border-subtle bg-secondary">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <FolderLock size={18} style={{ color: '#ffffff' }} className="text-white" />
                </div>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 id="folder-monitor-title" className="text-sm font-bold text-content">
                      Target Folder Behavior Monitor
                    </h2>
                    <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
                      <ShieldCheck size={12} />
                      100% Local File Analysis
                    </span>
                  </div>
                  <p className="text-xs text-content-muted">
                    Observes local file patterns &amp; automatically suggests set mode &amp; templates
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-content-muted hover:text-content hover:bg-tertiary rounded-lg transition cursor-pointer"
                  title="Close"
                  aria-label="Close folder monitor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div data-monitor-scroll className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain">
            {/* Folder Target Status Strip */}
            <div className="shrink-0 px-4 sm:px-5 py-2.5 bg-secondary/70 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0 max-w-full">
                <div className="flex items-center gap-1.5 font-mono text-content font-bold truncate">
                  <Folder size={14} className="text-accent flex-shrink-0" />
                  <span className="truncate">
                    {monitor.folderName ? `/${monitor.folderName}` : 'No source selected'}
                  </span>
                </div>

                {monitor.discoveredFiles.length > 0 && (
                  <span className="text-[11px] font-mono text-content-muted">
                    {monitor.discoveredFiles.length} files · {formatFileSize(monitor.analysis?.metrics.totalSizeBytes || 0)}
                  </span>
                )}

                {monitor.sourceKind !== 'none' && (
                  <span role="status" className="text-[10px] text-content-muted font-mono">
                    {monitor.isLoading ? 'Scanning…' : monitor.error ? 'Scan failed' : monitor.sourceKind === 'snapshot' ? 'SNAPSHOT · no live refresh' : monitor.isLiveMonitoring ? 'LIVE · every 3 seconds' : 'PAUSED'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={monitor.handlePickDirectory}
                  disabled={monitor.isLoading}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent text-white hover:bg-accent-hover text-[11px] font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <FolderLock size={12} />
                  <span>{monitor.sourceKind !== 'none' ? 'Change Source' : 'Select Target Folder'}</span>
                </button>

                <button
                  type="button"
                  onClick={selectFolderSnapshot}
                  disabled={monitor.isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                  title="Select directory via local folder picker"
                >
                  <Upload size={12} className="text-content-muted" />
                  <span>Upload Folder</span>
                </button>

                <button
                  type="button"
                  onClick={selectFiles}
                  disabled={monitor.isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                  title="Select batch of files"
                >
                  <FileText size={12} className="text-content-muted" />
                  <span>Batch Files</span>
                </button>

                {monitor.canPoll && (
                  <button
                    type="button"
                    onClick={() => void monitor.refresh()}
                    disabled={monitor.isLoading}
                    className="p-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content transition cursor-pointer flex items-center gap-1 px-2 text-[11px]"
                    title="Scan folder now"
                  >
                    <RefreshCw size={12} className={monitor.isLoading ? 'animate-spin text-accent' : ''} />
                    <span>Scan</span>
                  </button>
                )}
              </div>
            </div>

            {monitor.error && <div role="alert" className="px-5 py-2 text-xs text-rose-400 bg-rose-500/10 break-words">{monitor.error}</div>}
            {monitor.lastScanAt && <p className="px-5 py-1 text-[11px] text-content-muted">Last scan: {new Date(monitor.lastScanAt).toLocaleString()}</p>}

            {/* Navigation Tabs */}
            <div className="shrink-0 px-4 sm:px-5 pt-2 pb-2 border-b border-border-subtle bg-secondary/40">
              <AnimatedTabs
                tabs={[
                  {
                    id: 'recommendations',
                    label: <><span className="lg:hidden">Advice</span><span className="hidden lg:inline">Smart Recommendations</span></>,
                    title: 'Smart Recommendations',
                    icon: <Sparkles size={13} />,
                    badge: monitor.analysis ? 'Ready' : undefined,
                  },
                  {
                    id: 'metrics',
                    label: <><span className="lg:hidden">Files</span><span className="hidden lg:inline">Behaviors & Files</span></>,
                    title: 'Behaviors & Files',
                    icon: <HardDrive size={13} />,
                    badge: monitor.discoveredFiles.length > 0 ? monitor.discoveredFiles.length : undefined,
                  },
                  {
                    id: 'schema',
                    label: <><span className="lg:hidden">Schema</span><span className="hidden lg:inline">Discovered Schema</span></>,
                    title: 'Discovered Schema',
                    icon: <FileSpreadsheet size={13} />,
                    badge: monitor.analysis?.extractedColumns.length || undefined,
                  },
                  {
                    id: 'live_events',
                    label: <><span className="lg:hidden">Events</span><span className="hidden lg:inline">Live Watcher Log</span></>,
                    title: 'Live Watcher Log',
                    icon: <Terminal size={13} />,
                    badge: monitor.events.length > 0 ? monitor.events.length : undefined,
                  },
                ]}
                activeTab={activeTab}
                onChange={(t) => setActiveTab(t as MonitorTab)}
                layoutId="folder-monitor-tabs"
                variant="pill"
                className="min-w-0 max-w-full grid grid-cols-2 lg:flex overflow-visible [&_button]:min-w-0 [&_button]:justify-center"
                size="xs"
              />
            </div>

            {/* Body Content */}
            <div className="min-w-0 p-4 sm:p-5 space-y-4 [overflow-wrap:anywhere]">
              {activeTab === 'recommendations' && (
                <FolderMonitorRecommendationsTab
                  analysis={monitor.analysis}
                  hasApplied={hasApplied}
                  isLoading={monitor.isLoading}
                  isDraggingOver={monitor.filePicker.isDraggingOver}
                  dragProps={monitor.filePicker.dragProps}
                  onApplyAll={handleApplyAll}
                  onApplyModeOnly={handleApplyModeOnly}
                  onApplyTemplateOnly={handleApplyTemplateOnly}
                  onPickDirectory={monitor.handlePickDirectory}
                  onSelectFolderFallback={selectFolderSnapshot}
                  onSelectFiles={selectFiles}
                />
              )}

              {activeTab === 'metrics' && (
                <FolderMonitorMetricsTab
                  analysis={monitor.analysis}
                  discoveredFiles={monitor.discoveredFiles}
                  selectedFileForPreview={monitor.selectedFileForPreview}
                  onSelectFileForPreview={monitor.setSelectedFileForPreview}
                />
              )}

              {activeTab === 'schema' && (
                <FolderMonitorSchemaTab analysis={monitor.analysis} onSelectSchemaSource={monitor.selectSchemaSource} />
              )}

              {activeTab === 'live_events' && (
                <FolderMonitorEventsTab
                  events={monitor.events}
                  isLiveMonitoring={monitor.isLiveMonitoring}
                  isLoading={monitor.isLoading}
                  folderHandle={monitor.folderHandle}
                  onToggleLiveMonitoring={() => monitor.setIsLiveMonitoring(!monitor.isLiveMonitoring)}
                  onRescan={() => void monitor.refresh()}
                  sourceKind={monitor.sourceKind}
                  error={monitor.error}
                  lastScanAt={monitor.lastScanAt}
                />
              )}
              {monitor.analysis && <ProfileExportControls analysis={monitor.analysis} folderPath={typeof monitor.folderHandle?.path === 'string' ? monitor.folderHandle.path : undefined} />}
              <p className="flex items-start gap-2 text-content-muted text-[11px]">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Analyzed locally. Selecting a folder does not acquire an OS lock or verify write access.</span>
              </p>
            </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-border-subtle bg-secondary flex flex-wrap gap-3 items-center justify-end text-xs">
              <div className="flex flex-wrap justify-end items-center gap-2 min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
                >
                  Close
                </button>
                {monitor.analysis && (
                  <>
                    <button
                      type="button"
                      onClick={handleApplyAll}
                      disabled={!monitor.analysis.extractedColumns.length || monitor.isLoading}
                      className="disabled:opacity-50 disabled:cursor-not-allowed max-w-full min-w-0 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={13} className="shrink-0" />
                      <span>Apply Recommendations</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
