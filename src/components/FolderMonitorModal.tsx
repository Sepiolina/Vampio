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
  Download,
} from 'lucide-react';
import { AnimatedTabs } from './AnimatedTabs';
import { ColumnSpec, ExportFormat, OutputStrategy } from '../types';
import {
  formatFileSize,
  exportWorkspaceProfileBundleJson,
} from '../utils/folderBehaviorAnalyzer';
import { useFolderMonitor } from '../hooks/useFolderMonitor';
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

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // One-click apply handlers
  const handleApplyAll = () => {
    if (!monitor.analysis) return;
    onApplyRecommendations({
      strategy: monitor.analysis.suggestedMode.outputStrategy,
      format: monitor.analysis.suggestedMode.format,
      destination: 'folder',
      filename: monitor.analysis.suggestedMode.suggestedFilename,
      filenamePattern: monitor.analysis.suggestedMode.suggestedFilenamePattern,
      rowsPerFile: monitor.analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: monitor.analysis.suggestedMode.suggestedTargetFile,
      columns: monitor.analysis.suggestedTemplate.columns,
      tableName: monitor.analysis.suggestedTemplate.tableName,
      batchCount: monitor.analysis.suggestedMode.suggestedBatchCount || 1000,
      intervalMs: monitor.analysis.suggestedMode.suggestedIntervalMs || 150,
      generationMode:
        monitor.analysis.suggestedMode.outputStrategy === 'append_existing'
          ? 'Continuous'
          : 'Batch',
    });
    setHasApplied(true);
    setTimeout(() => onClose(), 800);
  };

  const handleApplyModeOnly = () => {
    if (!monitor.analysis) return;
    onApplyRecommendations({
      strategy: monitor.analysis.suggestedMode.outputStrategy,
      format: monitor.analysis.suggestedMode.format,
      destination: 'folder',
      filename: monitor.analysis.suggestedMode.suggestedFilename,
      filenamePattern: monitor.analysis.suggestedMode.suggestedFilenamePattern,
      rowsPerFile: monitor.analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: monitor.analysis.suggestedMode.suggestedTargetFile,
      columns: [],
      tableName: monitor.analysis.suggestedTemplate.tableName,
      batchCount: monitor.analysis.suggestedMode.suggestedBatchCount || 1000,
      intervalMs: monitor.analysis.suggestedMode.suggestedIntervalMs || 150,
      generationMode: 'Batch',
    });
    setHasApplied(true);
    setTimeout(() => onClose(), 800);
  };

  const handleApplyTemplateOnly = () => {
    if (!monitor.analysis) return;
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
            {...monitor.filePicker.dragProps}
            className="bg-primary border border-border-subtle rounded-2xl w-full max-w-4xl h-[90vh] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
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
                    Releases will recursively parse real files, infer schemas, and start live observation.
                  </p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-secondary">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <FolderLock size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-content">
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
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Folder Target Status Strip */}
            <div className="px-5 py-2.5 bg-secondary/70 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-content font-bold truncate">
                  <Folder size={14} className="text-accent flex-shrink-0" />
                  <span className="truncate">
                    {monitor.folderName ? `/${monitor.folderName}` : 'No target folder locked'}
                  </span>
                </div>

                {monitor.discoveredFiles.length > 0 && (
                  <span className="text-[11px] font-mono text-content-muted">
                    {monitor.discoveredFiles.length} files · {formatFileSize(monitor.analysis?.metrics.totalSizeBytes || 0)}
                  </span>
                )}

                {monitor.isLiveMonitoring && monitor.folderHandle && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    LIVE OBSERVING
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={monitor.handlePickDirectory}
                  disabled={monitor.isLoading}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent text-white hover:bg-accent-hover text-[11px] font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <FolderLock size={12} />
                  <span>{monitor.folderHandle ? 'Change Target Folder' : 'Lock Target Folder'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => monitor.filePicker.selectFolder({ allowFallback: true })}
                  disabled={monitor.isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                  title="Select directory via local folder picker"
                >
                  <Upload size={12} className="text-content-muted" />
                  <span>Upload Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => monitor.filePicker.selectFiles()}
                  disabled={monitor.isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                  title="Select batch of files"
                >
                  <FileText size={12} className="text-content-muted" />
                  <span>Batch Files</span>
                </button>

                {monitor.folderHandle && (
                  <button
                    type="button"
                    onClick={() => monitor.scanFolderHandle(monitor.folderHandle, monitor.folderName)}
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

            {/* Navigation Tabs */}
            <div className="px-5 pt-2 border-b border-border-subtle bg-secondary/40">
              <AnimatedTabs
                tabs={[
                  {
                    id: 'recommendations',
                    label: 'Smart Recommendations',
                    icon: <Sparkles size={13} />,
                    badge: monitor.analysis ? 'Ready' : undefined,
                  },
                  {
                    id: 'metrics',
                    label: 'Behaviors & Files',
                    icon: <HardDrive size={13} />,
                    badge: monitor.discoveredFiles.length > 0 ? monitor.discoveredFiles.length : undefined,
                  },
                  {
                    id: 'schema',
                    label: 'Discovered Schema',
                    icon: <FileSpreadsheet size={13} />,
                    badge: monitor.analysis?.extractedColumns.length || undefined,
                  },
                  {
                    id: 'live_events',
                    label: 'Live Watcher Log',
                    icon: <Terminal size={13} />,
                    badge: monitor.events.length > 0 ? monitor.events.length : undefined,
                  },
                ]}
                activeTab={activeTab}
                onChange={(t) => setActiveTab(t as MonitorTab)}
                layoutId="folder-monitor-tabs"
                variant="pill"
                size="xs"
              />
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                  onSelectFolderFallback={() => monitor.filePicker.selectFolder({ allowFallback: true })}
                  onSelectFiles={() => monitor.filePicker.selectFiles()}
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
                <FolderMonitorSchemaTab analysis={monitor.analysis} />
              )}

              {activeTab === 'live_events' && (
                <FolderMonitorEventsTab
                  events={monitor.events}
                  isLiveMonitoring={monitor.isLiveMonitoring}
                  isLoading={monitor.isLoading}
                  folderHandle={monitor.folderHandle}
                  onToggleLiveMonitoring={() => monitor.setIsLiveMonitoring(!monitor.isLiveMonitoring)}
                  onRescan={() => monitor.folderHandle && monitor.scanFolderHandle(monitor.folderHandle, monitor.folderName)}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-border-subtle bg-secondary flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-content-muted text-[11px]">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Runs 100% in your browser. No files are uploaded to any server or AI service.</span>
              </div>

              <div className="flex items-center gap-2">
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
                      onClick={() => {
                        const jsonStr = exportWorkspaceProfileBundleJson(monitor.analysis!);
                        const blob = new Blob([jsonStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const safeName = (monitor.folderName || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_');
                        a.href = url;
                        a.download = `${safeName}-profile-${timestamp}.vampio.profile.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Export complete forensic profile bundle for developer workspace"
                    >
                      <Download size={13} />
                      <span>Export Profile Bundle (.JSON)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyAll}
                      className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={13} />
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
