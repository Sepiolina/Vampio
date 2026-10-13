import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ColumnSpec,
  ExportFormat,
  OutputStrategy,
  MultiFileConfig,
  AppendConfig,
  ActionConfig,
  WorkspaceProfile,
} from '../types';
import { GeneratorEngine } from '../utils/generator';
import {
  downloadDataset,
  downloadFile,
  getMimeType,
  appendRowsToWorkbook,
  appendRowsToTextFile,
  createZipArchive,
  formatSingleFileUnit,
  resolveMultiFilename,
} from '../utils/export';
import {
  writeBatchToDirectory,
  writeMultipleFilesToDirectory,
  createStreamFileWriter,
  createMultiFileStreamWriter,
  StreamFileWriter,
  MultiFileStreamWriter,
  pickDirectory,
  createVirtualDirectoryHandle,
} from '../utils/fileSystem';
import { prefetchRestApiBatch } from '../utils/restApiManager';
import { addRecentFile, addRecentFolder } from '../utils/sessionManager';

export interface GenerationStats {
  rowsGenerated: number;
  rowsPerSec: number;
  elapsedSeconds: number;
  fileSizeBytes: number;
  isGenerating: boolean;
}

export interface ImportedFileContext {
  filename: string;
  totalRows: number;
  startingRowNumber: number;
  rawWorkbook?: any;
  rawContent?: string;
  targetSheetName?: string;
}

export interface UseDatasetGeneratorProps {
  columns: ColumnSpec[];
  count: number;
  filename: string;
  format: ExportFormat;
  tableName: string;
  outputStrategy: OutputStrategy;
  outputDestination: 'download' | 'folder';
  directoryHandle: any | null;
  selectedFolderName: string | null;
  multiFileConfig: MultiFileConfig;
  appendConfig: AppendConfig;
  importedContext: ImportedFileContext | null;
  setImportedContext: (ctx: ImportedFileContext | null) => void;
  actionConfig: ActionConfig;
  activeWorkspace?: WorkspaceProfile | null;
}

export function useDatasetGenerator({
  columns,
  count,
  filename,
  format,
  tableName,
  outputStrategy,
  outputDestination,
  directoryHandle,
  selectedFolderName,
  multiFileConfig,
  appendConfig,
  importedContext,
  setImportedContext,
  actionConfig,
  activeWorkspace,
}: UseDatasetGeneratorProps) {
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isGeneratingStream, setIsGeneratingStream] = useState(false);
  const [isStreamingPaused, setIsStreamingPaused] = useState(false);
  const [streamRowsGenerated, setStreamRowsGenerated] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [stats, setStats] = useState<GenerationStats>({
    rowsGenerated: 0,
    rowsPerSec: 0,
    elapsedSeconds: 0,
    fileSizeBytes: 0,
    isGenerating: false,
  });

  const streamIntervalRef = useRef<any>(null);
  const streamWriterRef = useRef<StreamFileWriter | null>(null);
  const multiWriterRef = useRef<MultiFileStreamWriter | null>(null);
  const batchCancelledRef = useRef<boolean>(false);
  // Ref mirror: the setInterval callback closes over the first render's state, so reading
  // `isStreamingPaused` there never saw updates and Pause did nothing.
  const isPausedRef = useRef<boolean>(false);
  const streamRowsRef = useRef<number>(0);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Ensure active directory handle or fallback virtual handle
  const resolveActiveDirectory = async (): Promise<any> => {
    if (directoryHandle) return directoryHandle;
    const dirResult = await pickDirectory({ allowFallback: true });
    if (dirResult) {
      addRecentFolder(dirResult.name);
      return dirResult.handle;
    }
    const fallbackHandle = createVirtualDirectoryHandle(selectedFolderName || 'output_dataset');
    addRecentFolder(fallbackHandle.name);
    return fallbackHandle;
  };

  // Start Batch Generation
  const startBatch = useCallback(async () => {
    if (columns.length === 0) {
      setStatusMessage('Error: Add at least one column to generate data.');
      return;
    }

    if (!Number.isFinite(count) || count < 1) {
      setStatusMessage('Error: Row count must be at least 1.');
      return;
    }

    batchCancelledRef.current = false;
    let activeDir = directoryHandle;
    if (outputDestination === 'folder' && !activeDir) {
      activeDir = await resolveActiveDirectory();
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

    setStatusMessage(baseDescription);

    const startTime = performance.now();
    const batchEngine = new GeneratorEngine();
    const allRows: Record<string, unknown>[] = [];
    const CHUNK_SIZE = 5000;
    let generated = 0;

    const startRowOffset = isContinuation
      ? appendConfig.autoContinueSequence
        ? importedContext.startingRowNumber
          ? importedContext.startingRowNumber - 1
          : importedContext.totalRows
        : Math.max(0, (appendConfig.manualStartOffset || 1) - 1)
      : 0;

    const processChunkInner = async () => {
      if (batchCancelledRef.current) {
        setIsGeneratingBatch(false);
        setStatusMessage('Generation cancelled by user.');
        return;
      }

      const remaining = count - generated;
      const thisBatch = Math.min(CHUNK_SIZE, remaining);

      for (let i = 0; i < thisBatch; i++) {
        allRows.push(batchEngine.generateRow(columns, startRowOffset + generated + i));
      }
      generated += thisBatch;
      setBatchProgress(Math.floor((generated / count) * 100));

      if (generated < count) {
        setTimeout(() => { void processChunk(); }, 0);
      } else {
        const elapsed = performance.now() - startTime;
        const elapsedSec = elapsed / 1000;
        const rowsPerSec = Math.round(count / (elapsedSec || 0.001));

        // 1. Multi-File Output
        if (isMultiFile) {
          const rowsPerFile = Math.max(1, multiFileConfig.rowsPerFile || 1);
          const pattern = multiFileConfig.filenamePattern || '{filename}_{index}.{ext}';
          const baseName = filename || 'record';
          const ext = format;

          const fileEntries: { filename: string; content: string | Uint8Array }[] = [];
          for (let fileIdx = 0; fileIdx * rowsPerFile < allRows.length; fileIdx++) {
            const chunk = allRows.slice(fileIdx * rowsPerFile, (fileIdx + 1) * rowsPerFile);
            const formattedContent = formatSingleFileUnit(
              columns,
              chunk,
              format,
              tableName,
              activeWorkspace?.customJsonConfig
            );
            const fileItemName = resolveMultiFilename(pattern, baseName, fileIdx + 1, ext, 5);
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
              const zipBlob = await createZipArchive(fileEntries);
              const zipName = `${baseName}_bundle.zip`;
              downloadFile(zipBlob, zipName, 'application/zip');
              setStatusMessage(`Direct folder write failed (${err.message}). Downloaded ${fileEntries.length} files as ZIP.`);
            }
          } else {
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
            fileSizeBytes: totalOutputBytes,
          });

          setStats({
            rowsGenerated: count,
            rowsPerSec,
            elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
            fileSizeBytes: totalOutputBytes,
            isGenerating: false,
          });

        // 2. Append Existing Continuation
        } else if (isContinuation && importedContext) {
          let appendedOutput: string | Uint8Array;
          const originalFilename = importedContext.filename || `${filename || 'dataset'}.${format}`;
          let targetFilename = originalFilename;
          if (appendConfig.saveMode === 'suffix') {
            const extMatch = originalFilename.match(/\.([^.]+)$/);
            const fileExt = extMatch ? extMatch[1] : format;
            const base = originalFilename.replace(/\.[^/.]+$/, '');
            targetFilename = `${base}_${appendConfig.suffix || 'appended'}.${fileExt}`;
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
            fileSizeBytes: byteSize,
          });

          setStats({
            rowsGenerated: count,
            rowsPerSec,
            elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
            fileSizeBytes: byteSize,
            isGenerating: false,
          });

        // 3. Single Consolidated File
        } else {
          const exportFilename = `${filename || 'dataset'}.${format}`;
          const downloadResult = downloadDataset(
            columns,
            allRows,
            format,
            filename || 'dataset',
            tableName,
            activeWorkspace?.customJsonConfig
          );

          if (outputDestination === 'folder' && activeDir) {
            try {
              await writeBatchToDirectory(activeDir, exportFilename, downloadResult.content);
              setStatusMessage(
                `Wrote ${count.toLocaleString()} records directly to "${activeDir.name}/${exportFilename}" (${formatBytes(downloadResult.sizeBytes)}) in ${elapsedSec.toFixed(2)}s`
              );
            } catch (err: any) {
              downloadFile(downloadResult.blob, exportFilename, getMimeType(format));
              setStatusMessage(`Direct folder write notice: ${err.message}. Downloaded ${exportFilename}.`);
            }
          } else {
            downloadFile(downloadResult.blob, exportFilename, getMimeType(format));
            setStatusMessage(
              `Generated & downloaded ${count.toLocaleString()} records as "${exportFilename}" in ${elapsedSec.toFixed(2)}s (${formatBytes(downloadResult.sizeBytes)})`
            );
          }

          addRecentFile({
            filename: exportFilename,
            format,
            rowCount: count,
            folderName: outputDestination === 'folder' && activeDir ? activeDir.name : null,
            fileSizeBytes: downloadResult.sizeBytes,
          });

          setStats({
            rowsGenerated: count,
            rowsPerSec,
            elapsedSeconds: parseFloat(elapsedSec.toFixed(3)),
            fileSizeBytes: downloadResult.sizeBytes,
            isGenerating: false,
          });
        }

        setIsGeneratingBatch(false);
      }
    };

    const processChunk = async () => {
      try {
        await processChunkInner();
      } catch (err: any) {
        setStatusMessage(`Generation failed: ${err?.message || String(err)}`);
        setIsGeneratingBatch(false);
      }
    };

    setTimeout(processChunk, 10);
  }, [
    columns,
    count,
    filename,
    format,
    tableName,
    outputStrategy,
    outputDestination,
    directoryHandle,
    selectedFolderName,
    multiFileConfig,
    appendConfig,
    importedContext,
    setImportedContext,
    actionConfig,
    activeWorkspace,
  ]);

  // Cancel Batch Generation
  const cancelBatch = useCallback(() => {
    batchCancelledRef.current = true;
    setIsGeneratingBatch(false);
    setStatusMessage('Batch generation cancelled.');
  }, []);

  // Start Streaming Generation
  const startStream = useCallback(async (intervalMs: number = 150) => {
    if (columns.length === 0) {
      setStatusMessage('Error: Add at least one column to begin streaming.');
      return;
    }

    if (streamIntervalRef.current) return; // already streaming

    let activeDir = directoryHandle;
    if (outputDestination === 'folder' && !activeDir) {
      activeDir = await resolveActiveDirectory();
    }
    if (!activeDir) {
      // Live streaming always needs a (possibly virtual) directory target
      activeDir = createVirtualDirectoryHandle(selectedFolderName || filename || 'stream_dataset');
    }

    const fullFilename = `${filename || 'stream_dataset'}.${format}`;
    const isMultiFile = outputStrategy === 'multi_file';

    try {
      if (isMultiFile) {
        multiWriterRef.current = await createMultiFileStreamWriter(
          activeDir,
          multiFileConfig.filenamePattern || '{filename}_{index}.{ext}',
          columns,
          format,
          multiFileConfig.rowsPerFile || 1,
          tableName,
          filename || tableName
        );
      } else {
        streamWriterRef.current = await createStreamFileWriter(
          activeDir,
          fullFilename,
          columns,
          format,
          tableName
        );
      }
    } catch (err: any) {
      setStatusMessage(`Stream initialization notice: ${err.message}`);
      return;
    }

    const streamEngine = new GeneratorEngine();
    let currentRows = 0;
    const startTime = performance.now();

    isPausedRef.current = false;
    streamRowsRef.current = 0;
    setIsGeneratingStream(true);
    setIsStreamingPaused(false);
    setStreamRowsGenerated(0);
    setStatusMessage(`Streaming live synthetic data to "${activeDir.name}"...`);

    streamIntervalRef.current = setInterval(async () => {
      if (isPausedRef.current || !streamIntervalRef.current) return;

      const rowIndex = currentRows; // 0-based, consistent with batch mode
      currentRows += 1;
      streamRowsRef.current = currentRows;
      setStreamRowsGenerated(currentRows);
      const row = streamEngine.generateRow(columns, rowIndex);

      try {
        if (isMultiFile && multiWriterRef.current) {
          await multiWriterRef.current.writeRow(row);
        } else if (streamWriterRef.current) {
          await streamWriterRef.current.writeRow(row, rowIndex);
        }
      } catch (err: any) {
        console.warn('Stream write row error:', err);
      }

      const elapsed = (performance.now() - startTime) / 1000;
      const rps = Math.round(currentRows / (elapsed || 0.001));
      const bytesWritten = multiWriterRef.current
        ? multiWriterRef.current.getBytesWritten()
        : streamWriterRef.current
        ? streamWriterRef.current.getBytesWritten()
        : 0;

      setStats({
        rowsGenerated: currentRows,
        rowsPerSec: rps,
        elapsedSeconds: parseFloat(elapsed.toFixed(2)),
        fileSizeBytes: bytesWritten,
        isGenerating: true,
      });
    }, Math.max(20, intervalMs));
  }, [
    columns,
    filename,
    format,
    tableName,
    outputStrategy,
    outputDestination,
    directoryHandle,
    selectedFolderName,
    multiFileConfig,
  ]);

  // Pause / Resume Streaming
  const pauseStream = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    setIsStreamingPaused(isPausedRef.current);
    setStatusMessage(
      isPausedRef.current ? 'Paused streaming synthetic data.' : 'Resumed synthetic data streaming.'
    );
  }, []);

  // Stop Streaming
  const stopStream = useCallback(async () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    isPausedRef.current = false;
    setIsGeneratingStream(false);
    setIsStreamingPaused(false);

    try {
      if (multiWriterRef.current) {
        await multiWriterRef.current.close();
        multiWriterRef.current = null;
      }
      if (streamWriterRef.current) {
        await streamWriterRef.current.close();
        streamWriterRef.current = null;
      }
    } catch (err: any) {
      console.warn('Error closing stream writer:', err);
    }

    setStatusMessage(`Streaming finalized. Total rows emitted: ${streamRowsRef.current.toLocaleString()}`);
    setStats((prev) => ({ ...prev, isGenerating: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (streamWriterRef.current) streamWriterRef.current.close().catch(() => {});
      if (multiWriterRef.current) multiWriterRef.current.close().catch(() => {});
    };
  }, []);

  return {
    isGeneratingBatch,
    batchProgress,
    isGeneratingStream,
    isStreamingPaused,
    streamRowsGenerated,
    stats,
    statusMessage,
    setStatusMessage,
    startBatch,
    cancelBatch,
    startStream,
    pauseStream,
    stopStream,
  };
}
