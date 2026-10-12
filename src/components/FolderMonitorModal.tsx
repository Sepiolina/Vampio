import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Folder,
  FolderLock,
  Radio,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileText,
  Layers,
  Database,
  Sliders,
  ShieldCheck,
  Clock,
  HardDrive,
  FileSpreadsheet,
  Terminal,
  ArrowRight,
  AlertCircle,
  Play,
  Pause,
  Upload,
  Zap,
  Check,
  Download
} from 'lucide-react';
import { ColumnSpec, ExportFormat, OutputStrategy, ImportedFileContext } from '../types';
import { AnimatedTabs } from './AnimatedTabs';
import {
  DiscoveredFolderFile,
  FolderAnalysisResult,
  FolderMonitorEvent,
  analyzeFolderFiles,
  readFolderFromDirectoryHandle,
  readFilesFromHtmlFileList,
  formatFileSize,
  exportWorkspaceProfileBundleJson
} from '../utils/folderBehaviorAnalyzer';
import { requestDirectoryHandle, isFileSystemAccessSupported } from '../utils/fileSystem';
import { useI18n } from '../i18n';

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
    batchCount: number;
    intervalMs: number;
    generationMode: 'Batch' | 'Continuous';
    importedContext?: ImportedFileContext;
  }) => void;
  currentStrategy: OutputStrategy;
  currentFormat: ExportFormat;
  currentColumnsCount: number;
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
  currentColumnsCount,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<MonitorTab>('recommendations');
  const [isLoading, setIsLoading] = useState(false);
  const [folderHandle, setFolderHandle] = useState<any | null>(currentDirectoryHandle);
  const [folderName, setFolderName] = useState<string>(currentFolderName || '');
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFolderFile[]>([]);
  const [analysis, setAnalysis] = useState<FolderAnalysisResult | null>(null);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(true);
  const [events, setEvents] = useState<FolderMonitorEvent[]>([]);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<DiscoveredFolderFile | null>(null);
  const [hasApplied, setHasApplied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const monitoringTimerRef = useRef<any>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const addEvent = (type: FolderMonitorEvent['type'], message: string, details?: string) => {
    const newEvent: FolderMonitorEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details,
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
  };

  // Sync if parent folder changes while open
  useEffect(() => {
    if (currentDirectoryHandle && !folderHandle) {
      setFolderHandle(currentDirectoryHandle);
      setFolderName(currentFolderName || currentDirectoryHandle.name || 'locked_folder');
    }
  }, [currentDirectoryHandle, currentFolderName]);

  // Analyze folder whenever handle or discovered files change
  const scanFolderHandle = async (handle: any, name: string) => {
    setIsLoading(true);
    addEvent('scan', `Scanning folder "${name}"...`);

    try {
      const files = await readFolderFromDirectoryHandle(handle);
      setDiscoveredFiles(files);
      const result = analyzeFolderFiles(files, name);
      setAnalysis(result);
      if (files.length > 0) {
        setSelectedFileForPreview(files[0]);
      }

      addEvent(
        'info',
        `Discovered ${files.length} files (${formatFileSize(result.metrics.totalSizeBytes)}) in /${name}`
      );
      if (result.metrics.namingPattern?.detected) {
        addEvent(
          'pattern_matched',
          `Sequence pattern matched: "${result.metrics.namingPattern.pattern}"`
        );
      }
      if (result.metrics.temporalCadence === 'high_frequency_stream') {
        addEvent(
          'cadence_detected',
          `Detected rapid ingestion cadence (~${result.metrics.avgTimeDeltaSeconds}s delta between files)`
        );
      }
    } catch (err: any) {
      addEvent('info', `Scan note: ${err.message || 'Error inspecting folder'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial scan if folder is already linked
  useEffect(() => {
    if (isOpen && folderHandle && discoveredFiles.length === 0) {
      scanFolderHandle(folderHandle, folderName || folderHandle.name || 'locked_folder');
    }
  }, [isOpen, folderHandle]);

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

  // Live periodic folder poll if enabled and handle exists
  useEffect(() => {
    if (!isOpen || !isLiveMonitoring || !folderHandle) {
      if (monitoringTimerRef.current) clearInterval(monitoringTimerRef.current);
      return;
    }

    // Only active polling on handles capable of disk reads
    if (typeof folderHandle.values !== 'function' && folderHandle.kind !== 'tauri-dir') {
      if (monitoringTimerRef.current) clearInterval(monitoringTimerRef.current);
      return;
    }

    monitoringTimerRef.current = setInterval(async () => {
      try {
        const freshFiles = await readFolderFromDirectoryHandle(folderHandle, 65536, 1);
        let hasChanges = freshFiles.length !== discoveredFiles.length;
        let addedCount = 0;
        let modifiedCount = 0;

        if (!hasChanges) {
          const prevMap = new Map<string, DiscoveredFolderFile>(discoveredFiles.map((f) => [f.name, f]));
          for (const fresh of freshFiles) {
            const prev = prevMap.get(fresh.name);
            if (!prev) {
              hasChanges = true;
              addedCount++;
            } else if (prev.size !== fresh.size || prev.lastModified !== fresh.lastModified) {
              hasChanges = true;
              modifiedCount++;
            }
          }
        } else {
          addedCount = freshFiles.length - discoveredFiles.length;
        }

        if (hasChanges) {
          if (addedCount > 0) {
            addEvent('file_added', `Detected ${addedCount} new file(s) in /${folderName}`);
          } else if (modifiedCount > 0) {
            addEvent('file_grown', `Detected ${modifiedCount} updated file(s) in /${folderName}`);
          } else {
            addEvent('info', `Folder refreshed: now ${freshFiles.length} file(s) in /${folderName}`);
          }
          setDiscoveredFiles(freshFiles);
          const result = analyzeFolderFiles(freshFiles, folderName);
          setAnalysis(result);
        }
      } catch {
        // Silent catch during background poll
      }
    }, 3000);

    return () => {
      if (monitoringTimerRef.current) clearInterval(monitoringTimerRef.current);
    };
  }, [isOpen, isLiveMonitoring, folderHandle, discoveredFiles, folderName]);

  // Request directory picker
  const handlePickDirectory = async () => {
    try {
      const handle = await requestDirectoryHandle();
      if (handle) {
        const name = handle.name || 'target_folder';
        setFolderHandle(handle);
        setFolderName(name);
        onSelectLockedFolder(handle, name);
        addEvent('scan', `Locked onto target directory: /${name}`);
        await scanFolderHandle(handle, name);
        return;
      }
    } catch (err: any) {
      addEvent('info', `Folder selection note: ${err.message || 'Cancelled'}`);
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Recursive entry scanner for dropped folders
  const traverseFileSystemEntry = async (entry: any, outFiles: File[]) => {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            outFiles.push(file);
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = (): Promise<any[]> => {
        return new Promise((resolve) => {
          reader.readEntries(
            (batch: any[]) => resolve(batch || []),
            () => resolve([])
          );
        });
      };
      let entries: any[] = [];
      do {
        entries = await readBatch();
        for (const child of entries) {
          await traverseFileSystemEntry(child, outFiles);
        }
      } while (entries.length > 0);
    }
  };

  // Drag and drop ingestion for folders & files
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    setIsLoading(true);
    try {
      const items = e.dataTransfer.items;
      const files = e.dataTransfer.files;

      // 1. Direct FileSystemDirectoryHandle support (Chromium)
      let directDirHandle: any = null;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (typeof (it as any).getAsFileSystemHandle === 'function') {
            try {
              const handle = await (it as any).getAsFileSystemHandle();
              if (handle && handle.kind === 'directory') {
                directDirHandle = handle;
                break;
              }
            } catch {
              // ignore and fallback
            }
          }
        }
      }

      if (directDirHandle) {
        const name = directDirHandle.name || 'target_folder';
        setFolderHandle(directDirHandle);
        setFolderName(name);
        onSelectLockedFolder(directDirHandle, name);
        addEvent('scan', `Locked onto dropped directory: /${name}`);
        await scanFolderHandle(directDirHandle, name);
        return;
      }

      // 2. Recursive traversal of dropped items (webkitGetAsEntry)
      const droppedFiles: File[] = [];
      let detectedDirName = '';

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind !== 'file') continue;
          const entry = (it as any).webkitGetAsEntry ? (it as any).webkitGetAsEntry() : null;
          if (entry) {
            if (entry.isDirectory && !detectedDirName) {
              detectedDirName = entry.name;
            }
            await traverseFileSystemEntry(entry, droppedFiles);
          } else {
            const f = it.getAsFile();
            if (f) droppedFiles.push(f);
          }
        }
      } else if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          droppedFiles.push(files[i]);
        }
      }

      if (droppedFiles.length === 0) {
        addEvent('info', 'No valid files detected in dropped content.');
        return;
      }

      const finalFolderName =
        detectedDirName ||
        (droppedFiles[0] as any).webkitRelativePath?.split('/')[0] ||
        'dropped_folder';

      setFolderName(finalFolderName);
      const virtualHandle = { name: finalFolderName, kind: 'virtual-dir' };
      setFolderHandle(virtualHandle);
      onSelectLockedFolder(virtualHandle, finalFolderName);

      const discovered = await readFilesFromHtmlFileList(droppedFiles);
      setDiscoveredFiles(discovered);
      const result = analyzeFolderFiles(discovered, finalFolderName);
      setAnalysis(result);
      if (discovered.length > 0) setSelectedFileForPreview(discovered[0]);
      addEvent('info', `Ingested ${discovered.length} real files from dropped folder "/${finalFolderName}"`);
      if (result.metrics.namingPattern?.detected) {
        addEvent('pattern_matched', `Sequence pattern matched: "${result.metrics.namingPattern.pattern}"`);
      }
    } catch (err: any) {
      addEvent('info', `Drop error: ${err.message || 'Could not parse dropped files'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle directory files from HTML input (<input type="file" webkitdirectory />)
  const handleDirectoryInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;

    setIsLoading(true);
    const virtualName = (list[0] as any).webkitRelativePath?.split('/')[0] || 'imported_folder';
    setFolderName(virtualName);
    setFolderHandle({ name: virtualName, kind: 'virtual-dir' });
    onSelectLockedFolder({ name: virtualName, kind: 'virtual-dir' }, virtualName);

    try {
      const files = await readFilesFromHtmlFileList(list);
      setDiscoveredFiles(files);
      const result = analyzeFolderFiles(files, virtualName);
      setAnalysis(result);
      if (files.length > 0) setSelectedFileForPreview(files[0]);
      addEvent('info', `Imported ${files.length} real files from directory "/${virtualName}"`);
    } catch (err: any) {
      addEvent('info', `Import error: ${err.message}`);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  // Handle individual files selection
  const handleBatchFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;

    setIsLoading(true);
    const batchFiles: File[] = Array.from(list);
    const derivedName = 'selected_files';
    setFolderName(derivedName);
    const virtualHandle = { name: derivedName, kind: 'virtual-dir' };
    setFolderHandle(virtualHandle);
    onSelectLockedFolder(virtualHandle, derivedName);

    try {
      const files = await readFilesFromHtmlFileList(batchFiles);
      setDiscoveredFiles(files);
      const result = analyzeFolderFiles(files, derivedName);
      setAnalysis(result);
      if (files.length > 0) setSelectedFileForPreview(files[0]);
      addEvent('info', `Imported ${files.length} real files from file picker`);
    } catch (err: any) {
      addEvent('info', `File import error: ${err.message}`);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  // Execute one-click apply of recommendations
  const handleApplyAll = () => {
    if (!analysis) return;

    onApplyRecommendations({
      strategy: analysis.suggestedMode.outputStrategy,
      format: analysis.suggestedMode.format,
      destination: 'folder',
      filename: analysis.suggestedMode.suggestedFilename,
      filenamePattern: analysis.suggestedMode.suggestedFilenamePattern,
      rowsPerFile: analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: analysis.suggestedMode.suggestedTargetFile,
      columns: analysis.suggestedTemplate.columns,
      tableName: analysis.suggestedTemplate.tableName,
      batchCount: analysis.suggestedMode.suggestedBatchCount,
      intervalMs: analysis.suggestedMode.suggestedIntervalMs,
      generationMode: analysis.suggestedMode.suggestedGenerationMode,
    });

    setHasApplied(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  // Apply mode only (keep existing columns)
  const handleApplyModeOnly = () => {
    if (!analysis) return;
    onApplyRecommendations({
      strategy: analysis.suggestedMode.outputStrategy,
      format: analysis.suggestedMode.format,
      destination: 'folder',
      filename: analysis.suggestedMode.suggestedFilename,
      filenamePattern: analysis.suggestedMode.suggestedFilenamePattern,
      rowsPerFile: analysis.suggestedMode.suggestedRowsPerFile,
      targetFile: analysis.suggestedMode.suggestedTargetFile,
      columns: [], // Empty tells parent to retain existing columns
      tableName: '',
      batchCount: analysis.suggestedMode.suggestedBatchCount,
      intervalMs: analysis.suggestedMode.suggestedIntervalMs,
      generationMode: analysis.suggestedMode.suggestedGenerationMode,
    });
    setHasApplied(true);
    setTimeout(() => onClose(), 800);
  };

  // Apply template only (keep existing mode)
  const handleApplyTemplateOnly = () => {
    if (!analysis) return;
    onApplyRecommendations({
      strategy: currentStrategy,
      format: currentFormat,
      destination: 'folder',
      filename: analysis.suggestedTemplate.tableName,
      columns: analysis.suggestedTemplate.columns,
      tableName: analysis.suggestedTemplate.tableName,
      batchCount: 1000,
      intervalMs: 150,
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
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Only clear if target is the modal container itself
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setIsDraggingOver(false);
            }}
            onDrop={handleDrop}
            className="bg-primary border border-border-subtle rounded-2xl w-full max-w-4xl h-[90vh] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
          >
            {/* Drag & Drop Visual Overlay */}
            {isDraggingOver && (
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center gap-1">
                      <ShieldCheck size={11} />
                      100% Offline • Zero Mock • Real Files Only
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
                    {folderName ? `/${folderName}` : 'No target folder locked'}
                  </span>
                </div>

                {discoveredFiles.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-primary border border-border-subtle text-[11px] font-mono text-content-muted">
                    {discoveredFiles.length} files • {formatFileSize(analysis?.metrics.totalSizeBytes || 0)}
                  </span>
                )}

                {isLiveMonitoring && folderHandle && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    LIVE OBSERVING
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  /* @ts-ignore */
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleDirectoryInputChange}
                  className="hidden"
                />

                <input
                  type="file"
                  ref={filesInputRef}
                  multiple
                  onChange={handleBatchFilesChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handlePickDirectory}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent text-white hover:bg-accent-hover text-[11px] font-bold shadow-xs transition cursor-pointer"
                >
                  <FolderLock size={12} />
                  <span>{folderHandle ? 'Change Target Folder' : 'Lock Target Folder'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-[11px] font-medium transition cursor-pointer"
                  title="Select directory via native file browser"
                >
                  <Upload size={12} className="text-content-muted" />
                  <span>Upload Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => filesInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-[11px] font-medium transition cursor-pointer"
                  title="Select batch of files"
                >
                  <FileText size={12} className="text-content-muted" />
                  <span>Batch Files</span>
                </button>

                {folderHandle && (
                  <button
                    type="button"
                    onClick={() => scanFolderHandle(folderHandle, folderName)}
                    disabled={isLoading}
                    className="p-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content transition cursor-pointer flex items-center gap-1 px-2 text-[11px]"
                    title="Scan folder now"
                  >
                    <RefreshCw size={12} className={isLoading ? 'animate-spin text-accent' : ''} />
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
                    badge: analysis ? 'Ready' : undefined,
                  },
                  {
                    id: 'metrics',
                    label: 'Behaviors & Files',
                    icon: <HardDrive size={13} />,
                    badge: discoveredFiles.length > 0 ? discoveredFiles.length : undefined,
                  },
                  {
                    id: 'schema',
                    label: 'Discovered Schema',
                    icon: <FileSpreadsheet size={13} />,
                    badge: analysis?.extractedColumns.length || undefined,
                  },
                  {
                    id: 'live_events',
                    label: 'Live Watcher Log',
                    icon: <Terminal size={13} />,
                    badge: events.length > 0 ? events.length : undefined,
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
              {/* TAB 1: Smart Recommendations */}
              {activeTab === 'recommendations' && (
                <div className="space-y-4">
                  {analysis ? (
                    <>
                      {/* Top Comparison Card */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Box 1: Suggested Mode */}
                        <div className="p-4 rounded-xl bg-secondary/80 border border-border-subtle flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-content-muted flex items-center gap-1.5">
                                <Sliders size={12} className="text-accent" />
                                Recommended Set Mode
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent/15 text-accent border border-accent/25">
                                {analysis.suggestedMode.strategyConfidence}% Confidence
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-content capitalize">
                                  {analysis.suggestedMode.outputStrategy === 'multi_file'
                                    ? 'Partitioned Multi-File'
                                    : analysis.suggestedMode.outputStrategy === 'append_existing'
                                    ? 'In-Place Append Target'
                                    : 'Single Consolidated File'}
                                </span>
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-primary text-emerald-400 border border-border-subtle uppercase">
                                  .{analysis.suggestedMode.format}
                                </span>
                              </div>

                              <p className="text-xs text-content-muted leading-relaxed">
                                {analysis.suggestedMode.strategyReason}
                              </p>

                              {analysis.suggestedMode.suggestedFilenamePattern && (
                                <div className="p-2 rounded-lg bg-primary border border-border-subtle text-xs font-mono">
                                  <span className="text-[10px] text-content-muted block mb-0.5">Partition Pattern:</span>
                                  <span className="text-accent font-bold">
                                    {analysis.suggestedMode.suggestedFilenamePattern}
                                  </span>
                                  <span className="text-content-muted text-[11px] block mt-0.5">
                                    ~{analysis.suggestedMode.suggestedRowsPerFile} rows per generated file
                                  </span>
                                </div>
                              )}

                              {analysis.suggestedMode.suggestedTargetFile && (
                                <div className="p-2 rounded-lg bg-primary border border-border-subtle text-xs font-mono">
                                  <span className="text-[10px] text-content-muted block mb-0.5">Append Target:</span>
                                  <span className="text-emerald-400 font-bold">
                                    {analysis.suggestedMode.suggestedTargetFile}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border-subtle/70 flex items-center justify-between text-[11px]">
                            <span className="text-content-muted">Target Destination:</span>
                            <span className="font-mono text-content font-semibold">📁 Direct to Locked Folder</span>
                          </div>
                        </div>

                        {/* Box 2: Suggested Template */}
                        <div className="p-4 rounded-xl bg-secondary/80 border border-border-subtle flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-content-muted flex items-center gap-1.5">
                                <Layers size={12} className="text-accent" />
                                Recommended Template
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                {analysis.suggestedTemplate.confidence}% Match
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-content">
                                  {analysis.suggestedTemplate.presetName}
                                </h3>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-primary text-content-muted border border-border-subtle">
                                  {analysis.suggestedTemplate.category}
                                </span>
                              </div>

                              <p className="text-xs text-content-muted leading-relaxed">
                                {analysis.suggestedTemplate.reason}
                              </p>

                              {/* Columns Preview Chips */}
                              <div className="pt-1">
                                <span className="text-[10px] text-content-muted block mb-1">
                                  Included Columns ({analysis.suggestedTemplate.columns.length}):
                                </span>
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                  {analysis.suggestedTemplate.columns.map((c) => (
                                    <span
                                      key={c.id || c.name}
                                      className="px-1.5 py-0.5 rounded bg-primary border border-border-subtle text-[10px] font-mono text-content flex items-center gap-1"
                                    >
                                      <span className="text-accent font-semibold">{c.name}</span>
                                      <span className="text-content-muted text-[9px]">({c.type})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border-subtle/70 flex items-center justify-between text-[11px]">
                            <span className="text-content-muted">Target Table Name:</span>
                            <span className="font-mono text-accent font-semibold">
                              {analysis.suggestedTemplate.tableName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Primary One-Click Action Deck */}
                      <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-content flex items-center gap-1.5">
                              <Sparkles size={16} className="text-accent" />
                              One-Click Apply Recommendations
                            </h4>
                            <p className="text-xs text-content-muted mt-0.5">
                              Locks this folder, applies the suggested {analysis.suggestedMode.outputStrategy} strategy, and loads the {analysis.suggestedTemplate.presetName} schema.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={handleApplyAll}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
                            >
                              {hasApplied ? <Check size={15} /> : <Zap size={15} />}
                              <span>{hasApplied ? 'Applied Successfully!' : 'Apply Mode & Template'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-accent/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-content-muted text-[11px]">
                            Need granular control?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleApplyModeOnly}
                              className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
                            >
                              Apply Mode Only (Keep Columns)
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyTemplateOnly}
                              className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
                            >
                              Apply Template Only
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 space-y-4">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          setIsDraggingOver(false);
                        }}
                        onDrop={handleDrop}
                        className={`p-10 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-4 ${
                          isDraggingOver
                            ? 'border-accent bg-accent/15 shadow-xl scale-[1.01]'
                            : 'border-border-subtle bg-secondary/40 hover:border-accent/40 hover:bg-secondary/70'
                        }`}
                      >
                        <div className="h-16 w-16 rounded-2xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center shadow-xs">
                          <FolderLock size={32} />
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <h3 className="text-base font-bold text-content">
                            Drag &amp; Drop Target Folder Here
                          </h3>
                          <p className="text-xs text-content-muted leading-relaxed">
                            Drop any real local folder or multi-file set directly here to begin live analysis. The monitor reads 100% genuine local files with zero simulation.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handlePickDirectory}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent-hover text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <FolderLock size={13} />
                            <span>Select Target Folder</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition cursor-pointer"
                          >
                            <Upload size={13} className="text-content-muted" />
                            <span>Upload Local Folder</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => filesInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition cursor-pointer"
                          >
                            <FileText size={13} className="text-content-muted" />
                            <span>Select Batch Files</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Behaviors & Files */}
              {activeTab === 'metrics' && (
                <div className="space-y-4">
                  {analysis && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-secondary border border-border-subtle">
                        <span className="text-[10px] text-content-muted uppercase font-bold">Total Files</span>
                        <div className="text-lg font-mono font-bold text-content mt-1">
                          {analysis.metrics.totalFiles}
                        </div>
                        <span className="text-[10px] text-content-muted">
                          {formatFileSize(analysis.metrics.totalSizeBytes)} total
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary border border-border-subtle">
                        <span className="text-[10px] text-content-muted uppercase font-bold">Size Behavior</span>
                        <div className="text-sm font-bold text-accent mt-1 capitalize truncate">
                          {analysis.metrics.sizeVarianceType.replace('_', ' ')}
                        </div>
                        <span className="text-[10px] text-content-muted font-mono">
                          Avg: {formatFileSize(analysis.metrics.avgSizeBytes)}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary border border-border-subtle">
                        <span className="text-[10px] text-content-muted uppercase font-bold">Update Cadence</span>
                        <div className="text-sm font-bold text-content mt-1 capitalize truncate">
                          {analysis.metrics.temporalCadence.replace(/_/g, ' ')}
                        </div>
                        <span className="text-[10px] text-content-muted font-mono">
                          {analysis.metrics.avgTimeDeltaSeconds ? `~${analysis.metrics.avgTimeDeltaSeconds}s delta` : 'Static dump'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary border border-border-subtle">
                        <span className="text-[10px] text-content-muted uppercase font-bold">Dominant Format</span>
                        <div className="text-sm font-mono font-bold text-emerald-400 mt-1 uppercase">
                          .{analysis.metrics.dominantFormat}
                        </div>
                        <span className="text-[10px] text-content-muted">
                          {analysis.metrics.formatDistribution[analysis.metrics.dominantFormat] || analysis.metrics.totalFiles} files
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Discovered Files Table */}
                  <div className="border border-border-subtle rounded-xl overflow-hidden bg-secondary/50">
                    <div className="px-4 py-2 bg-secondary border-b border-border-subtle flex items-center justify-between">
                      <span className="text-xs font-bold text-content">
                        Discovered Folder Files ({discoveredFiles.length})
                      </span>
                      {discoveredFiles.length > 0 && (
                        <span className="text-[10px] text-content-muted font-mono">
                          Click row to inspect content preview
                        </span>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-border-subtle/50">
                      {discoveredFiles.length === 0 ? (
                        <div className="p-6 text-center text-xs text-content-muted">
                          No files found in selected directory.
                        </div>
                      ) : (
                        discoveredFiles.map((file) => (
                          <div
                            key={file.name}
                            onClick={() => setSelectedFileForPreview(file)}
                            className={`px-4 py-2 flex items-center justify-between text-xs cursor-pointer transition ${
                              selectedFileForPreview?.name === file.name
                                ? 'bg-accent/15 text-accent font-semibold'
                                : 'hover:bg-tertiary text-content'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText size={13} className="text-content-muted flex-shrink-0" />
                              <span className="font-mono truncate">{file.name}</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono text-[11px] text-content-muted flex-shrink-0">
                              <span>{formatFileSize(file.size)}</span>
                              <span>{new Date(file.lastModified).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Selected File Sample View */}
                  {selectedFileForPreview && selectedFileForPreview.sampleContent && (
                    <div className="p-3 rounded-xl bg-primary border border-border-subtle space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-content font-bold font-mono">
                          Snippet: {selectedFileForPreview.name}
                        </span>
                        <span className="text-[10px] text-content-muted font-mono">
                          First 64 KB
                        </span>
                      </div>
                      <pre className="p-2.5 rounded-lg bg-secondary text-[11px] font-mono text-content-muted overflow-x-auto max-h-36 select-text whitespace-pre-wrap">
                        {selectedFileForPreview.sampleContent.slice(0, 1000)}
                        {selectedFileForPreview.sampleContent.length > 1000 && '\n... (truncated)'}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Discovered Schema */}
              {activeTab === 'schema' && (
                <div className="space-y-4">
                  {analysis?.extractedColumns && analysis.extractedColumns.length > 0 ? (
                    <div className="border border-border-subtle rounded-xl overflow-hidden bg-secondary/50">
                      <div className="px-4 py-2 bg-secondary border-b border-border-subtle flex items-center justify-between">
                        <span className="text-xs font-bold text-content">
                          Extracted Architecture from Files ({analysis.extractedColumns.length} fields)
                        </span>
                        <span className="text-[10px] text-content-muted font-mono">
                          Source: {analysis.sampleFileUsed || 'Folder context'}
                        </span>
                      </div>

                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-primary/50 text-[10px] uppercase font-bold text-content-muted border-b border-border-subtle">
                            <th className="p-2.5 pl-4">Column Name</th>
                            <th className="p-2.5">Inferred Type</th>
                            <th className="p-2.5">Inferred Rule</th>
                            <th className="p-2.5 pr-4">Sample Values Observed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50 font-mono text-[11px]">
                          {analysis.extractedColumns.map((col) => (
                            <tr key={col.name} className="hover:bg-tertiary/40">
                              <td className="p-2.5 pl-4 font-bold text-content">{col.name}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-bold">
                                  {col.inferredType}
                                </span>
                              </td>
                              <td className="p-2.5 text-content-muted truncate max-w-[150px]">
                                {col.inferredRule || 'Standard'}
                              </td>
                              <td className="p-2.5 pr-4 text-content-muted truncate max-w-[200px]">
                                {col.sampleValues.length > 0
                                  ? col.sampleValues.join(', ')
                                  : 'Synthesized default'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-content-muted">
                      No schema could be sniffed from the current folder. Select a folder with CSV, JSON, or log files to inspect.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Live Watcher Log */}
              {activeTab === 'live_events' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLiveMonitoring(!isLiveMonitoring)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isLiveMonitoring
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-secondary text-content-muted border-border-subtle'
                        }`}
                      >
                        {isLiveMonitoring ? <Radio size={12} className="animate-pulse" /> : <Pause size={12} />}
                        <span>{isLiveMonitoring ? 'Watcher Active' : 'Watcher Paused'}</span>
                      </button>

                      <span className="text-[11px] text-content-muted">
                        Polls real folder changes every 3 seconds
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => folderHandle && scanFolderHandle(folderHandle, folderName)}
                      disabled={isLoading || !folderHandle}
                      className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer flex items-center gap-1.5"
                      title="Re-scan the folder for new, modified, or deleted files"
                    >
                      <RefreshCw size={12} className={isLoading ? 'animate-spin text-accent' : ''} />
                      <span>Re-scan Real Folder</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-black/80 border border-border-subtle font-mono text-[11px] text-emerald-400 space-y-1.5 max-h-72 overflow-y-auto">
                    {events.length === 0 ? (
                      <div className="text-content-muted">No events logged yet. Lock a target folder to begin.</div>
                    ) : (
                      events.map((e) => (
                        <div key={e.id} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-content-muted text-[10px] flex-shrink-0">[{e.timestamp}]</span>
                          <span className={e.type === 'pattern_matched' ? 'text-accent font-bold' : e.type === 'file_added' ? 'text-amber-400' : 'text-emerald-400'}>
                            {e.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
                {analysis && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const jsonStr = exportWorkspaceProfileBundleJson(analysis);
                        const blob = new Blob([jsonStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const safeName = (folderName || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_');
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
