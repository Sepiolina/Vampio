import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DiscoveredFolderFile,
  FolderAnalysisResult,
  FolderMonitorEvent,
  analyzeFolderFiles,
  readFolderFromDirectoryHandle,
  readFilesFromHtmlFileList,
  formatFileSize,
} from '../utils/folderBehaviorAnalyzer';
import { useFilePicker } from './useFilePicker';
import { DirectorySelectionResult } from '../utils/fileSystem';

import { ColumnSpec } from '../types';

export interface UseFolderMonitorProps {
  isOpen: boolean;
  initialDirectoryHandle: any | null;
  initialFolderName: string | null;
  onSelectLockedFolder: (dirHandle: any, folderName: string) => void;
  currentColumns?: ColumnSpec[];
}

export function useFolderMonitor({
  isOpen,
  initialDirectoryHandle,
  initialFolderName,
  onSelectLockedFolder,
  currentColumns,
}: UseFolderMonitorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [folderHandle, setFolderHandle] = useState<any | null>(initialDirectoryHandle);
  const [folderName, setFolderName] = useState<string>(initialFolderName || '');
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFolderFile[]>([]);
  const [analysis, setAnalysis] = useState<FolderAnalysisResult | null>(null);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(true);
  const [events, setEvents] = useState<FolderMonitorEvent[]>([]);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<DiscoveredFolderFile | null>(null);

  const monitoringTimerRef = useRef<any>(null);

  const addEvent = useCallback((type: FolderMonitorEvent['type'], message: string, details?: string) => {
    const newEvent: FolderMonitorEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details,
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Process batch of local files
  const processFilesBatch = useCallback(async (files: File[], sourceName: string) => {
    setIsLoading(true);
    try {
      const discovered = await readFilesFromHtmlFileList(files);
      setDiscoveredFiles(discovered);
      const result = analyzeFolderFiles(discovered, sourceName, currentColumns);
      setAnalysis(result);
      if (discovered.length > 0) setSelectedFileForPreview(discovered[0]);
      addEvent('info', `Ingested ${discovered.length} real files from "/${sourceName}"`);
      if (result.metrics.namingPattern?.detected) {
        addEvent('pattern_matched', `Sequence pattern matched: "${result.metrics.namingPattern.pattern}"`);
      }
    } catch (err: any) {
      addEvent('info', `Batch processing error: ${err.message || 'Failed reading files'}`);
    } finally {
      setIsLoading(false);
    }
  }, [addEvent, currentColumns]);

  // Scan folder handle
  const scanFolderHandle = useCallback(async (handle: any, name: string) => {
    setIsLoading(true);
    addEvent('scan', `Scanning folder "${name}"...`);

    try {
      const files = await readFolderFromDirectoryHandle(handle);
      setDiscoveredFiles(files);
      const result = analyzeFolderFiles(files, name, currentColumns);
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
  }, [addEvent]);

  // Unified File Picker integration
  const filePicker = useFilePicker({
    onFolderSelect: async (result: DirectorySelectionResult) => {
      setFolderHandle(result.handle);
      setFolderName(result.name);
      onSelectLockedFolder(result.handle, result.name);
      addEvent('scan', `Locked onto directory: /${result.name}`);
      if (result.files && result.files.length > 0) {
        await processFilesBatch(result.files, result.name);
      } else {
        await scanFolderHandle(result.handle, result.name);
      }
    },
    onFilesSelect: async (files: File[]) => {
      if (!files || files.length === 0) return;
      const derivedName = 'selected_files';
      setFolderName(derivedName);
      const virtualHandle = { name: derivedName, kind: 'virtual-dir' };
      setFolderHandle(virtualHandle);
      onSelectLockedFolder(virtualHandle, derivedName);
      await processFilesBatch(files, derivedName);
    },
  });

  const handlePickDirectory = useCallback(async () => {
    try {
      await filePicker.selectFolder();
    } catch (err: any) {
      addEvent('info', `Folder selection note: ${err?.message || 'Cancelled'}`);
    }
  }, [filePicker, addEvent]);

  // Sync if parent folder changes while open
  useEffect(() => {
    if (initialDirectoryHandle && !folderHandle) {
      setFolderHandle(initialDirectoryHandle);
      setFolderName(initialFolderName || initialDirectoryHandle.name || 'locked_folder');
    }
  }, [initialDirectoryHandle, initialFolderName, folderHandle]);

  // Initial scan if folder is already linked
  useEffect(() => {
    if (isOpen && folderHandle && discoveredFiles.length === 0) {
      scanFolderHandle(folderHandle, folderName || folderHandle.name || 'locked_folder');
    }
  }, [isOpen, folderHandle, discoveredFiles.length, folderName, scanFolderHandle]);

  // Periodic poll for real folder changes
  useEffect(() => {
    if (!isOpen || !isLiveMonitoring || !folderHandle) {
      if (monitoringTimerRef.current) clearInterval(monitoringTimerRef.current);
      return;
    }

    monitoringTimerRef.current = setInterval(async () => {
      try {
        const freshFiles = await readFolderFromDirectoryHandle(folderHandle);
        let hasChanges = freshFiles.length !== discoveredFiles.length;

        if (!hasChanges) {
          const prevMap = new Map<string, DiscoveredFolderFile>(discoveredFiles.map((f) => [f.name, f]));
          for (const fresh of freshFiles) {
            const prev = prevMap.get(fresh.name);
            if (!prev) {
              hasChanges = true;
              addEvent('file_added', `New file observed: ${fresh.name}`, `${formatFileSize(fresh.size)}`);
              break;
            } else if (prev.size !== fresh.size || prev.lastModified !== fresh.lastModified) {
              hasChanges = true;
              addEvent('file_grown', `File changed: ${fresh.name}`, `${formatFileSize(fresh.size)}`);
              break;
            }
          }
        } else {
          const delta = freshFiles.length - discoveredFiles.length;
          if (delta > 0) {
            addEvent('file_added', `${delta} new file(s) arrived in monitored folder`);
          } else {
            addEvent('file_removed', `${Math.abs(delta)} file(s) removed from monitored folder`);
          }
        }

        if (hasChanges) {
          setDiscoveredFiles(freshFiles);
          const freshAnalysis = analyzeFolderFiles(freshFiles, folderName || 'target_folder', currentColumns);
          setAnalysis(freshAnalysis);
        }
      } catch (pollErr: any) {
        console.warn('Live folder poll tick note:', pollErr?.message);
      }
    }, 3000);

    return () => {
      if (monitoringTimerRef.current) clearInterval(monitoringTimerRef.current);
    };
  }, [isOpen, isLiveMonitoring, folderHandle, discoveredFiles, folderName, addEvent, currentColumns]);

  return {
    isLoading: isLoading || filePicker.isLoading,
    folderHandle,
    folderName,
    discoveredFiles,
    analysis,
    isLiveMonitoring,
    setIsLiveMonitoring,
    events,
    selectedFileForPreview,
    setSelectedFileForPreview,
    addEvent,
    clearEvents,
    scanFolderHandle,
    processFilesBatch,
    handlePickDirectory,
    filePicker,
  };
}
