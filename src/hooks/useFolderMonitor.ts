import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DiscoveredFolderFile, FolderAnalysisResult, FolderMonitorEvent,
  analyzeFolderFiles, readFolderFromDirectoryHandle,
} from '../utils/folderBehaviorAnalyzer';
import { createSerialScanner, diffFolderSnapshots, fileIdentity, monitorSourceKind, resolveSchemaSource, MonitorStatus } from '../utils/folderMonitorState';
import { useFilePicker } from './useFilePicker';
import { createVirtualDirectoryHandle, DirectorySelectionResult } from '../utils/fileSystem';
import { ColumnSpec } from '../types';

export interface UseFolderMonitorProps {
  isOpen: boolean;
  initialDirectoryHandle: any | null;
  initialFolderName: string | null;
  onSelectLockedFolder: (dirHandle: any, folderName: string) => void;
  currentColumns?: ColumnSpec[];
  pollIntervalMs?: number;
}

export function useFolderMonitor({ isOpen, initialDirectoryHandle, initialFolderName, onSelectLockedFolder, currentColumns, pollIntervalMs = 3000 }: UseFolderMonitorProps) {
  const [folderHandle, setFolderHandle] = useState<any | null>(initialDirectoryHandle);
  const [folderName, setFolderName] = useState(initialFolderName || initialDirectoryHandle?.name || '');
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFolderFile[]>([]);
  const [analysis, setAnalysis] = useState<FolderAnalysisResult | null>(null);
  const [preferredSampleName, setPreferredSampleName] = useState<string | null>(null);
  const preferredSampleRef = useRef<string | null>(null);
  const filesRef = useRef<DiscoveredFolderFile[]>([]);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(true);
  const [events, setEvents] = useState<FolderMonitorEvent[]>([]);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<DiscoveredFolderFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const sourceKind = monitorSourceKind(folderHandle);
  const canPoll = sourceKind === 'directory';
  const columnsRef = useRef(currentColumns);
  columnsRef.current = currentColumns;
  const serialize = useRef(createSerialScanner());
  const scopeRef = useRef<{ cancelled: boolean; scan: () => Promise<void> } | null>(null);
  const liveRef = useRef(isLiveMonitoring);
  liveRef.current = isLiveMonitoring;
  const addEvent = useCallback((type: FolderMonitorEvent['type'], message: string, details?: string) => {
    setEvents(prev => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: new Date().toLocaleTimeString(), type, message, details }, ...prev].slice(0, 100));
  }, []);
  const clearEvents = useCallback(() => setEvents([]), []);

  const sourceRef = useRef({ handle: initialDirectoryHandle, name: initialFolderName || initialDirectoryHandle?.name || '' });
  const selectSource = useCallback((handle: any, name: string) => {
    if (sourceRef.current.handle === handle && sourceRef.current.name === name) return;
    sourceRef.current = { handle, name };
    preferredSampleRef.current = null;
    setPreferredSampleName(null);
    filesRef.current = [];
    if (scopeRef.current) scopeRef.current.cancelled = true;
    setFolderHandle(handle);
    setFolderName(name);
  }, []);

  // Parent changes include clearing the selected folder; local picker changes are retained
  // until the parent supplies a different handle.
  useEffect(() => {
    selectSource(initialDirectoryHandle, initialFolderName || initialDirectoryHandle?.name || '');
  }, [initialDirectoryHandle, initialFolderName, selectSource]);

  useEffect(() => {
    filesRef.current = [];
    setDiscoveredFiles([]);
    setAnalysis(null);
    setSelectedFileForPreview(null);
    setEvents([]);
    setError(null);
    setLastScanAt(null);
    setHasScanned(false);
    setIsLoading(false);
    if (!isOpen || !folderHandle) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous: DiscoveredFolderFile[] | null = null;
    let previousError: string | null = null;
    let pending: Promise<void> | null = null;
    const scope = { cancelled: false, scan: (): Promise<void> => {
      if (scope.cancelled) return Promise.resolve();
      if (pending) return pending;
      if (timer) clearTimeout(timer);
      setIsLoading(true);
      pending = (async () => {
        try {
          const files = await serialize.current(() => !scope.cancelled, () => readFolderFromDirectoryHandle(folderHandle));
          if (scope.cancelled || !files) return;
          if (previousError) addEvent('access_changed', `Directory read access restored: /${folderName}`);
          const changes = previous === null ? [{ type: 'scan' as const, message: `${sourceKind === 'snapshot' ? 'Loaded snapshot' : 'Scanned folder'}: ${files.length} files in /${folderName}` }] : diffFolderSnapshots(previous, files);
          changes.forEach(change => addEvent(change.type, change.message, 'details' in change ? change.details : undefined));
          previous = files;
          previousError = null;
          setError(null);
          filesRef.current = files;
          setDiscoveredFiles(files);
          preferredSampleRef.current = resolveSchemaSource(files, preferredSampleRef.current);
          setPreferredSampleName(preferredSampleRef.current);
          setAnalysis(analyzeFolderFiles(files, folderName || folderHandle.name || 'target_folder', columnsRef.current, preferredSampleRef.current || undefined));
          setSelectedFileForPreview(selected => files.find(file => selected && fileIdentity(file) === fileIdentity(selected)) || files[0] || null);
          setLastScanAt(Date.now());
          setHasScanned(true);
        } catch (err) {
          if (scope.cancelled) return;
          const message = err instanceof Error ? err.message : String(err);
          if (previousError !== message) addEvent('error', `Folder scan failed: ${message}`);
          previousError = message;
          setError(message);
          setAnalysis(null);
          filesRef.current = [];
          setDiscoveredFiles([]);
          setSelectedFileForPreview(null);
          setHasScanned(false);
        } finally {
          pending = null;
          if (!scope.cancelled) {
            setIsLoading(false);
            if (canPoll) timer = setTimeout(tick, Math.max(250, pollIntervalMs));
          }
        }
      })();
      return pending;
    } };
    function tick() {
      if (scope.cancelled) return;
      if (liveRef.current) void scope.scan();
      else timer = setTimeout(tick, Math.max(250, pollIntervalMs));
    }
    scopeRef.current = scope;
    void scope.scan();
    return () => {
      scope.cancelled = true;
      if (timer) clearTimeout(timer);
      if (scopeRef.current === scope) scopeRef.current = null;
    };
  }, [folderHandle, folderName, isOpen, canPoll, sourceKind, pollIntervalMs, addEvent]);

  useEffect(() => {
    setAnalysis(previous => previous ? analyzeFolderFiles(previous.files, previous.folderName, currentColumns, preferredSampleRef.current || undefined) : null);
  }, [currentColumns]);

  const selectSchemaSource = useCallback((name: string | null) => {
    const selected = resolveSchemaSource(filesRef.current, name);
    preferredSampleRef.current = selected;
    setPreferredSampleName(selected);
    setAnalysis(previous => previous ? analyzeFolderFiles(previous.files, previous.folderName, columnsRef.current, selected || undefined) : null);
  }, []);

  const refresh = useCallback(async () => { await scopeRef.current?.scan(); }, []);
  const scanFolderHandle = useCallback(async (handle: any, name: string) => {
    if (handle === folderHandle) await refresh();
    else selectSource(handle, name);
  }, [folderHandle, refresh, selectSource]);
  const processFilesBatch = useCallback(async (files: File[], name: string) => {
    const handle = createVirtualDirectoryHandle(name, undefined, files);
    selectSource(handle, name);
    onSelectLockedFolder(handle, name);
  }, [selectSource, onSelectLockedFolder]);
  const filePicker = useFilePicker({
    onFolderSelect: async (result: DirectorySelectionResult) => {
      const handle = result.isVirtual ? createVirtualDirectoryHandle(result.name, result.path, result.files) : result.handle;
      selectSource(handle, result.name);
      onSelectLockedFolder(handle, result.name);
    },
    onFilesSelect: files => processFilesBatch(files, 'selected_files'),
  });
  const handlePickDirectory = useCallback(async () => {
    try { await filePicker.selectFolder(); }
    catch (err) { addEvent('error', `Folder selection failed: ${err instanceof Error ? err.message : String(err)}`); }
  }, [filePicker, addEvent]);
  const visibleError = error || filePicker.error;
  const status: MonitorStatus = visibleError ? 'error' : !folderHandle ? 'idle' : isLoading ? 'scanning' : sourceKind === 'snapshot' ? 'snapshot' : !isOpen || !isLiveMonitoring ? 'paused' : hasScanned ? 'ready' : 'idle';
  return {
    isLoading: isLoading || filePicker.isLoading, folderHandle, folderName, discoveredFiles, analysis,
    isLiveMonitoring, setIsLiveMonitoring, events, selectedFileForPreview, setSelectedFileForPreview,
    addEvent, clearEvents, scanFolderHandle, processFilesBatch, handlePickDirectory, filePicker,
    sourceKind, canPoll, error: visibleError, status, lastScanAt, hasScanned, refresh,
    preferredSampleName, selectSchemaSource,
  };
}
