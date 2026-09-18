import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ColumnSpec, ExportFormat, OutputDestination, PresetSchema, GeneratorStats, ThemeId } from './types';
import { GeneratorEngine } from './utils/generator';
import { formatDataset, downloadFile, getMimeType, formatBytes } from './utils/export';
import { 
  requestDirectoryHandle, 
  writeBatchToDirectory, 
  createStreamFileWriter, 
  StreamFileWriter 
} from './utils/fileSystem';
import { PRESET_SCHEMAS } from './data/presets';
import { Header, WorkspaceTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ColumnCard } from './components/ColumnCard';
import { ColumnSearch } from './components/ColumnSearch';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const PreviewTable = lazy(() => import('./components/PreviewTable').then(module => ({ default: module.PreviewTable })));
const PresetSelector = lazy(() => import('./components/PresetSelector').then(module => ({ default: module.PresetSelector })));
const OfflineExtractorModal = lazy(() => import('./components/OfflineExtractorModal').then(module => ({ default: module.OfflineExtractorModal })));

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
  Upload
} from 'lucide-react';

const INITIAL_DEMO: ColumnSpec[] = PRESET_SCHEMAS[0].columns;

export default function App() {
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

  // Presets Modal
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Offline Pattern Extractor Modal
  const [isOfflineExtractorOpen, setIsOfflineExtractorOpen] = useState(false);
  const [extractorInitialFile, setExtractorInitialFile] = useState<File | null>(null);
  const [extractorAutoExtract, setExtractorAutoExtract] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);
  const schemaFileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessSpreadsheetFile = (file: File) => {
    const name = file.name.toLowerCase();
    const isValid =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      name.endsWith('.csv') ||
      name.endsWith('.tsv') ||
      name.endsWith('.txt');
    if (!isValid) {
      setStatusMessage(`Please drop an Excel (.xlsx, .xls) or CSV file.`);
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

  // Real-time preview generation whenever columns or previewCount changes
  const refreshPreview = () => {
    if (columns.length === 0) {
      setPreviewData([]);
      return;
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

  // Folder picker workflow
  const handleSelectFolder = async () => {
    try {
      const handle = await requestDirectoryHandle();
      if (handle) {
        setDirectoryHandle(handle);
        setSelectedFolderName(handle.name);
        setOutputDestination('folder');
        setStatusMessage(`Selected folder "${handle.name}". Ready for direct writes.`);
      }
    } catch (err: any) {
      console.warn('Folder selection notice:', err);
      setStatusMessage(`Notice: ${err.message || 'Could not select folder'}`);
    }
  };

  const handleClearFolder = () => {
    setDirectoryHandle(null);
    setSelectedFolderName(null);
    setOutputDestination('download');
    setStatusMessage('Switched back to Browser Download mode.');
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

  const handleAddColumn = (type: ColumnSpec['type'] = 'String', defaultRule: string = '12') => {
    const nextNum = columns.length + 1;
    const newCol: ColumnSpec = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      name: `field_${nextNum}`,
      type,
      rule: defaultRule,
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

    let activeDir = directoryHandle;
    if (outputDestination === 'folder' && !activeDir) {
      try {
        const handle = await requestDirectoryHandle();
        if (!handle) {
          setStatusMessage('Folder selection was cancelled. Generation aborted.');
          return;
        }
        setDirectoryHandle(handle);
        setSelectedFolderName(handle.name);
        activeDir = handle;
      } catch (err: any) {
        setStatusMessage(`Folder selection error: ${err.message}`);
        return;
      }
    }

    setIsGeneratingBatch(true);
    setBatchProgress(0);
    setStatusMessage(
      outputDestination === 'folder' && activeDir
        ? `Synthesizing ${count.toLocaleString()} records for direct write to "${activeDir.name}"...`
        : `Synthesizing ${count.toLocaleString()} records for browser download...`
    );

    const startTime = performance.now();
    const batchEngine = new GeneratorEngine();
    const allRows: Record<string, unknown>[] = [];
    const CHUNK_SIZE = 5000;
    let generated = 0;

    const processChunk = async () => {
      const remaining = count - generated;
      const thisBatch = Math.min(CHUNK_SIZE, remaining);

      for (let i = 0; i < thisBatch; i++) {
        allRows.push(batchEngine.generateRow(columns, generated + i));
      }
      generated += thisBatch;
      setBatchProgress(Math.floor((generated / count) * 100));

      if (generated < count) {
        setTimeout(processChunk, 0);
      } else {
        const elapsed = performance.now() - startTime;
        const elapsedSec = elapsed / 1000;
        const rowsPerSec = Math.round(count / (elapsedSec || 0.001));

        const output = formatDataset(columns, allRows, format, tableName);
        const mime = getMimeType(format);
        const fullFilename = `${filename || 'dataset'}.${format}`;
        const byteSize = new Blob([output]).size;

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

        // Update preview with first rows
        setPreviewData(allRows.slice(0, previewCount));

        setStats({
          rowsGenerated: count,
          rowsPerSec,
          elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
          fileSizeBytes: byteSize,
          isGenerating: false,
        });

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

    let activeDir = directoryHandle;
    if (outputDestination === 'folder' && !activeDir) {
      try {
        const handle = await requestDirectoryHandle();
        if (!handle) {
          setStatusMessage('Folder selection was cancelled. Stream aborted.');
          return;
        }
        setDirectoryHandle(handle);
        setSelectedFolderName(handle.name);
        activeDir = handle;
      } catch (err: any) {
        setStatusMessage(`Folder selection notice: ${err.message}`);
        return;
      }
    }

    const fullFilename = `${filename || 'stream_dataset'}.${format}`;
    let activeStreamWriter: StreamFileWriter | null = null;

    if (outputDestination === 'folder' && activeDir) {
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

    setIsStreaming(true);
    streamingStartTimeRef.current = performance.now();
    streamingRowCountRef.current = 0;
    continuousBufferRef.current = [];
    const streamEngine = new GeneratorEngine();

    const destLabel = activeStreamWriter && activeDir
      ? `Live Disk Writer: /${activeDir.name}/${fullFilename}`
      : 'In-Memory Buffer';

    setStatusMessage(`Stream Active [${destLabel}] at ${intervalMs}ms...`);

    streamingTimerRef.current = window.setInterval(async () => {
      const rowIndex = streamingRowCountRef.current;
      const newRow = streamEngine.generateRow(columns, rowIndex);
      streamingRowCountRef.current += 1;
      continuousBufferRef.current.push(newRow);

      if (activeStreamWriter) {
        try {
          await activeStreamWriter.writeRow(newRow, rowIndex);
        } catch (err) {
          console.error('Error writing streamed row:', err);
        }
      }

      setPreviewData((prev) => [newRow, ...prev.slice(0, 49)]);

      const elapsedSec = (performance.now() - streamingStartTimeRef.current) / 1000;
      const rowsPerSec = Math.round(streamingRowCountRef.current / (elapsedSec || 0.001));
      const currentBytes = activeStreamWriter
        ? activeStreamWriter.getBytesWritten()
        : streamingRowCountRef.current * 128;

      setStats({
        rowsGenerated: streamingRowCountRef.current,
        rowsPerSec,
        elapsedSeconds: Math.floor(elapsedSec),
        fileSizeBytes: currentBytes,
        isGenerating: true,
      });

      const targetIndicator = activeStreamWriter && activeDir
        ? `Direct Disk: /${activeDir.name}/${fullFilename}`
        : 'Buffer';

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

    if (streamWriterRef.current) {
      try {
        await streamWriterRef.current.close();
        const totalBytes = streamWriterRef.current.getBytesWritten();
        const fullFilename = `${filename || 'stream_dataset'}.${format}`;
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
    append: boolean
  ) => {
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
        `Extracted & applied ${extractedCols.length} field patterns for "${extractedTableName}" (Offline Engine)`
      );
    }
  };

  // Render Schema Architect Sub-view
  const renderSchemaView = () => (
    <div className="flex flex-col h-full bg-primary overflow-hidden">
      {/* Schema View Controls Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 border-b border-border-subtle bg-secondary flex-shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-content whitespace-nowrap">
            Field Architecture
          </span>
          <span className="text-[10px] bg-tertiary text-content-muted px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
            {columns.length} fields
          </span>
        </div>

        {/* Search & Add Field */}
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnSearch 
            value={columnSearch} 
            onChange={setColumnSearch} 
            columnNames={columns.map(c => c.name)}
          />
          <button
            type="button"
            onClick={() => handleAddColumn('String', '12')}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition shadow-xs whitespace-nowrap"
          >
            <Plus size={13} />
            <span>Add Field</span>
          </button>
        </div>
      </div>

      {/* Quick Insert Category Strip */}
      <div className="px-4 py-1.5 bg-secondary/40 border-b border-border-subtle flex items-center gap-1.5 overflow-x-auto text-[11px] flex-shrink-0">
        <span className="text-content-muted text-[10px] uppercase font-bold tracking-wider mr-1 flex-shrink-0">
          Quick:
        </span>
        <button
          onClick={() => handleAddColumn('Sequence', '1000')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + ID
        </button>
        <button
          onClick={() => handleAddColumn('Entity', 'full_name')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + Name
        </button>
        <button
          onClick={() => handleAddColumn('Entity', 'email')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + Email
        </button>
        <button
          onClick={() => handleAddColumn('Float', '10.0, 500.0, 2')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + Price
        </button>
        <button
          onClick={() => handleAddColumn('DateTime', 'YYYY-MM-DD HH:mm:ss')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + Timestamp
        </button>
        <button
          onClick={() => handleAddColumn('UUID', '')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + UUID
        </button>
        <button
          onClick={() => handleAddColumn('Set/Enum', 'Active:70, Pending:20, Inactive:10')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + Enum
        </button>
        <button
          onClick={() => handleAddColumn('Calculation', '')}
          className="px-2 py-0.5 rounded bg-primary hover:bg-tertiary text-content hover:text-accent border border-border-subtle transition whitespace-nowrap text-xs"
        >
          + Formula
        </button>

        <span className="text-border-subtle">|</span>

        <button
          type="button"
          onClick={() => setIsOfflineExtractorOpen(true)}
          className="px-2 py-0.5 rounded bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition whitespace-nowrap text-xs font-semibold flex items-center gap-1 shadow-2xs"
          title="Import Excel or CSV offline to extract field architecture patterns"
        >
          <FileSpreadsheet size={12} className="text-emerald-400" />
          <span>Extract Excel/CSV</span>
        </button>
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
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                100% Client-Side
              </span>
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
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3 shadow-inner group-hover:scale-105 transition-transform">
              <FileSpreadsheet size={32} />
            </div>
            <h3 className="text-sm font-bold text-content">
              {isDraggingFile ? 'Release to Extract Schema Architecture' : 'Drag & drop Excel (.xlsx, .xls) or CSV here'}
            </h3>
            <p className="text-xs text-content-muted max-w-md mt-1 mb-4 leading-relaxed">
              Drop any real-world spreadsheet to automatically extract column architecture, categorical enums, and synthetic generators offline.
            </p>
            <div className="flex gap-2 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => schemaFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
              >
                <Upload size={13} />
                <span>Browse Excel / CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddColumn('String', '12')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition"
              >
                <Plus size={13} />
                <span>Add First Field</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPresetsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border-subtle text-xs font-semibold text-content hover:bg-tertiary transition"
              >
                <Layers size={13} className="text-accent" />
                <span>Browse Presets</span>
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
      <Suspense fallback={<div className="flex items-center justify-center h-full text-content-muted">Loading preview...</div>}>
        <PreviewTable
          columns={columns}
          data={previewData}
          isStreaming={isStreaming}
          onRefreshPreview={refreshPreview}
          previewCount={previewCount}
          onChangePreviewCount={setPreviewCount}
          theme={theme}
        />
      </Suspense>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-primary text-content font-sans select-none">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalColumns={columns.length}
        previewRowCount={previewData.length}
        tableName={tableName}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenOfflineExtractor={() => setIsOfflineExtractorOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isStreaming={isStreaming}
        isGeneratingBatch={isGeneratingBatch}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main Workspace with Toggleable Tab Views and Sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Tab View Container */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {activeTab === 'schema' && renderSchemaView()}
          {activeTab === 'preview' && renderPreviewView()}
          {activeTab === 'split' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-border-subtle overflow-hidden min-h-0">
                {renderSchemaView()}
              </div>
              <div className="w-full md:w-1/2 flex flex-col overflow-hidden min-h-0">
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
      <Suspense fallback={null}>
        <PresetSelector
          isOpen={isPresetsOpen}
          onClose={() => setIsPresetsOpen(false)}
          onSelectPreset={handlePresetSelect}
          currentColumns={columns}
          onImportSchema={handleImportSchema}
          tableName={tableName}
        />
      </Suspense>

      {/* 100% Offline Excel / CSV Pattern Architecture Extractor Modal */}
      <Suspense fallback={null}>
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
            initialFile={extractorInitialFile}
            onClearInitialFile={() => setExtractorInitialFile(null)}
            autoExtract={extractorAutoExtract}
          />
        )}
      </Suspense>

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
