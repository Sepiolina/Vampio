import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ColumnSpec, 
  ExportFormat, 
  OutputDestination, 
  PresetSchema, 
  GeneratorStats, 
  ThemeId,
  OutputStrategy,
  MultiFileConfig,
  AppendConfig,
  ImportedFileContext,
  ActionConfig,
  ActionDispatchLog,
  ActionStats
} from './types';
import { GeneratorEngine } from './utils/generator';
import { 
  formatDataset, 
  downloadFile, 
  getMimeType, 
  formatBytes,
  formatSingleFileUnit,
  appendRowsToWorkbook,
  appendRowsToTextFile,
  createZipArchive
} from './utils/export';
import { parseExcelOrCsvFile } from './utils/schemaExtractor';
import { 
  requestDirectoryHandle, 
  writeBatchToDirectory, 
  createStreamFileWriter, 
  createMultiFileStreamWriter,
  writeMultipleFilesToDirectory,
  StreamFileWriter,
  MultiFileStreamWriter,
  isTauri,
  isEmbeddedIframe,
  isFileSystemAccessSupported,
  createVirtualDirectoryHandle
} from './utils/fileSystem';
import { addRecentFile, addRecentFolder, getRecentFolders, saveCurrentSessionAuto } from './utils/sessionManager';
import { PRESET_SCHEMAS } from './data/presets';
import { Header, WorkspaceTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ColumnCard } from './components/ColumnCard';
import { ColumnSearch } from './components/ColumnSearch';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { PreviewTable } from './components/PreviewTable';
import { PresetSelector } from './components/PresetSelector';
import { OfflineExtractorModal } from './components/OfflineExtractorModal';
import { FolderMonitorModal } from './components/FolderMonitorModal';
import { FolderSelectModal } from './components/FolderSelectModal';
import { RestApiConfigModal } from './components/RestApiConfigModal';
import { ActionConfigModal } from './components/ActionConfigModal';
import { ActionLogModal } from './components/ActionLogModal';
import { dispatchActionRequest, defaultActionConfig, matchesTriggerCondition } from './utils/actionDispatcher';
import { WorkspaceBundleImportModal } from './components/WorkspaceBundleImportModal';
import { OperatorMonitorView } from './components/OperatorMonitorView';
import { RoleOnboardingModal } from './components/RoleOnboardingModal';
import { useUserRole } from './context/UserRoleContext';
import { useWorkspace } from './context/WorkspaceContext';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { WorkspaceSidebarDrawer } from './components/WorkspaceSidebarDrawer';
import { WorkspaceQuickSwitcherModal } from './components/WorkspaceQuickSwitcherModal';
import { WorkspaceSettingsModal } from './components/WorkspaceSettingsModal';
import { UnsavedChangesPromptModal } from './components/UnsavedChangesPromptModal';
import { VampioWorkspaceProfileBundle } from './utils/folderBehaviorAnalyzer';
import { prefetchRestApiBatch, serializeRestApiConfig } from './utils/restApiManager';
import { useI18n } from './i18n';

import { 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Layers,
  Sparkles,
  Columns,
  FileSpreadsheet,
  ArrowUpToLine,
  ArrowDownToLine,
  Scissors,
  Files,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  Upload,
  Globe,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const INITIAL_DEMO: ColumnSpec[] = PRESET_SCHEMAS[0].columns;

export default function App() {
  const { t } = useI18n();
  const [columns, setColumns] = useState<ColumnSpec[]>([]);
  const [tableName, setTableName] = useState<string>('synthetic_records');
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewCount, setPreviewCount] = useState<number>(10);
  const [mode, setMode] = useState<'Batch' | 'Continuous'>('Batch');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [outputDestination, setOutputDestination] = useState<OutputDestination>('download');
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [count, setCount] = useState<number>(1000);
  const [intervalMs, setIntervalMs] = useState<number>(150);
  const [filename, setFilename] = useState<string>('synthetic_dataset');
  const [outputStrategy, setOutputStrategy] = useState<OutputStrategy>('single');
  const [multiFileConfig, setMultiFileConfig] = useState<MultiFileConfig>({
    enabled: false,
    rowsPerFile: 1,
    filenamePattern: '{filename}_{index}.{ext}',
    packageAsZip: true,
  });
  const [importedContext, setImportedContext] = useState<ImportedFileContext | null>(null);
  const [appendConfig, setAppendConfig] = useState<AppendConfig>({
    autoContinueSequence: true,
    manualStartOffset: 1,
    skipDuplicateHeaders: true,
    excelSheetMode: 'active_sheet',
    newSheetName: 'Appended_Data',
    targetSheetName: undefined,
    saveMode: 'suffix',
    suffix: 'appended',
  });
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Engine Ready');
  const [stats, setStats] = useState<GeneratorStats>({
    rowsGenerated: 0,
    rowsPerSec: 0,
    elapsedSeconds: 0,
    fileSizeBytes: 0,
    isGenerating: false,
  });

  // Action / API Destination State
  const [actionConfig, setActionConfig] = useState<ActionConfig>(() => {
    const saved = localStorage.getItem('vampio-action-config');
    if (saved) {
      try {
        return { ...defaultActionConfig, ...JSON.parse(saved) };
      } catch {}
    }
    return defaultActionConfig;
  });

  useEffect(() => {
    try {
      localStorage.setItem('vampio-action-config', JSON.stringify(actionConfig));
    } catch {}
  }, [actionConfig]);

  const [actionLogs, setActionLogs] = useState<ActionDispatchLog[]>([]);
  const [actionStats, setActionStats] = useState<ActionStats>({
    totalDispatched: 0,
    successCount: 0,
    errorCount: 0,
    retryCount: 0,
    avgLatencyMs: 0,
    failedRecords: []
  });

  const [isActionConfigModalOpen, setIsActionConfigModalOpen] = useState<boolean>(false);
  const [isActionLogModalOpen, setIsActionLogModalOpen] = useState<boolean>(false);
  const actionContinuousBufferRef = useRef<Record<string, unknown>[]>([]);
  const actionBatchIndexRef = useRef<number>(0);

  const addActionLog = (log: ActionDispatchLog) => {
    setActionLogs((prev) => [log, ...prev.slice(0, 199)]);
    setActionStats((prev) => {
      const isSuccess = log.status === 'success';
      const isError = log.status === 'error';
      const isRetry = log.status === 'retrying';

      const newTotal = isRetry ? prev.totalDispatched : prev.totalDispatched + log.rowCount;
      const newSuccess = isSuccess ? prev.successCount + log.rowCount : prev.successCount;
      const newError = isError ? prev.errorCount + log.rowCount : prev.errorCount;
      const newRetry = isRetry ? prev.retryCount + 1 : prev.retryCount;
      const newLatency = prev.avgLatencyMs === 0
        ? log.durationMs
        : Math.round((prev.avgLatencyMs * 0.7) + (log.durationMs * 0.3));

      let newFailed = prev.failedRecords;
      if (isError && log.records && log.records.length > 0) {
        newFailed = [...prev.failedRecords, ...log.records];
      }

      return {
        totalDispatched: newTotal,
        successCount: newSuccess,
        errorCount: newError,
        retryCount: newRetry,
        avgLatencyMs: newLatency,
        failedRecords: newFailed
      };
    });
  };

  const handleClearActionLogs = () => {
    setActionLogs([]);
    setActionStats({
      totalDispatched: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      avgLatencyMs: 0,
      failedRecords: []
    });
  };

  const handleRetryFailedRecords = async (records: Record<string, unknown>[]) => {
    if (!records || records.length === 0) return;
    setStatusMessage(`Re-dispatching ${records.length.toLocaleString()} dead-letter records to ${actionConfig.endpointUrl}...`);

    const batchSize = actionConfig.mode === 'per_entry' ? 1 : Math.max(1, actionConfig.batchSize || 50);
    const totalBatches = Math.ceil(records.length / batchSize);

    for (let b = 0; b < totalBatches; b++) {
      const chunk = records.slice(b * batchSize, (b + 1) * batchSize);
      await dispatchActionRequest(actionConfig, chunk, b, (log) => {
        addActionLog(log);
      });
      if (actionConfig.throttleMs > 0) {
        await new Promise((r) => setTimeout(r, actionConfig.throttleMs));
      }
    }

    setStatusMessage(`Finished re-dispatching dead-letter records.`);
  };

  // Layout View Tabs & Sidebar State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1200 ? 'split' : 'schema';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Theme Management
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('vampio-theme') as ThemeId;
    const validThemes: ThemeId[] = [
      'theme-slate',
      'theme-cream',
      'theme-nordic',
      'theme-sage',
      'theme-lavender',
      'theme-sandstone',
      'theme-rose',
      'theme-strawberry',
      'theme-kiwi',
      'theme-neon'
    ];
    if (saved && validThemes.includes(saved)) {
      return saved;
    }
    return 'theme-slate';
  });

  // Context Menu & Clipboard State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, colId?: string, type: 'column' | 'container' } | null>(null);
  const [clipboard, setClipboard] = useState<{ action: 'copy' | 'cut', col: ColumnSpec } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
    document.body.className = theme;
    localStorage.setItem('vampio-theme', theme);
  }, [theme]);

  // Auto-save active schema session
  useEffect(() => {
    if (columns.length > 0) {
      saveCurrentSessionAuto({
        columns,
        tableName,
        format,
        count,
        intervalMs,
        selectedFolderName
      });
    }
  }, [columns, tableName, format, count, intervalMs, selectedFolderName]);

  // Multi-Project Workspace System
  const {
    activeWorkspace,
    activeWorkspaceId,
    updateActiveWorkspace,
    importAsNewWorkspace,
    displayMode,
    isInitialized: isWorkspaceInitialized,
    savePolicy: workspaceSavePolicy
  } = useWorkspace();

  const lastLoadedWorkspaceIdRef = useRef<string>('');
  const isSwitchingWorkspaceRef = useRef<boolean>(false);

  // Quick Insert Chips Scroll & Drag State
  const quickChipsRef = useRef<HTMLDivElement>(null);
  const chipsDragState = useRef({ isDown: false, startX: 0, scrollLeft: 0, hasDragged: false });
  const [canScrollChipsLeft, setCanScrollChipsLeft] = useState(false);
  const [canScrollChipsRight, setCanScrollChipsRight] = useState(false);

  const updateChipsScrollStatus = () => {
    if (quickChipsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = quickChipsRef.current;
      setCanScrollChipsLeft(scrollLeft > 4);
      setCanScrollChipsRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  useEffect(() => {
    updateChipsScrollStatus();
    const handleResize = () => updateChipsScrollStatus();
    window.addEventListener('resize', handleResize);
    const frameId = requestAnimationFrame(updateChipsScrollStatus);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
    };
  }, [activeTab, displayMode, columns.length]);

  const handleChipsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && !e.shiftKey) {
      e.currentTarget.scrollLeft += e.deltaY;
      updateChipsScrollStatus();
    }
  };

  const handleChipsMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!quickChipsRef.current) return;
    chipsDragState.current.isDown = true;
    chipsDragState.current.startX = e.pageX - quickChipsRef.current.offsetLeft;
    chipsDragState.current.scrollLeft = quickChipsRef.current.scrollLeft;
    chipsDragState.current.hasDragged = false;
  };

  const handleChipsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chipsDragState.current.isDown || !quickChipsRef.current) return;
    const x = e.pageX - quickChipsRef.current.offsetLeft;
    const walk = (x - chipsDragState.current.startX);
    if (Math.abs(walk) > 3) {
      chipsDragState.current.hasDragged = true;
      quickChipsRef.current.scrollLeft = chipsDragState.current.scrollLeft - walk;
      updateChipsScrollStatus();
    }
  };

  const handleChipsMouseUp = () => {
    chipsDragState.current.isDown = false;
    updateChipsScrollStatus();
    setTimeout(() => {
      chipsDragState.current.hasDragged = false;
    }, 50);
  };

  const scrollQuickChips = (direction: 'left' | 'right') => {
    if (quickChipsRef.current) {
      quickChipsRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth'
      });
      setTimeout(updateChipsScrollStatus, 250);
    }
  };

  // Sync state when active workspace changes
  useEffect(() => {
    if (!isWorkspaceInitialized || !activeWorkspace) return;
    if (activeWorkspace.id !== lastLoadedWorkspaceIdRef.current) {
      lastLoadedWorkspaceIdRef.current = activeWorkspace.id;
      isSwitchingWorkspaceRef.current = true;
      setColumns(activeWorkspace.columns || []);
      setTableName(activeWorkspace.tableName || 'synthetic_records');
      setFormat(activeWorkspace.format || 'csv');
      setCount(activeWorkspace.count || 1000);
      setIntervalMs(activeWorkspace.intervalMs || 150);
      setOutputDestination(activeWorkspace.outputDestination || 'download');
      setOutputStrategy(activeWorkspace.outputStrategy || 'single');
      if (activeWorkspace.multiFileConfig) {
        setMultiFileConfig(activeWorkspace.multiFileConfig);
      }
      if (activeWorkspace.appendConfig) {
        setAppendConfig(activeWorkspace.appendConfig);
      }
      setSelectedFolderName(activeWorkspace.selectedFolderName || null);
      if (activeWorkspace.filename) {
        setFilename(activeWorkspace.filename);
      }
    }
  }, [activeWorkspaceId, activeWorkspace, isWorkspaceInitialized]);

  // Sync local changes back to active workspace
  useEffect(() => {
    if (!isWorkspaceInitialized || !activeWorkspaceId || lastLoadedWorkspaceIdRef.current !== activeWorkspaceId) return;
    if (isSwitchingWorkspaceRef.current) {
      isSwitchingWorkspaceRef.current = false;
      return;
    }
    updateActiveWorkspace({
      columns,
      tableName,
      format,
      count,
      intervalMs,
      outputDestination,
      outputStrategy,
      multiFileConfig,
      appendConfig,
      selectedFolderName,
      filename,
    });
  }, [
    columns,
    tableName,
    format,
    count,
    intervalMs,
    outputDestination,
    outputStrategy,
    multiFileConfig,
    appendConfig,
    selectedFolderName,
    filename,
    isWorkspaceInitialized,
    activeWorkspaceId,
    updateActiveWorkspace
  ]);

  // User Role & Workspace Mode
  const { role, setRole, isRoleModalOpen, setIsRoleModalOpen } = useUserRole();
  const [isBundleImportModalOpen, setIsBundleImportModalOpen] = useState(false);
  const [profileBannerInfo, setProfileBannerInfo] = useState<{
    folderName: string;
    platform: string;
    encoding: string;
    delimiter?: string;
    lockStatus?: string;
  } | null>(null);

  const handleApplyProfileBundle = (bundle: VampioWorkspaceProfileBundle) => {
    if (bundle.vampioWorkspace.columns && bundle.vampioWorkspace.columns.length > 0) {
      setColumns(bundle.vampioWorkspace.columns);
    }
    if (bundle.vampioWorkspace.tableName) {
      setTableName(bundle.vampioWorkspace.tableName);
    }
    if (bundle.vampioWorkspace.format) {
      setFormat(bundle.vampioWorkspace.format);
    }
    if (bundle.vampioWorkspace.outputStrategy) {
      setOutputStrategy(bundle.vampioWorkspace.outputStrategy);
    }
    if (bundle.vampioWorkspace.filenamePattern) {
      setMultiFileConfig((prev) => ({
        ...prev,
        enabled: bundle.vampioWorkspace.outputStrategy === 'multi_file',
        filenamePattern: bundle.vampioWorkspace.filenamePattern,
        rowsPerFile: bundle.vampioWorkspace.rowsPerFile || prev.rowsPerFile,
      }));
    }
    if (bundle.vampioWorkspace.intervalMs) {
      setIntervalMs(bundle.vampioWorkspace.intervalMs);
    }
    setProfileBannerInfo({
      folderName: bundle.source.folderName,
      platform: bundle.source.platform,
      encoding: bundle.forensics.encoding,
      delimiter: bundle.forensics.delimiterName,
      lockStatus: bundle.forensics.fileLockStatus,
    });
    setStatusMessage(
      `Loaded profile for ${bundle.source.folderName} (${bundle.forensics.encoding}, ${bundle.vampioWorkspace.columns.length} cols)`
    );
  };

  const handleApplyAsNewWorkspace = async (bundle: VampioWorkspaceProfileBundle) => {
    const newWs = await importAsNewWorkspace({
      name: bundle.source.folderName || 'Imported Profile',
      tableName: bundle.vampioWorkspace.tableName || 'imported_schema',
      columns: bundle.vampioWorkspace.columns || [],
      format: bundle.vampioWorkspace.format || 'csv',
      outputStrategy: bundle.vampioWorkspace.outputStrategy,
      multiFileConfig: bundle.vampioWorkspace.filenamePattern ? {
        enabled: bundle.vampioWorkspace.outputStrategy === 'multi_file',
        filenamePattern: bundle.vampioWorkspace.filenamePattern,
        rowsPerFile: bundle.vampioWorkspace.rowsPerFile || 1,
        packageAsZip: true,
      } : undefined,
      intervalMs: bundle.vampioWorkspace.intervalMs,
    });
    setProfileBannerInfo({
      folderName: bundle.source.folderName,
      platform: bundle.source.platform,
      encoding: bundle.forensics.encoding,
      delimiter: bundle.forensics.delimiterName,
      lockStatus: bundle.forensics.fileLockStatus,
    });
    setStatusMessage(`Created new workspace tab "${newWs.name}" from profile bundle.`);
  };

  // Presets Modal
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Offline Pattern Extractor Modal
  const [isOfflineExtractorOpen, setIsOfflineExtractorOpen] = useState(false);
  const [extractorInitialFile, setExtractorInitialFile] = useState<File | null>(null);
  const [extractorAutoExtract, setExtractorAutoExtract] = useState<boolean>(false);

  // 100% Offline Target Folder Behavior Monitor Modal
  const [isFolderMonitorOpen, setIsFolderMonitorOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // REST API Retrieval & Enrichment Modal
  const [isRestApiModalOpen, setIsRestApiModalOpen] = useState(false);
  const [restApiModalTab, setRestApiModalTab] = useState<'column' | 'row'>('row');
  const dragCounterRef = useRef<number>(0);
  const schemaFileInputRef = useRef<HTMLInputElement>(null);

  // Global Escape Key Listener: Dismiss context menus, modals, and overlays
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (isPresetsOpen) {
          setIsPresetsOpen(false);
          return;
        }
        if (isOfflineExtractorOpen) {
          setIsOfflineExtractorOpen(false);
          setExtractorInitialFile(null);
          setExtractorAutoExtract(false);
          return;
        }
        if (isFolderMonitorOpen) {
          setIsFolderMonitorOpen(false);
          return;
        }
        if (isRestApiModalOpen) {
          setIsRestApiModalOpen(false);
          return;
        }
        if (isActionConfigModalOpen) {
          setIsActionConfigModalOpen(false);
          return;
        }
        if (isActionLogModalOpen) {
          setIsActionLogModalOpen(false);
          return;
        }
        if (isBundleImportModalOpen) {
          setIsBundleImportModalOpen(false);
          return;
        }
        if (isRoleModalOpen) {
          setIsRoleModalOpen(false);
          return;
        }
        if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
          setIsSidebarOpen(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    contextMenu,
    isPresetsOpen,
    isOfflineExtractorOpen,
    isFolderMonitorOpen,
    isRestApiModalOpen,
    isActionConfigModalOpen,
    isActionLogModalOpen,
    isBundleImportModalOpen,
    isRoleModalOpen,
    isSidebarOpen,
    setIsRoleModalOpen
  ]);

  const handleProcessSpreadsheetFile = (file: File) => {
    const name = file.name.toLowerCase();
    const isValid =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      name.endsWith('.csv') ||
      name.endsWith('.tsv') ||
      name.endsWith('.json') ||
      name.endsWith('.jsonl') ||
      name.endsWith('.ndjson') ||
      name.endsWith('.xml') ||
      name.endsWith('.txt');
    if (!isValid) {
      setStatusMessage(`Please drop an Excel (.xlsx, .xls), CSV, TSV, JSON, XML, or TXT file.`);
      return;
    }
    setExtractorInitialFile(file);
    setExtractorAutoExtract(true);
    setIsOfflineExtractorOpen(true);
    setStatusMessage(`Loaded "${file.name}" — Extracting schema architecture...`);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessSpreadsheetFile(file);
    }
  };

  // Column search filter
  const [columnSearch, setColumnSearch] = useState('');

  // Engine instance & streaming refs
  const streamingTimerRef = useRef<number | null>(null);
  const streamingStartTimeRef = useRef<number>(0);
  const streamingRowCountRef = useRef<number>(0);
  const continuousBufferRef = useRef<Record<string, unknown>[]>([]);
  const streamWriterRef = useRef<StreamFileWriter | null>(null);
  const multiStreamWriterRef = useRef<MultiFileStreamWriter | null>(null);

  // Real-time preview generation whenever columns or previewCount changes
  const refreshPreview = async () => {
    if (columns.length === 0) {
      setPreviewData([]);
      return;
    }
    const hasRestApi = columns.some(
      (c) => c.type === 'REST_API' || (c.rule && c.rule.includes('"REST_API"'))
    );
    if (hasRestApi) {
      await prefetchRestApiBatch(columns, previewCount);
    }
    const tempEngine = new GeneratorEngine();
    const rows = tempEngine.generateBatch(columns, previewCount);
    setPreviewData(rows);
  };

  useEffect(() => {
    if (!isStreaming) {
      refreshPreview();
    }
  }, [columns, previewCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
      }
      if (streamWriterRef.current) {
        streamWriterRef.current.close().catch(() => {});
      }
      if (multiStreamWriterRef.current) {
        multiStreamWriterRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Filter columns by advanced logic
  const filteredColumns = useMemo(() => {
    if (!columnSearch.trim()) return columns;
    const tokens = columnSearch.split(' ').filter(Boolean);
    
    if (tokens.length === 0) return columns;

    const evaluateToken = (c: ColumnSpec, part: string) => {
      part = part.toLowerCase();
      if (part.startsWith('type:')) {
        const expectedType = part.split(':')[1];
        if (!c.type.toLowerCase().includes(expectedType)) return false;
      } else if (part === 'has:nulls') {
        if (!c.skip_pct || c.skip_pct === 0) return false;
      } else if (part === 'has:condition') {
        if (!c.condition) return false;
      } else if (part === 'has:dependencies') {
        if (!c.dependencyCases || c.dependencyCases.length === 0) return false;
      } else if (part.startsWith('col:')) {
        const colName = part.split(':')[1];
        if (!c.name.toLowerCase().includes(colName)) return false;
      } else {
        // General search over name or type
        if (!c.name.toLowerCase().includes(part) && !c.type.toLowerCase().includes(part)) {
          return false;
        }
      }
      return true;
    };

    return columns.filter((c) => {
      // Split tokens by OR groups
      const orGroups: string[][] = [[]];
      for (const token of tokens) {
        if (token.toUpperCase() === 'OR' || token === '||') {
          orGroups.push([]);
        } else if (token.toUpperCase() !== 'AND' && token !== '&&') {
          orGroups[orGroups.length - 1].push(token);
        }
      }

      return orGroups.some(group => 
        group.length === 0 ? false : group.every(t => evaluateToken(c, t))
      );
    });
  }, [columns, columnSearch]);

  // Folder select modal state
  const [isFolderSelectModalOpen, setIsFolderSelectModalOpen] = useState<boolean>(false);
  const [folderModalErrorNotice, setFolderModalErrorNotice] = useState<string | null>(null);

  // Folder picker workflow
  const handleSelectFolder = async () => {
    // 1. In native Tauri desktop app (.exe / macOS / Linux):
    // Directly launch native OS folder picker!
    if (isTauri()) {
      try {
        const handle = await requestDirectoryHandle();
        if (handle) {
          setDirectoryHandle(handle);
          setSelectedFolderName(handle.name);
          setOutputDestination('folder');
          addRecentFolder(handle.name);
          setStatusMessage(`Selected local directory "${handle.name}". Ready for direct writes.`);
        }
        return;
      } catch (err: any) {
        console.warn('Desktop native picker error:', err);
        setFolderModalErrorNotice(err.message || 'Desktop folder picker error');
        setIsFolderSelectModalOpen(true);
        return;
      }
    }

    // 2. In browser / iframe:
    // If running in an embedded iframe or unsupported browser, show the Folder Selection Modal directly!
    if (isEmbeddedIframe() || !isFileSystemAccessSupported()) {
      setFolderModalErrorNotice(
        isEmbeddedIframe()
          ? 'Browser security policy restricts the File System Access API inside embedded iframes. Choose a Virtual Output Folder or browse via HTML5.'
          : null
      );
      setIsFolderSelectModalOpen(true);
      return;
    }

    // 3. Top-level browser tab with File System Access API
    try {
      const handle = await requestDirectoryHandle();
      if (handle) {
        setDirectoryHandle(handle);
        setSelectedFolderName(handle.name);
        setOutputDestination('folder');
        addRecentFolder(handle.name);
        setStatusMessage(`Selected folder "${handle.name}". Ready for direct writes.`);
      }
    } catch (err: any) {
      console.warn('Folder selection notice:', err);
      setFolderModalErrorNotice(err.message || 'Could not select folder');
      setIsFolderSelectModalOpen(true);
    }
  };

  const handleClearFolder = () => {
    setDirectoryHandle(null);
    setSelectedFolderName(null);
    setOutputDestination('download');
    setStatusMessage('Switched back to Browser Download mode.');
  };

  // Attach Target File directly for In-Place Append
  const handleAttachAppendTargetFile = async (file: File) => {
    try {
      const parsed = await parseExcelOrCsvFile(file);
      const firstSheetName = parsed.sheetNames[0] || 'Sheet1';
      const sheet = parsed.sheets[firstSheetName];
      const totalRows = sheet?.totalRows || 0;
      const context: ImportedFileContext = {
        filename: parsed.filename,
        format: (parsed.fileFormat as ExportFormat) || 'csv',
        totalRows,
        startingRowNumber: totalRows + 1,
        headers: sheet?.headers || [],
        rawWorkbook: parsed.rawWorkbook,
        rawFile: parsed.rawFile,
        rawRows: sheet?.rows || [],
        rawContent: parsed.rawContent,
        targetSheetName: firstSheetName,
        sheetNames: parsed.sheetNames,
      };
      setImportedContext(context);
      setOutputStrategy('append_existing');
      setFormat((parsed.fileFormat as ExportFormat) || 'csv');
      setAppendConfig((prev) => ({
        ...prev,
        targetSheetName: firstSheetName,
      }));
      setStatusMessage(`Linked target file "${file.name}" (${totalRows.toLocaleString()} existing rows) for In-Place Append.`);
    } catch (err: any) {
      console.error('Failed to attach target append file:', err);
      setStatusMessage(`Could not attach target file: ${err.message}`);
    }
  };

  // Column Manipulations
  const handleUpdateColumn = (updated: ColumnSpec) => {
    setColumns(columns.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(columns.filter((c) => c.id !== id));
  };

  const handleDuplicateColumn = (col: ColumnSpec) => {
    const newCol: ColumnSpec = {
      ...col,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name: `${col.name}_copy`,
    };
    const idx = columns.findIndex((c) => c.id === col.id);
    const newCols = [...columns];
    newCols.splice(idx + 1, 0, newCol);
    setColumns(newCols);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    if (startIndex === endIndex) return;

    // We must reorder based on the full `columns` array, 
    // but the visible indices from DragDropContext match the filteredColumns.
    // To be safe, if we have a search active, we might have weird behavior.
    // Typically drag and drop is disabled or re-mapped during search.
    // For simplicity, we just reorder the main array assuming no filter is active,
    // or reorder based on IDs if filter is active.
    
    // Better to reorder based on the ID we got
    const draggedColId = result.draggableId;
    const destColId = filteredColumns[endIndex]?.id;
    
    if (!destColId) return;

    const newCols = [...columns];
    const sourceIdx = newCols.findIndex(c => c.id === draggedColId);
    const destIdx = newCols.findIndex(c => c.id === destColId);
    
    if (sourceIdx !== -1 && destIdx !== -1) {
      const [removed] = newCols.splice(sourceIdx, 1);
      newCols.splice(destIdx, 0, removed);
      setColumns(newCols);
    }
  };

  const handleContextMenuAction = (action: 'top' | 'bottom' | 'duplicate' | 'remove' | 'cut' | 'copy' | 'paste-before' | 'paste-after' | 'paste-append', targetId?: string) => {
    let colIdx = -1;
    let col: ColumnSpec | undefined;
    
    if (targetId) {
      colIdx = columns.findIndex(c => c.id === targetId);
      col = columns[colIdx];
    }
    
    if (action === 'top' && colIdx > 0) {
      const newCols = [...columns];
      const [c] = newCols.splice(colIdx, 1);
      newCols.unshift(c);
      setColumns(newCols);
    } else if (action === 'bottom' && colIdx !== -1 && colIdx < columns.length - 1) {
      const newCols = [...columns];
      const [c] = newCols.splice(colIdx, 1);
      newCols.push(c);
      setColumns(newCols);
    } else if (action === 'duplicate' && col) {
      handleDuplicateColumn(col);
    } else if (action === 'remove' && targetId) {
      handleRemoveColumn(targetId);
    } else if (action === 'cut' && col) {
      setClipboard({ action: 'cut', col });
      const newCols = [...columns];
      newCols.splice(colIdx, 1);
      setColumns(newCols);
    } else if (action === 'copy' && col) {
      setClipboard({ action: 'copy', col });
    } else if (action.startsWith('paste') && clipboard) {
      const newCols = [...columns];
      
      const finalCol = { 
        ...clipboard.col, 
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        name: clipboard.action === 'copy' ? `${clipboard.col.name}_copy` : clipboard.col.name 
      };

      if (action === 'paste-append') {
        newCols.push(finalCol);
      } else if (targetId) {
        const updatedDestIdx = newCols.findIndex(c => c.id === targetId);
        if (updatedDestIdx !== -1) {
          if (action === 'paste-after') {
            newCols.splice(updatedDestIdx + 1, 0, finalCol);
          } else if (action === 'paste-before') {
            newCols.splice(updatedDestIdx, 0, finalCol);
          }
        }
      }
      setColumns(newCols);
      
      if (clipboard.action === 'cut') {
        setClipboard(null);
      }
    }
    setContextMenu(null);
  };

  const handleAddColumn = (type: ColumnSpec['type'] = 'String', defaultRule?: string) => {
    const nextNum = columns.length + 1;
    let rule = defaultRule;
    if (rule === undefined) {
      if (type === 'REST_API') {
        rule = serializeRestApiConfig({
          url: 'https://dummyjson.com/users?limit=50',
          method: 'GET',
          jsonPath: 'users[].email',
          retrievalMode: 'pool',
          sampleStrategy: 'sequential',
          fallbackValue: 'api_unavailable'
        });
      } else {
        rule = '12';
      }
    }
    const newCol: ColumnSpec = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      name: type === 'REST_API' ? `api_${nextNum}` : `field_${nextNum}`,
      type,
      rule,
      skip_pct: 0,
      condition: '',
    };
    setColumns([...columns, newCol]);
  };

  // Batch Generation
  const handleStartBatch = async () => {
    if (columns.length === 0) {
      setStatusMessage('Error: Add at least one column to generate data.');
      return;
    }

    if (actionConfig.enabled && !actionConfig.endpointUrl.trim()) {
      setStatusMessage('Notice: Action Add-on is enabled, but Endpoint URL is empty. Generating files normally.');
    }

    let activeDir = directoryHandle;
    if (outputDestination === 'folder' && !activeDir) {
      try {
        const handle = await requestDirectoryHandle();
        if (!handle) {
          const fallbackHandle = createVirtualDirectoryHandle(selectedFolderName || 'output_dataset');
          setDirectoryHandle(fallbackHandle);
          setSelectedFolderName(fallbackHandle.name);
          addRecentFolder(fallbackHandle.name);
          activeDir = fallbackHandle;
          setStatusMessage(`Folder selection cancelled. Using virtual folder "${fallbackHandle.name}".`);
        } else {
          setDirectoryHandle(handle);
          setSelectedFolderName(handle.name);
          addRecentFolder(handle.name);
          activeDir = handle;
        }
      } catch (err: any) {
        const fallbackHandle = createVirtualDirectoryHandle(selectedFolderName || 'output_dataset');
        setDirectoryHandle(fallbackHandle);
        setSelectedFolderName(fallbackHandle.name);
        addRecentFolder(fallbackHandle.name);
        activeDir = fallbackHandle;
        setStatusMessage(`Folder notice: ${err.message}. Using virtual folder "${fallbackHandle.name}".`);
      }
    }

    setIsGeneratingBatch(true);
    setBatchProgress(0);

    const hasRestApi = columns.some(
      (c) => c.type === 'REST_API' || (c.rule && c.rule.includes('"REST_API"'))
    );
    if (hasRestApi) {
      setStatusMessage('Prefetching REST API remote endpoints...');
      await prefetchRestApiBatch(columns, Math.min(count, 500));
    }

    const isContinuation = outputStrategy === 'append_existing' && importedContext;
    const isMultiFile = outputStrategy === 'multi_file';

    const baseDescription = isContinuation
      ? `Continuing "${importedContext.filename}" (adding ${count.toLocaleString()} rows from row #${importedContext.startingRowNumber})...`
      : isMultiFile
      ? `Synthesizing ${count.toLocaleString()} rows split across individual files (${multiFileConfig.rowsPerFile} per file)...`
      : outputDestination === 'folder' && activeDir
      ? `Synthesizing ${count.toLocaleString()} records for direct write to "${activeDir.name}"...`
      : `Synthesizing ${count.toLocaleString()} records for browser download...`;

    const actionSuffix = actionConfig.enabled && actionConfig.endpointUrl.trim()
      ? ` (+ Action Add-on: ${actionConfig.endpointUrl})`
      : '';

    const actionDescription = `${baseDescription}${actionSuffix}`;

    setStatusMessage(actionDescription);

    const startTime = performance.now();
    const batchEngine = new GeneratorEngine();
    const allRows: Record<string, unknown>[] = [];
    const CHUNK_SIZE = 5000;
    let generated = 0;

    // Determine starting index so sequence / IDs match continuation
    const startRowOffset = isContinuation
      ? (appendConfig.autoContinueSequence
          ? (importedContext.startingRowNumber ? importedContext.startingRowNumber - 1 : importedContext.totalRows)
          : Math.max(0, (appendConfig.manualStartOffset || 1) - 1))
      : 0;

    const processChunk = async () => {
      const remaining = count - generated;
      const thisBatch = Math.min(CHUNK_SIZE, remaining);

      for (let i = 0; i < thisBatch; i++) {
        allRows.push(batchEngine.generateRow(columns, startRowOffset + generated + i));
      }
      generated += thisBatch;
      setBatchProgress(Math.floor((generated / count) * 100));

      if (generated < count) {
        setTimeout(processChunk, 0);
      } else {
        const elapsed = performance.now() - startTime;
        const elapsedSec = elapsed / 1000;
        const rowsPerSec = Math.round(count / (elapsedSec || 0.001));

        // Output Branch 1: Multi-file Generation (1 file per row/chunk)
        if (isMultiFile) {
          const rowsPerFile = Math.max(1, multiFileConfig.rowsPerFile || 1);
          const pattern = multiFileConfig.filenamePattern || '{filename}_{index}.{ext}';
          const baseName = filename || 'record';
          const ext = format;

          const fileEntries: { filename: string; content: string | Uint8Array }[] = [];
          for (let fileIdx = 0; fileIdx * rowsPerFile < allRows.length; fileIdx++) {
            const chunk = allRows.slice(fileIdx * rowsPerFile, (fileIdx + 1) * rowsPerFile);
            const formattedContent = formatSingleFileUnit(columns, chunk, format, tableName);
            const indexStr = String(fileIdx + 1).padStart(5, '0');
            const fileItemName = pattern
              .replace('{filename}', baseName)
              .replace('{index}', indexStr)
              .replace('{ext}', ext);
            fileEntries.push({ filename: fileItemName, content: formattedContent });
          }

          let totalOutputBytes = 0;
          for (const fe of fileEntries) {
            totalOutputBytes += typeof fe.content === 'string' ? fe.content.length : fe.content.byteLength;
          }

          if (outputDestination === 'folder' && activeDir) {
            try {
              await writeMultipleFilesToDirectory(
                activeDir,
                fileEntries,
                (curr, total) => setStatusMessage(`Writing file ${curr}/${total} to /${activeDir.name}...`)
              );
              setStatusMessage(
                `Saved ${fileEntries.length.toLocaleString()} individual files to "${activeDir.name}" (${formatBytes(totalOutputBytes)}) in ${elapsedSec.toFixed(2)}s`
              );
            } catch (err: any) {
              console.error('Multi-file folder write error, downloading ZIP archive instead:', err);
              const zipBlob = await createZipArchive(fileEntries);
              const zipName = `${baseName}_bundle.zip`;
              downloadFile(zipBlob, zipName, 'application/zip');
              setStatusMessage(`Direct folder write failed (${err.message}). Downloaded ${fileEntries.length} files as ZIP.`);
            }
          } else {
            // Browser download: Bundle all files into a ZIP archive
            const zipBlob = await createZipArchive(fileEntries);
            const zipName = `${baseName}_bundle.zip`;
            downloadFile(zipBlob, zipName, 'application/zip');
            setStatusMessage(
              `Generated & downloaded ${fileEntries.length.toLocaleString()} files bundled as "${zipName}" in ${elapsedSec.toFixed(2)}s (${formatBytes(totalOutputBytes)})`
            );
          }

          addRecentFile({
            filename: `${baseName}_bundle(${fileEntries.length}_files).zip`,
            format,
            rowCount: count,
            folderName: outputDestination === 'folder' && activeDir ? activeDir.name : null,
            fileSizeBytes: totalOutputBytes
          });
          if (outputDestination === 'folder' && activeDir) {
            addRecentFolder(activeDir.name);
          }

          setStats({
            rowsGenerated: count,
            rowsPerSec,
            elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
            fileSizeBytes: totalOutputBytes,
            isGenerating: false,
          });

        // Output Branch 2: Continue writing to imported file (In-Place Append)
        } else if (isContinuation && importedContext) {
          let appendedOutput: string | Uint8Array;
          const originalFilename = importedContext.filename || `${filename || 'dataset'}.${format}`;

          // Calculate destination filename based on saveMode & suffix
          let targetFilename: string;
          if (appendConfig.saveMode === 'suffix') {
            const extMatch = originalFilename.match(/\.([^.]+)$/);
            const fileExt = extMatch ? extMatch[1] : format;
            const base = originalFilename.replace(/\.[^/.]+$/, '');
            targetFilename = `${base}_${appendConfig.suffix || 'appended'}.${fileExt}`;
          } else {
            targetFilename = originalFilename;
          }

          if (format === 'xlsx' || format === 'xls') {
            appendedOutput = appendRowsToWorkbook(
              importedContext.rawWorkbook,
              allRows,
              columns.map((c) => c.name),
              appendConfig.targetSheetName || importedContext.targetSheetName,
              format === 'xls' ? 'biff8' : 'xlsx',
              appendConfig.excelSheetMode,
              appendConfig.newSheetName
            );
          } else {
            appendedOutput = appendRowsToTextFile(
              importedContext.rawContent || '',
              columns,
              allRows,
              format,
              appendConfig.skipDuplicateHeaders,
              tableName
            );
          }

          const byteSize = typeof appendedOutput === 'string' ? new Blob([appendedOutput]).size : appendedOutput.byteLength;
          const mime = getMimeType(format);
          const newTotal = importedContext.totalRows + count;

          if (outputDestination === 'folder' && activeDir) {
            try {
              await writeBatchToDirectory(activeDir, targetFilename, appendedOutput);
              setStatusMessage(
                `Appended ${count.toLocaleString()} rows to "${activeDir.name}/${targetFilename}". Total rows: ${newTotal.toLocaleString()} (${formatBytes(byteSize)})`
              );
            } catch (err: any) {
              downloadFile(appendedOutput, targetFilename, mime);
              setStatusMessage(`Direct folder write notice: ${err.message}. Downloaded ${targetFilename}.`);
            }
          } else {
            downloadFile(appendedOutput, targetFilename, mime);
            setStatusMessage(
              `Appended ${count.toLocaleString()} rows to "${targetFilename}" (now ${newTotal.toLocaleString()} total rows, ${formatBytes(byteSize)})`
            );
          }

          // Update context with newly accumulated rows
          setImportedContext({
            ...importedContext,
            filename: appendConfig.saveMode === 'overwrite' ? originalFilename : targetFilename,
            totalRows: newTotal,
            startingRowNumber: newTotal + 1,
            rawContent: typeof appendedOutput === 'string' ? appendedOutput : importedContext.rawContent,
          });

          addRecentFile({
            filename: targetFilename,
            format,
            rowCount: newTotal,
            folderName: outputDestination === 'folder' && activeDir ? activeDir.name : null,
            fileSizeBytes: byteSize
          });
          if (outputDestination === 'folder' && activeDir) {
            addRecentFolder(activeDir.name);
          }

          setStats({
            rowsGenerated: count,
            rowsPerSec,
            elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
            fileSizeBytes: byteSize,
            isGenerating: false,
          });

        // Output Branch 3: Standard Single File Generation
        } else {
          const output = formatDataset(columns, allRows, format, tableName);
          const mime = getMimeType(format);
          const fullFilename = `${filename || 'dataset'}.${format}`;
          const byteSize = typeof output === 'string' ? new Blob([output]).size : output.byteLength;

          if (outputDestination === 'folder' && activeDir) {
            try {
              await writeBatchToDirectory(activeDir, fullFilename, output);
              setStatusMessage(
                `Saved ${count.toLocaleString()} rows directly to "${activeDir.name}/${fullFilename}" (${formatBytes(byteSize)})`
              );
            } catch (err: any) {
              console.error('Direct write error, falling back to download:', err);
              downloadFile(output, fullFilename, mime);
              setStatusMessage(
                `Direct folder write failed (${err.message}). Downloaded via browser.`
              );
            }
          } else {
            downloadFile(output, fullFilename, mime);
            setStatusMessage(
              `Generated & downloaded ${count.toLocaleString()} rows in ${elapsedSec.toFixed(2)}s (${rowsPerSec.toLocaleString()} rows/sec, ${formatBytes(byteSize)})`
            );
          }

          addRecentFile({
            filename: fullFilename,
            format,
            rowCount: count,
            folderName: outputDestination === 'folder' && activeDir ? activeDir.name : null,
            fileSizeBytes: byteSize
          });
          if (outputDestination === 'folder' && activeDir) {
            addRecentFolder(activeDir.name);
          }

          setStats({
            rowsGenerated: count,
            rowsPerSec,
            elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
            fileSizeBytes: byteSize,
            isGenerating: false,
          });
        }

        // Action Add-on Pipeline Execution
        if (actionConfig.enabled && actionConfig.endpointUrl.trim()) {
          const candidateRows = actionConfig.triggerCondition?.enabled && actionConfig.triggerCondition.column
            ? allRows.filter((r) => matchesTriggerCondition(r, actionConfig.triggerCondition))
            : allRows;

          if (candidateRows.length > 0) {
            setStatusMessage((prev) => `${prev} · Dispatching ${candidateRows.length.toLocaleString()} rows to Action API...`);
            const batchSize = actionConfig.mode === 'per_entry' ? 1 : Math.max(1, actionConfig.batchSize || 50);
            const totalBatches = Math.ceil(candidateRows.length / batchSize);
            let dispatchedCount = 0;
            let successCount = 0;
            let failedCount = 0;

            for (let b = 0; b < totalBatches; b++) {
              const chunk = candidateRows.slice(b * batchSize, (b + 1) * batchSize);
              const res = await dispatchActionRequest(actionConfig, chunk, b, (log) => {
                addActionLog(log);
              });

              dispatchedCount += chunk.length;
              if (res.success) {
                successCount += chunk.length;
              } else {
                failedCount += chunk.length;
                if (actionConfig.stopOnError) break;
              }

              if (actionConfig.throttleMs > 0) {
                await new Promise((r) => setTimeout(r, actionConfig.throttleMs));
              } else if (b % 5 === 0) {
                await new Promise((r) => setTimeout(r, 0));
              }
            }

            setStatusMessage((prev) => `${prev} · Action Add-on: ${successCount.toLocaleString()} delivered, ${failedCount.toLocaleString()} failed.`);
          }
        }

        // Update preview with first rows
        setPreviewData(allRows.slice(0, previewCount));
        setIsGeneratingBatch(false);
      }
    };

    setTimeout(processChunk, 10);
  };

  // Continuous Streaming Mode
  const handleStartContinuous = async () => {
    if (columns.length === 0) {
      setStatusMessage('Error: Add at least one column before streaming.');
      return;
    }

    if (actionConfig.enabled && !actionConfig.endpointUrl.trim()) {
      setStatusMessage('Notice: Action Add-on is enabled, but Endpoint URL is empty. Streaming locally.');
    }

    let activeDir = directoryHandle;
    if (outputDestination === 'folder' && !activeDir) {
      try {
        const handle = await requestDirectoryHandle();
        if (!handle) {
          const fallbackHandle = createVirtualDirectoryHandle(selectedFolderName || 'stream_dataset');
          setDirectoryHandle(fallbackHandle);
          setSelectedFolderName(fallbackHandle.name);
          addRecentFolder(fallbackHandle.name);
          activeDir = fallbackHandle;
          setStatusMessage(`Folder selection cancelled. Using virtual folder "${fallbackHandle.name}".`);
        } else {
          setDirectoryHandle(handle);
          setSelectedFolderName(handle.name);
          addRecentFolder(handle.name);
          activeDir = handle;
        }
      } catch (err: any) {
        const fallbackHandle = createVirtualDirectoryHandle(selectedFolderName || 'stream_dataset');
        setDirectoryHandle(fallbackHandle);
        setSelectedFolderName(fallbackHandle.name);
        addRecentFolder(fallbackHandle.name);
        activeDir = fallbackHandle;
        setStatusMessage(`Folder notice: ${err.message}. Using virtual folder "${fallbackHandle.name}".`);
      }
    }

    const fullFilename = `${filename || 'stream_dataset'}.${format}`;
    let activeStreamWriter: StreamFileWriter | null = null;
    let activeMultiWriter: MultiFileStreamWriter | null = null;

    if (outputDestination === 'folder' && activeDir) {
      if (outputStrategy === 'multi_file') {
        try {
          activeMultiWriter = await createMultiFileStreamWriter(
            activeDir,
            multiFileConfig.filenamePattern || '{filename}_{index}.{ext}',
            columns,
            format,
            multiFileConfig.rowsPerFile || 1,
            tableName
          );
          multiStreamWriterRef.current = activeMultiWriter;
        } catch (err: any) {
          console.error('Failed to create multi-file stream writer:', err);
          setStatusMessage(`Could not write multi-files to folder (${err.message}). Streaming to memory buffer instead.`);
        }
      } else {
        try {
          activeStreamWriter = await createStreamFileWriter(
            activeDir,
            fullFilename,
            columns,
            format,
            tableName
          );
          streamWriterRef.current = activeStreamWriter;
        } catch (err: any) {
          console.error('Failed to create stream writer:', err);
          setStatusMessage(`Could not write to folder (${err.message}). Streaming to memory buffer instead.`);
        }
      }
    }

    setIsStreaming(true);
    streamingStartTimeRef.current = performance.now();
    streamingRowCountRef.current = 0;
    continuousBufferRef.current = [];
    actionContinuousBufferRef.current = [];
    actionBatchIndexRef.current = 0;
    const streamEngine = new GeneratorEngine();

    const destLabel = activeMultiWriter && activeDir
      ? `Live Multi-File Writer: /${activeDir.name}/`
      : activeStreamWriter && activeDir
      ? `Live Disk Writer: /${activeDir.name}/${fullFilename}`
      : 'In-Memory Buffer';

    const actionAddonLabel = actionConfig.enabled && actionConfig.endpointUrl.trim()
      ? ` + Action Egress (${actionConfig.method} ${actionConfig.mode === 'per_entry' ? 'Per-Entry' : `Batch ${actionConfig.batchSize}`})`
      : '';

    setStatusMessage(`Stream Active [${destLabel}${actionAddonLabel}] at ${intervalMs}ms...`);

    streamingTimerRef.current = window.setInterval(async () => {
      const rowIndex = streamingRowCountRef.current;
      const newRow = streamEngine.generateRow(columns, rowIndex);
      streamingRowCountRef.current += 1;
      continuousBufferRef.current.push(newRow);

      if (activeMultiWriter) {
        try {
          await activeMultiWriter.writeRow(newRow, rowIndex);
        } catch (err) {
          console.error('Error writing streamed multi-file row:', err);
        }
      } else if (activeStreamWriter) {
        try {
          await activeStreamWriter.writeRow(newRow, rowIndex);
        } catch (err) {
          console.error('Error writing streamed row:', err);
        }
      }

      // Action Add-on Pipeline Execution (Concurrent with Stream Writing)
      if (actionConfig.enabled && actionConfig.endpointUrl.trim()) {
        const passesCondition = matchesTriggerCondition(newRow, actionConfig.triggerCondition);
        if (passesCondition) {
          if (actionConfig.mode === 'per_entry') {
            dispatchActionRequest(actionConfig, [newRow], rowIndex, addActionLog).catch((err) => {
              console.error('Action streaming dispatch error:', err);
            });
          } else {
            actionContinuousBufferRef.current.push(newRow);
            const targetBatchSize = Math.max(1, actionConfig.batchSize || 50);
            if (actionContinuousBufferRef.current.length >= targetBatchSize) {
              const chunk = [...actionContinuousBufferRef.current];
              actionContinuousBufferRef.current = [];
              const bIdx = actionBatchIndexRef.current++;
              dispatchActionRequest(actionConfig, chunk, bIdx, addActionLog).catch((err) => {
                console.error('Action streaming batch dispatch error:', err);
              });
            }
          }
        }
      }

      setPreviewData((prev) => [newRow, ...prev.slice(0, 49)]);

      const elapsedSec = (performance.now() - streamingStartTimeRef.current) / 1000;
      const rowsPerSec = Math.round(streamingRowCountRef.current / (elapsedSec || 0.001));
      const currentBytes = activeMultiWriter
        ? activeMultiWriter.getBytesWritten()
        : activeStreamWriter
        ? activeStreamWriter.getBytesWritten()
        : streamingRowCountRef.current * 128;

      setStats({
        rowsGenerated: streamingRowCountRef.current,
        rowsPerSec,
        elapsedSeconds: Math.floor(elapsedSec),
        fileSizeBytes: currentBytes,
        isGenerating: true,
      });

      const baseIndicator = activeMultiWriter && activeDir
        ? `Multi-File (${activeMultiWriter.getFilesCount()} files in /${activeDir.name})`
        : activeStreamWriter && activeDir
        ? `Direct Disk: /${activeDir.name}/${fullFilename}`
        : 'Buffer';

      const targetIndicator = actionConfig.enabled && actionConfig.endpointUrl.trim()
        ? `${baseIndicator} + Action (${actionConfig.method})`
        : baseIndicator;

      setStatusMessage(
        `Streaming [${targetIndicator}]: ${streamingRowCountRef.current.toLocaleString()} rows (${rowsPerSec} rows/sec)`
      );
    }, Math.max(20, intervalMs));
  };

  const handleStopContinuous = async () => {
    if (streamingTimerRef.current) {
      clearInterval(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
    setIsStreaming(false);

    if (actionConfig.enabled && actionConfig.mode === 'batch' && actionContinuousBufferRef.current.length > 0) {
      const remaining = [...actionContinuousBufferRef.current];
      actionContinuousBufferRef.current = [];
      const bIdx = actionBatchIndexRef.current++;
      try {
        await dispatchActionRequest(actionConfig, remaining, bIdx, addActionLog);
      } catch (err) {
        console.error('Error flushing final continuous action batch:', err);
      }
    }

    if (multiStreamWriterRef.current) {
      try {
        await multiStreamWriterRef.current.close();
        const totalFiles = multiStreamWriterRef.current.getFilesCount();
        const totalBytes = multiStreamWriterRef.current.getBytesWritten();
        addRecentFile({
          filename: `${filename || 'stream'}_(${totalFiles}_files).${format}`,
          format,
          rowCount: streamingRowCountRef.current,
          folderName: selectedFolderName,
          fileSizeBytes: totalBytes
        });
        if (selectedFolderName) {
          addRecentFolder(selectedFolderName);
        }
        setStatusMessage(
          `Stream complete! Successfully generated ${totalFiles.toLocaleString()} files (${streamingRowCountRef.current.toLocaleString()} rows) in "${selectedFolderName}" (${formatBytes(totalBytes)})`
        );
      } catch (err: any) {
        setStatusMessage(`Multi-file stream finished with notice: ${err.message}`);
      } finally {
        multiStreamWriterRef.current = null;
      }
    } else if (streamWriterRef.current) {
      try {
        await streamWriterRef.current.close();
        const totalBytes = streamWriterRef.current.getBytesWritten();
        const fullFilename = `${filename || 'stream_dataset'}.${format}`;
        addRecentFile({
          filename: fullFilename,
          format,
          rowCount: streamingRowCountRef.current,
          folderName: selectedFolderName,
          fileSizeBytes: totalBytes
        });
        if (selectedFolderName) {
          addRecentFolder(selectedFolderName);
        }
        setStatusMessage(
          `Stream complete! Successfully wrote ${streamingRowCountRef.current.toLocaleString()} records directly to "${selectedFolderName}/${fullFilename}" (${formatBytes(totalBytes)})`
        );
      } catch (err: any) {
        setStatusMessage(`Stream finished with notice: ${err.message}`);
      } finally {
        streamWriterRef.current = null;
      }
    } else if (continuousBufferRef.current.length > 0) {
      const output = formatDataset(columns, continuousBufferRef.current, format, tableName);
      const mime = getMimeType(format);
      const fullFilename = `${filename || 'stream_dataset'}_${continuousBufferRef.current.length}_rows.${format}`;
      downloadFile(output, fullFilename, mime);
      setStatusMessage(
        `Stream stopped. Exported ${continuousBufferRef.current.length.toLocaleString()} records to ${fullFilename}`
      );
    } else {
      setStatusMessage('Stream stopped.');
    }
  };

  const handlePresetSelect = (preset: PresetSchema) => {
    setColumns(preset.columns);
    setTableName(preset.tableName);
    setFilename(preset.tableName);
    setStatusMessage(`Loaded preset "${preset.name}" (${preset.columns.length} columns)`);
  };

  const handleImportSchema = (importedCols: ColumnSpec[], importedTableName?: string) => {
    setColumns(importedCols);
    if (importedTableName) {
      setTableName(importedTableName);
      setFilename(importedTableName);
    }
    setStatusMessage(`Imported schema with ${importedCols.length} columns`);
  };

  const handleApplyExtractedSchema = (
    extractedCols: ColumnSpec[],
    extractedTableName: string,
    append: boolean,
    importContext?: ImportedFileContext
  ) => {
    if (importContext) {
      setImportedContext(importContext);
      if (importContext.format) {
        setFormat(importContext.format);
      }
      setOutputStrategy('append_existing');
    }

    if (append) {
      const existingNames = new Set(columns.map((c) => c.name.toLowerCase()));
      const filtered = extractedCols.map((c) => {
        let uniqueName = c.name;
        let counter = 1;
        while (existingNames.has(uniqueName.toLowerCase())) {
          uniqueName = `${c.name}_${counter++}`;
        }
        existingNames.add(uniqueName.toLowerCase());
        return { ...c, name: uniqueName };
      });
      setColumns([...columns, ...filtered]);
      setStatusMessage(
        `Appended ${filtered.length} extracted field patterns to schema (Offline Engine)`
      );
    } else {
      setColumns(extractedCols);
      if (extractedTableName) {
        setTableName(extractedTableName);
        setFilename(extractedTableName);
      }
      setStatusMessage(
        importContext
          ? `Extracted pattern from "${importContext.filename}" (${importContext.totalRows.toLocaleString()} rows). Continuation set from row #${importContext.startingRowNumber}.`
          : `Extracted & applied ${extractedCols.length} field patterns for "${extractedTableName}" (Offline Engine)`
      );
    }
  };

  const handleApplyFolderRecommendations = (recs: {
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
  }) => {
    setOutputDestination('folder');
    setOutputStrategy(recs.strategy);
    setFormat(recs.format);
    if (recs.filename) setFilename(recs.filename);
    if (recs.tableName) setTableName(recs.tableName);
    if (recs.batchCount) setCount(recs.batchCount);
    if (recs.intervalMs) setIntervalMs(recs.intervalMs);
    if (recs.generationMode) setMode(recs.generationMode);

    if (recs.strategy === 'multi_file' && recs.filenamePattern) {
      setMultiFileConfig((prev) => ({
        ...prev,
        enabled: true,
        pattern: recs.filenamePattern!,
        rowsPerFile: recs.rowsPerFile || 1000,
        startIndex: 1,
      }));
    } else if (recs.strategy === 'append_existing' && recs.targetFile) {
      setAppendConfig((prev) => ({
        ...prev,
        targetFilename: recs.targetFile!,
      }));
    }

    if (recs.columns && recs.columns.length > 0) {
      setColumns(recs.columns);
    }

    if (recs.importedContext) {
      setImportedContext(recs.importedContext);
    }

    setStatusMessage(
      `Applied recommended ${recs.strategy} mode & ${recs.tableName || 'schema'} template for locked folder "${selectedFolderName || 'target'}" (Offline Heuristics)`
    );
  };

  // Render Schema Architect Sub-view
  const renderSchemaView = (isSplit = activeTab === 'split') => (
    <div className="flex-1 flex flex-col h-full w-full bg-primary overflow-hidden min-w-0">
      {/* Schema View Controls Bar */}
      <div className="relative z-30 flex items-center justify-between px-3 sm:px-4 h-10 min-h-[40px] max-h-[40px] border-b border-border-subtle bg-secondary flex-shrink-0 gap-2 select-none w-full min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <div className="flex items-center gap-1.5 text-content min-w-0">
            <SlidersHorizontal size={13} className="text-accent flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap truncate">
              {t('schema.fieldArchitecture')}
            </span>
          </div>
          <span className="text-[10px] bg-tertiary text-content-muted px-1.5 py-0.5 rounded-md font-mono border border-border-subtle/50 whitespace-nowrap flex-shrink-0">
            {columns.length} {columns.length === 1 ? t('schema.fieldSingle') : t('schema.fieldPlural')}
          </span>
        </div>

        {/* Search & Add Field */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink min-w-0 justify-end">
          <div className="min-w-0 flex-1 flex-shrink max-w-[130px] sm:max-w-[170px] lg:max-w-[210px]">
            <ColumnSearch 
              value={columnSearch} 
              onChange={setColumnSearch} 
              columns={columns}
              columnNames={columns.map(c => c.name)}
              compact={isSplit}
            />
          </div>
          <button
            type="button"
            onClick={() => handleAddColumn('String', '12')}
            className={`h-7 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center transition shadow-2xs whitespace-nowrap active:scale-95 cursor-pointer flex-shrink-0 z-10 ${
              isSplit
                ? 'w-7 px-0 xl:w-auto xl:px-2.5 xl:gap-1.5'
                : 'px-2.5 sm:px-3 gap-1.5'
            }`}
            title={t('schema.addColumn')}
            aria-label={t('schema.addColumn')}
          >
            <Plus size={13} strokeWidth={2.5} />
            {isSplit ? (
              <span className="hidden xl:inline">{t('schema.addColumn')}</span>
            ) : (
              <>
                <span className="hidden sm:inline">{t('schema.addColumn')}</span>
                <span className="sm:hidden">{t('common.apply')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Insert Category Strip */}
      <div className="px-2 sm:px-3 h-8 min-h-[32px] max-h-[32px] bg-secondary/50 border-b border-border-subtle flex items-center justify-between gap-1.5 text-[11px] flex-shrink-0 select-none w-full min-w-0 relative">
        {/* Fixed Prefix: Permanent label outside the scrolling container */}
        <div className="flex items-center gap-1.5 pr-2.5 mr-0.5 border-r border-border-subtle/80 flex-shrink-0 select-none">
          <Sparkles size={11} className="text-accent shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
            {t('schema.quickLabel')}
          </span>
        </div>

        {/* Scrollable Chips Track Wrapper with Dynamic Gradient Edge Masks */}
        <div className="relative flex-1 flex items-center min-w-0 overflow-hidden h-full">
          {/* Left Gradient Fade Mask */}
          <div 
            className={`pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-secondary to-transparent z-10 transition-opacity duration-200 ${
              canScrollChipsLeft ? 'opacity-100' : 'opacity-0'
            }`} 
          />

          {/* Left Scroll Arrow */}
          {canScrollChipsLeft && (
            <button
              type="button"
              onClick={() => scrollQuickChips('left')}
              className="absolute left-0 z-20 h-5 w-5 rounded bg-primary/90 hover:bg-tertiary text-content-muted hover:text-content flex items-center justify-center border border-border-subtle/70 shadow-xs cursor-pointer transition-all"
              title="Scroll left (or use mouse wheel)"
              aria-label="Scroll left"
            >
              <ChevronLeft size={11} />
            </button>
          )}

          {/* Scrollable Track */}
          <div 
            ref={quickChipsRef}
            onScroll={updateChipsScrollStatus}
            onWheel={handleChipsWheel}
            onMouseDown={handleChipsMouseDown}
            onMouseMove={handleChipsMouseMove}
            onMouseUp={handleChipsMouseUp}
            onMouseLeave={handleChipsMouseUp}
            className={`flex items-center gap-1.5 flex-nowrap overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden scroll-smooth flex-1 min-w-0 py-0.5 cursor-grab active:cursor-grabbing select-none ${
              canScrollChipsLeft ? 'pl-6' : 'pl-0.5'
            } ${canScrollChipsRight ? 'pr-6' : 'pr-0.5'}`}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Sequence', '1000');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Auto-incrementing Sequence ID"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span>{t('schema.quickId')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Entity', 'full_name');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Full Name Entity"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{t('schema.quickName')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Entity', 'email');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Email Address Entity"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              <span>{t('schema.quickEmail')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Float', '10.0, 500.0, 2');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Price / Amount Currency Field"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{t('schema.quickPrice')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('DateTime', 'YYYY-MM-DD HH:mm:ss');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Timestamp / Date-Time Field"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span>{t('schema.quickTimestamp')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('UUID', '');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add UUID v4 GUID Field"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
              <span>{t('schema.quickUuid')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Set/Enum', 'Active:70, Pending:20, Inactive:10');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Weighted Enum / Status Set"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
              <span>{t('schema.quickEnum')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Boolean', '0.5');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Boolean True/False Flag"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>{t('schema.quickBool')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('Calculation', '');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add Formula / Expression Column"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{t('schema.quickFormula')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (chipsDragState.current.hasDragged) return;
                handleAddColumn('REST_API');
              }}
              className="h-6 px-2 rounded-md bg-primary/60 hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle/70 hover:border-accent/40 transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Add REST API Column"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span>{t('schema.quickRestApi')}</span>
            </button>
          </div>

          {/* Right Gradient Fade Mask */}
          <div 
            className={`pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-secondary to-transparent z-10 transition-opacity duration-200 ${
              canScrollChipsRight ? 'opacity-100' : 'opacity-0'
            }`} 
          />

          {/* Right Scroll Arrow */}
          {canScrollChipsRight && (
            <button
              type="button"
              onClick={() => scrollQuickChips('right')}
              className="absolute right-0 z-20 h-5 w-5 rounded bg-primary/90 hover:bg-tertiary text-content-muted hover:text-content flex items-center justify-center border border-border-subtle/70 shadow-xs cursor-pointer transition-all"
              title="Scroll right (or use mouse wheel)"
              aria-label="Scroll right"
            >
              <ChevronRight size={11} />
            </button>
          )}
        </div>

        {/* Right: Quick Tools & Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 pl-2 border-l border-border-subtle/70">
          <button
            type="button"
            onClick={() => setIsPresetsOpen(true)}
            className="h-6 px-2 rounded-md hover:bg-tertiary text-content-muted hover:text-content transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            title="Browse schema presets"
          >
            <Layers size={11} className="text-accent" />
            <span>{t('schema.quickPresets')}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setIsOfflineExtractorOpen(true)}
            className="h-6 px-2 rounded-md hover:bg-tertiary text-content-muted hover:text-content transition-all whitespace-nowrap text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            title="Extract schema from CSV or Excel file"
          >
            <FileSpreadsheet size={11} className="text-emerald-500" />
            <span>{t('schema.quickExtract')}</span>
          </button>
        </div>
      </div>

      {/* Virtual Columns List */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-2.5 relative"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, type: 'container' });
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDropFile}
      >
        {/* Active Drag & Drop Spreadsheet Overlay */}
        {isDraggingFile && (
          <div className="absolute inset-3 z-40 rounded-2xl border-2 border-dashed border-emerald-500 bg-secondary/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 shadow-2xl animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="p-4 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-3 animate-bounce shadow-lg">
              <FileSpreadsheet size={36} />
            </div>
            <h3 className="text-base font-bold text-content">
              Drop Excel (.xlsx, .xls) or CSV to Extract Schema Architecture
            </h3>
            <p className="text-xs text-content-muted mt-1 max-w-sm">
              Instant offline extraction of field types, categorical enums, regex patterns, and null distributions.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                Zero Cloud Uploads
              </span>
            </div>
          </div>
        )}

        {filteredColumns.length === 0 ? (
          <div 
            className={`flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer group ${
              isDraggingFile 
                ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01] ring-4 ring-emerald-500/20 shadow-xl' 
                : 'border-border-subtle hover:border-accent/60 bg-secondary/30 hover:bg-secondary/60'
            }`}
            onClick={() => schemaFileInputRef.current?.click()}
          >
            <input
              ref={schemaFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProcessSpreadsheetFile(file);
                e.target.value = '';
              }}
            />
            <div className="p-4 rounded-2xl bg-accent/10 text-accent border border-accent/20 mb-3 shadow-inner group-hover:scale-105 group-hover:border-accent/40 group-hover:bg-accent/15 transition-all">
              <FileSpreadsheet size={32} className="text-accent" />
            </div>
            <h3 className="text-sm font-bold text-content">
              {isDraggingFile ? t('schema.releaseToExtract') : t('schema.dragDropSpreadsheet')}
            </h3>
            <p className="text-xs text-content-muted max-w-md mt-1 mb-4 leading-relaxed">
              {t('schema.emptySubtitle')}
            </p>
            <div className="flex gap-2 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => schemaFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
              >
                <Upload size={13} />
                <span>{t('schema.browseExcelCsv')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddColumn('String', '12')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition"
              >
                <Plus size={13} />
                <span>{t('schema.addFirstField')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPresetsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border-subtle text-xs font-semibold text-content hover:bg-tertiary transition"
              >
                <Layers size={13} className="text-accent" />
                <span>{t('schema.browsePresets')}</span>
              </button>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns-list" isDropDisabled={!!columnSearch}>
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2.5"
                >
                  {filteredColumns.map((col, idx) => {
                    const DraggableItem = Draggable as any;
                    return (
                    <DraggableItem
                      key={col.id}
                      draggableId={col.id}
                      index={idx}
                      isDragDisabled={!!columnSearch}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          <ColumnCard
                            col={col}
                            index={idx}
                            totalColumns={columns.length}
                            columns={columns}
                            onUpdate={handleUpdateColumn}
                            onRemove={handleRemoveColumn}
                            onDuplicate={handleDuplicateColumn}
                            dragHandleProps={provided.dragHandleProps}
                            onContextMenu={(e, id) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, colId: id, type: 'column' });
                            }}
                          />
                        </div>
                      )}
                    </DraggableItem>
                  )})}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );

  // Render Preview Sub-view
  const renderPreviewView = () => (
    <div className="flex-1 h-full overflow-hidden bg-primary">
      <PreviewTable
        columns={columns}
        data={previewData}
        isStreaming={isStreaming}
        onRefreshPreview={refreshPreview}
        previewCount={previewCount}
        onChangePreviewCount={setPreviewCount}
        theme={theme}
      />
    </div>
  );

  if (role === 'operator') {
    return (
      <div className={`min-h-screen ${theme}`}>
        <OperatorMonitorView onOpenInDeveloperStudio={handleApplyProfileBundle} />
        <RoleOnboardingModal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-primary text-content font-sans select-none">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalColumns={columns.length}
        previewRowCount={previewData.length}
        tableName={tableName}
        setTableName={setTableName}
        columns={columns}
        setColumns={setColumns}
        format={format}
        setFormat={setFormat}
        count={count}
        setCount={setCount}
        intervalMs={intervalMs}
        setIntervalMs={setIntervalMs}
        selectedFolderName={selectedFolderName}
        onSelectFolder={handleSelectFolder}
        onClearFolder={handleClearFolder}
        onImportSchema={handleImportSchema}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenOfflineExtractor={() => setIsOfflineExtractorOpen(true)}
        onOpenFolderMonitor={() => setIsFolderMonitorOpen(true)}
        onOpenImportBundle={() => setIsBundleImportModalOpen(true)}
        onOpenRestApiModal={() => {
          setRestApiModalTab('row');
          setIsRestApiModalOpen(true);
        }}
        isStreaming={isStreaming}
        isGeneratingBatch={isGeneratingBatch}
        theme={theme}
        setTheme={setTheme}
        setStatusMessage={setStatusMessage}
      />

      {/* Multi-Project Workspace Tab Bar (IDE / Browser Tabs - collapses completely when in sidebar mode) */}
      {displayMode === 'top-bar' && (
        <WorkspaceTabBar
          onOpenImportBundle={() => setIsBundleImportModalOpen(true)}
          onOpenPresets={() => setIsPresetsOpen(true)}
          onOpenFolderMonitor={() => setIsFolderMonitorOpen(true)}
        />
      )}

      {/* Production Profile Banner */}
      {profileBannerInfo && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/25 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300 flex-shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">
              <strong>Profile Loaded:</strong> {profileBannerInfo.folderName} ({profileBannerInfo.platform.toUpperCase()}) · Encoding: <strong>{profileBannerInfo.encoding}</strong> · Delimiter: <strong>{profileBannerInfo.delimiter || 'N/A'}</strong> · Lock: <strong>{profileBannerInfo.lockStatus === 'no_lock_detected' ? 'Clean' : 'Active write'}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setProfileBannerInfo(null)}
            className="text-xs text-emerald-400 hover:text-white transition cursor-pointer shrink-0 ml-2 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace with Toggleable Tab Views and Sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Workspace Sidebar Drawer (when in sidebar display mode) */}
        {displayMode === 'sidebar' && <WorkspaceSidebarDrawer />}

        {/* Tab View Container */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {activeTab === 'schema' && renderSchemaView(false)}
          {activeTab === 'preview' && renderPreviewView()}
          {activeTab === 'split' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 min-w-0">
              <div className="w-full md:w-1/2 flex-1 md:flex-initial flex flex-col border-b md:border-b-0 md:border-r border-border-subtle overflow-hidden min-h-0 min-w-0">
                {renderSchemaView(true)}
              </div>
              <div className="w-full md:w-1/2 flex-1 md:flex-initial flex flex-col overflow-hidden min-h-0 min-w-0">
                {renderPreviewView()}
              </div>
            </div>
          )}
        </div>

        {/* Toggleable Generation Deck Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          mode={mode}
          setMode={setMode}
          outputDestination={outputDestination}
          setOutputDestination={setOutputDestination}
          actionConfig={actionConfig}
          setActionConfig={setActionConfig}
          onOpenActionConfig={() => setIsActionConfigModalOpen(true)}
          onOpenActionLogs={() => setIsActionLogModalOpen(true)}
          actionStats={actionStats}
          sampleColumns={columns}
          outputStrategy={outputStrategy}
          setOutputStrategy={setOutputStrategy}
          multiFileConfig={multiFileConfig}
          setMultiFileConfig={setMultiFileConfig}
          appendConfig={appendConfig}
          setAppendConfig={setAppendConfig}
          onAttachAppendFile={handleAttachAppendTargetFile}
          onOpenOfflineExtractor={() => setIsOfflineExtractorOpen(true)}
          onOpenFolderMonitor={() => setIsFolderMonitorOpen(true)}
          importedContext={importedContext}
          onSetImportedContext={setImportedContext}
          onClearImportedContext={() => {
            setImportedContext(null);
            setOutputStrategy('single');
            setStatusMessage('Detached imported file context. Generating in standalone mode.');
          }}
          selectedFolderName={selectedFolderName}
          onSelectFolder={handleSelectFolder}
          onClearFolder={handleClearFolder}
          filename={filename}
          setFilename={setFilename}
          format={format}
          setFormat={setFormat}
          tableName={tableName}
          setTableName={setTableName}
          count={count}
          setCount={setCount}
          intervalMs={intervalMs}
          setIntervalMs={setIntervalMs}
          isStreaming={isStreaming}
          isGeneratingBatch={isGeneratingBatch}
          batchProgress={batchProgress}
          stats={stats}
          statusMessage={statusMessage}
          totalColumns={columns.length}
          onStart={mode === 'Batch' ? handleStartBatch : handleStartContinuous}
          onStop={handleStopContinuous}
        />
      </div>

      {/* Preset Schemas Modal */}
      <PresetSelector
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={handlePresetSelect}
        currentColumns={columns}
        onImportSchema={handleImportSchema}
        tableName={tableName}
      />

      {/* 100% Offline Excel / CSV Pattern Architecture Extractor Modal */}
      {isOfflineExtractorOpen && (
        <OfflineExtractorModal
          isOpen={isOfflineExtractorOpen}
          onClose={() => {
            setIsOfflineExtractorOpen(false);
            setExtractorInitialFile(null);
            setExtractorAutoExtract(false);
          }}
          onApplySchema={handleApplyExtractedSchema}
          currentColumnsCount={columns.length}
          existingColumns={columns}
          initialFile={extractorInitialFile}
          onClearInitialFile={() => setExtractorInitialFile(null)}
          autoExtract={extractorAutoExtract}
        />
      )}

      {/* Target Folder Selection & Fallback Modal */}
      <FolderSelectModal
        isOpen={isFolderSelectModalOpen}
        onClose={() => {
          setIsFolderSelectModalOpen(false);
          setFolderModalErrorNotice(null);
        }}
        onSelectFolder={(handle, name) => {
          setDirectoryHandle(handle);
          setSelectedFolderName(name);
          setOutputDestination('folder');
          addRecentFolder(name);
          setStatusMessage(`Target folder locked on "${name}". Ready for output.`);
        }}
        currentFolderName={selectedFolderName}
        recentFolders={getRecentFolders().map((f) => f.name)}
        initialErrorNotice={folderModalErrorNotice}
      />

      {/* 100% Offline Target Folder Behavior Monitor & Mode Recommender Modal */}
      {isFolderMonitorOpen && (
        <FolderMonitorModal
          isOpen={isFolderMonitorOpen}
          onClose={() => setIsFolderMonitorOpen(false)}
          currentDirectoryHandle={directoryHandle}
          currentFolderName={selectedFolderName}
          onSelectLockedFolder={(handle, name) => {
            setDirectoryHandle(handle);
            setSelectedFolderName(name);
            addRecentFolder(name);
            setOutputDestination('folder');
          }}
          onApplyRecommendations={handleApplyFolderRecommendations}
          currentStrategy={outputStrategy}
          currentFormat={format}
          currentColumnsCount={columns.length}
        />
      )}

      {/* REST API Live Retrieval Modal (Column & Row Level) */}
      <RestApiConfigModal
        isOpen={isRestApiModalOpen}
        onClose={() => setIsRestApiModalOpen(false)}
        initialTab={restApiModalTab}
        columns={columns}
        onSaveColumnConfig={(colId, config) => {
          setColumns((prev) =>
            prev.map((c) => {
              if (c.id === colId) {
                return {
                  ...c,
                  type: 'REST_API',
                  rule: serializeRestApiConfig(config),
                };
              }
              return c;
            })
          );
          setStatusMessage('Updated column with live REST API endpoint configuration.');
          refreshPreview();
        }}
        onImportRowColumns={(newCols, fetchedRows) => {
          setColumns((prev) => [...prev, ...newCols]);
          if (fetchedRows && fetchedRows.length > 0) {
            setPreviewData(fetchedRows.slice(0, previewCount));
            setStatusMessage(
              `Added ${newCols.length} REST API columns and loaded ${fetchedRows.length} live records!`
            );
          } else {
            setStatusMessage(
              `Added ${newCols.length} REST API columns linked to remote endpoint.`
            );
          }
        }}
        setStatusMessage={setStatusMessage}
      />

      {/* Action Destination Config Modal */}
      <ActionConfigModal
        isOpen={isActionConfigModalOpen}
        onClose={() => setIsActionConfigModalOpen(false)}
        config={actionConfig}
        onSaveConfig={(updated) => {
          setActionConfig(updated);
          setStatusMessage('Updated Action Destination settings.');
        }}
        sampleColumns={columns}
      />

      {/* Action Delivery Logs & Dead-Letter Modal */}
      <ActionLogModal
        isOpen={isActionLogModalOpen}
        onClose={() => setIsActionLogModalOpen(false)}
        logs={actionLogs}
        stats={actionStats}
        config={actionConfig}
        columns={columns}
        onClearLogs={handleClearActionLogs}
        onRetryFailedRecords={handleRetryFailedRecords}
      />

      {/* Developer Workspace Bundle Importer Modal */}
      <WorkspaceBundleImportModal
        isOpen={isBundleImportModalOpen}
        onClose={() => setIsBundleImportModalOpen(false)}
        onApplyBundle={handleApplyProfileBundle}
        onApplyAsNewWorkspace={handleApplyAsNewWorkspace}
      />

      {/* Role Onboarding Modal */}
      <RoleOnboardingModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />

      {/* Multi-Project Workspace Switcher & Settings Modals */}
      <WorkspaceQuickSwitcherModal />
      <WorkspaceSettingsModal />
      <UnsavedChangesPromptModal />

      {/* Context Menu Overlay */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div 
            key="context-menu-popover"
            initial={{ opacity: 0, scale: 0.93, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="fixed z-50 min-w-[200px] bg-primary border border-border-subtle rounded-xl shadow-2xl overflow-hidden text-sm"
            style={{ 
              top: contextMenu.y, 
              left: contextMenu.x,
              // Ensure it doesn't bleed off screen easily:
              transform: `translate(${contextMenu.x > window.innerWidth - 250 ? '-100%' : '0'}, ${contextMenu.y > window.innerHeight - 300 ? '-100%' : '0'})` 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col py-1">
              {contextMenu.type === 'column' ? (
                <>
                  <button
                    onClick={() => handleContextMenuAction('top', contextMenu.colId)}
                    className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
                  >
                    <ArrowUpToLine size={14} className="text-content-muted" /> Move to Top
                  </button>
                  <button
                    onClick={() => handleContextMenuAction('bottom', contextMenu.colId)}
                    className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
                  >
                    <ArrowDownToLine size={14} className="text-content-muted" /> Move to Bottom
                  </button>
                  <div className="h-px bg-border-subtle my-1"></div>
                  <button
                    onClick={() => handleContextMenuAction('cut', contextMenu.colId)}
                    className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
                  >
                    <Scissors size={14} className="text-content-muted" /> Cut
                  </button>
                  <button
                    onClick={() => handleContextMenuAction('copy', contextMenu.colId)}
                    className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
                  >
                    <Files size={14} className="text-content-muted" /> Copy
                  </button>
                  <button
                    onClick={() => handleContextMenuAction('paste-before', contextMenu.colId)}
                    disabled={!clipboard}
                    className={`flex items-center gap-3 px-3 py-2 transition ${!clipboard ? 'text-content-muted opacity-50 cursor-not-allowed' : 'text-content hover:bg-secondary'}`}
                  >
                    <ClipboardPaste size={14} className="text-content-muted" /> Paste Before
                  </button>
                  <button
                    onClick={() => handleContextMenuAction('paste-after', contextMenu.colId)}
                    disabled={!clipboard}
                    className={`flex items-center gap-3 px-3 py-2 transition ${!clipboard ? 'text-content-muted opacity-50 cursor-not-allowed' : 'text-content hover:bg-secondary'}`}
                  >
                    <ClipboardPaste size={14} className="text-content-muted" /> Paste After
                  </button>
                  <div className="h-px bg-border-subtle my-1"></div>
                  <button
                    onClick={() => handleContextMenuAction('duplicate', contextMenu.colId)}
                    className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
                  >
                    <CopyPlus size={14} className="text-content-muted" /> Duplicate
                  </button>
                  <button
                    onClick={() => handleContextMenuAction('remove', contextMenu.colId)}
                    className="flex items-center gap-3 px-3 py-2 text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleContextMenuAction('paste-append')}
                  disabled={!clipboard}
                  className={`flex items-center gap-3 px-3 py-2 transition ${!clipboard ? 'text-content-muted opacity-50 cursor-not-allowed' : 'text-content hover:bg-secondary'}`}
                >
                  <ClipboardPaste size={14} className="text-content-muted" /> Paste (Append)
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
