import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderSearch, 
  FolderCheck, 
  Activity, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  ShieldAlert, 
  ShieldCheck, 
  Code2, 
  Sparkles, 
  Globe, 
  Languages, 
  Cpu, 
  ArrowRight, 
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { 
  FolderAnalysisResult, 
  DiscoveredFolderFile, 
  readFolderFromDirectoryHandle, 
  readFilesFromHtmlFileList, 
  analyzeFolderFiles, 
  formatFileSize, 
  exportWorkspaceProfileBundleJson, 
  generateWorkspaceProfileBundle,
  VampioWorkspaceProfileBundle
} from '../utils/folderBehaviorAnalyzer';
import { requestDirectoryHandle, isFileSystemAccessSupported } from '../utils/fileSystem';
import { useUserRole } from '../context/UserRoleContext';

interface Props {
  onOpenInDeveloperStudio?: (bundle: VampioWorkspaceProfileBundle) => void;
}

export const OperatorMonitorView: React.FC<Props> = ({ onOpenInDeveloperStudio }) => {
  const { setRole } = useUserRole();
  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [folderPath, setFolderPath] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFolderFile[]>([]);
  const [analysis, setAnalysis] = useState<FolderAnalysisResult | null>(null);
  const [isAutoWatch, setIsAutoWatch] = useState<boolean>(true);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchIntervalRef = useRef<any>(null);

  // Trigger notification toast
  const notify = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  // Perform folder scan
  const performScan = async (handle: any, name: string) => {
    setIsScanning(true);
    try {
      const files = await readFolderFromDirectoryHandle(handle);
      setDiscoveredFiles(files);
      const result = analyzeFolderFiles(files, name);
      setAnalysis(result);
    } catch (err: any) {
      console.error('Scan error:', err);
      notify(`Scan error: ${err?.message || 'Failed reading directory'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle select folder
  const handleSelectFolder = async () => {
    try {
      const handle = await requestDirectoryHandle();
      if (!handle) return;

      const name = handle.name || (handle.path ? handle.path.split(/[\\/]/).pop() : 'Monitored_Folder');
      const path = handle.path || '';
      setDirectoryHandle(handle);
      setFolderName(name);
      setFolderPath(path);

      await performScan(handle, name);
      notify(`Monitoring folder "${name}"`);
    } catch (err: any) {
      console.warn('Native picker failed or cancelled, using fallback input:', err);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  // Handle fallback file input (<input webkitdirectory />)
  const handleFallbackFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsScanning(true);
    try {
      const files = await readFilesFromHtmlFileList(e.target.files);
      const firstPath = (e.target.files[0] as any).webkitRelativePath || '';
      const rootFolder = firstPath.split('/')[0] || 'Selected_Folder';
      setFolderName(rootFolder);
      setFolderPath(rootFolder);
      setDiscoveredFiles(files);
      const result = analyzeFolderFiles(files, rootFolder);
      setAnalysis(result);
      notify(`Loaded ${files.length} files from "${rootFolder}"`);
    } catch (err: any) {
      console.error('Fallback input error:', err);
      notify('Failed to process directory files');
    } finally {
      setIsScanning(false);
    }
  };

  // Polling / Auto-watch cadence
  useEffect(() => {
    if (!isAutoWatch || !directoryHandle) return;

    watchIntervalRef.current = setInterval(async () => {
      try {
        const files = await readFolderFromDirectoryHandle(directoryHandle);
        setDiscoveredFiles(files);
        const result = analyzeFolderFiles(files, folderName);
        setAnalysis(result);
      } catch (e) {
        console.warn('Auto-watch tick error:', e);
      }
    }, 4000);

    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  }, [isAutoWatch, directoryHandle, folderName]);

  // Export JSON Bundle for DEV
  const handleExportBundle = () => {
    if (!analysis) return;
    try {
      const jsonStr = exportWorkspaceProfileBundleJson(analysis, folderPath);
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
      notify('Exported Developer Profile Bundle (.vampio.profile.json)');
    } catch (err: any) {
      console.error('Export error:', err);
      notify('Failed to export profile bundle');
    }
  };

  // Copy quick summary text for Slack/Teams/Email
  const handleCopySummary = async () => {
    if (!analysis) return;
    const f = analysis.forensics;
    const m = analysis.metrics;
    const summary = [
      `=== VAMPIO BEHAVIOR MONITOR PROFILE ===`,
      `Target Folder: ${folderPath || folderName}`,
      `Total Files: ${m.totalFiles} (${formatFileSize(m.totalSizeBytes)})`,
      `Dominant Format: ${f.dominantExtension} (${m.dominantFormat.toUpperCase()})`,
      `Delimiter: ${f.delimiterName || 'N/A'}`,
      `Encoding: ${f.encoding} (Confidence: ${f.encodingConfidence}%)`,
      `Newline: ${f.newlineType}`,
      `Languages: ${f.detectedLanguages.join(', ')}`,
      `File Lock Status: ${f.fileLockStatus === 'no_lock_detected' ? 'Clean (No locks)' : f.lockDetails || 'Active Locks'}`,
      `Detected Headers (${analysis.extractedColumns.length}): ${analysis.extractedColumns.map(c => c.name).join(', ')}`,
      `Temporal Cadence: ${m.temporalCadence}`,
      `Recommended Strategy: ${analysis.suggestedMode.outputStrategy} (${analysis.suggestedMode.suggestedFilenamePattern || analysis.suggestedMode.suggestedFilename})`,
      `=======================================`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      notify('Summary copied to clipboard!');
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      notify('Could not write to clipboard');
    }
  };

  // Direct handoff to Developer Studio
  const handleOpenStudio = () => {
    if (analysis) {
      const bundle = generateWorkspaceProfileBundle(analysis, folderPath);
      if (onOpenInDeveloperStudio) {
        onOpenInDeveloperStudio(bundle);
      }
    }
    setRole('developer');
  };

  return (
    <div className="min-h-screen bg-primary text-content flex flex-col font-sans select-none">
      {/* Hidden fallback directory file input */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleFallbackFileInput}
      />

      {/* Top Header Bar */}
      <header className="h-14 border-b border-border-subtle bg-secondary/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
              <Activity size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-content tracking-tight">Vampio</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  Field Operator Mode
                </span>
              </div>
              <p className="text-[10px] text-content-muted leading-none">
                Industrial Log & File Behavior Profiler
              </p>
            </div>
          </div>
        </div>

        {/* Right switch button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenStudio}
            className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs group"
            title="Switch to full schema designer & generator studio"
          >
            <Code2 size={14} className="text-accent group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">Switch to Developer Studio</span>
            <span className="sm:hidden">Dev Studio</span>
            <ArrowRight size={13} className="text-content-muted" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Status Toast Notification */}
        {statusNotification && (
          <div className="p-3 rounded-xl bg-accent text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span>{statusNotification}</span>
            </div>
          </div>
        )}

        {/* Hero Section: Select Folder / Active Monitor Status */}
        <div className="p-6 rounded-2xl bg-secondary border border-border-subtle shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-content flex items-center gap-2">
                {directoryHandle ? (
                  <>
                    <FolderCheck className="text-emerald-400" size={20} />
                    <span>Monitored Folder: <span className="text-accent">{folderName}</span></span>
                  </>
                ) : (
                  <>
                    <FolderSearch className="text-accent" size={20} />
                    <span>Target Folder Selection</span>
                  </>
                )}
              </h1>
              <p className="text-xs text-content-muted">
                {directoryHandle
                  ? (folderPath ? `Path: ${folderPath}` : 'Directory watcher active. Reading real-time log characteristics.')
                  : 'Select any production directory, PLC log repository, or local folder to inspect.'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {directoryHandle ? (
                <>
                  <button
                    type="button"
                    onClick={() => performScan(directoryHandle, folderName)}
                    disabled={isScanning}
                    className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw size={13} className={isScanning ? 'animate-spin text-accent' : ''} />
                    <span>{isScanning ? 'Scanning...' : 'Rescan Folder'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/80 border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FolderSearch size={13} />
                    <span>Change Folder</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={isScanning}
                  className="px-5 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-md shadow-accent/20"
                >
                  <FolderSearch size={16} />
                  <span>{isScanning ? 'Scanning Directory...' : 'Select Folder to Monitor'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Live Watcher Beacon */}
          {directoryHandle && (
            <div className="pt-3 border-t border-border-subtle/70 flex items-center justify-between text-xs text-content-muted flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-emerald-400 font-medium">Real-time Watcher Active</span>
                <span className="text-content-muted/60">·</span>
                <span>{discoveredFiles.length} files detected</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={isAutoWatch}
                    onChange={(e) => setIsAutoWatch(e.target.checked)}
                    className="rounded text-accent focus:ring-0"
                  />
                  <span>Auto-refresh every 4s</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Profiler Forensic Results */}
        {analysis && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* 4 Forensic Diagnostic Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Files & Volume */}
              <div className="p-4 rounded-xl bg-secondary border border-border-subtle shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-content-muted">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Files & Volume</span>
                  <FileSpreadsheet size={15} className="text-accent" />
                </div>
                <div>
                  <div className="text-xl font-bold text-content font-mono">
                    {analysis.metrics.totalFiles} <span className="text-xs font-normal text-content-muted">files</span>
                  </div>
                  <div className="text-xs text-content-muted mt-0.5">
                    {formatFileSize(analysis.metrics.totalSizeBytes)} total
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 flex items-center gap-1 text-[11px] text-content-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span>Cadence: {analysis.metrics.temporalCadence.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Card 2: Format & Delimiter */}
              <div className="p-4 rounded-xl bg-secondary border border-border-subtle shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-content-muted">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Format & Delimiter</span>
                  <FileText size={15} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-content font-mono uppercase">
                    {analysis.forensics.dominantExtension}
                  </div>
                  <div className="text-xs text-content-muted mt-0.5">
                    Delimiter: <span className="text-accent font-semibold">{analysis.forensics.delimiterName || 'N/A'}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 flex items-center gap-1 text-[11px] text-content-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Newline: {analysis.forensics.newlineType}</span>
                </div>
              </div>

              {/* Card 3: Encoding & Language */}
              <div className="p-4 rounded-xl bg-secondary border border-border-subtle shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-content-muted">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Encoding & Script</span>
                  <Languages size={15} className="text-amber-400" />
                </div>
                <div>
                  <div className="text-base font-bold text-content truncate font-mono" title={analysis.forensics.encoding}>
                    {analysis.forensics.encoding}
                  </div>
                  <div className="text-xs text-content-muted mt-0.5 flex items-center gap-1">
                    <Globe size={11} className="text-emerald-400" />
                    <span>{analysis.forensics.detectedLanguages.join(', ')}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 flex items-center gap-1 text-[11px] text-content-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Confidence: {analysis.forensics.encodingConfidence}%</span>
                </div>
              </div>

              {/* Card 4: Lock & Process State */}
              <div className={`p-4 rounded-xl border shadow-2xs space-y-2 ${
                analysis.forensics.fileLockStatus === 'file_in_use_error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : analysis.forensics.fileLockStatus === 'active_lock_suspected'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-secondary border-border-subtle text-content'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-content-muted">Lock Status</span>
                  {analysis.forensics.fileLockStatus === 'no_lock_detected' ? (
                    <ShieldCheck size={16} className="text-emerald-400" />
                  ) : (
                    <ShieldAlert size={16} className="text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold truncate">
                    {analysis.forensics.fileLockStatus === 'no_lock_detected'
                      ? 'Clean (No Locks)'
                      : analysis.forensics.fileLockStatus === 'active_lock_suspected'
                        ? 'Active Stream Append'
                        : 'File In Use Conflict'}
                  </div>
                  <div className="text-[11px] text-content-muted line-clamp-1 mt-0.5">
                    {analysis.forensics.lockDetails || 'Files accessible'}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 text-[11px] font-mono">
                  {analysis.forensics.hasContinuousAppend ? (
                    <span className="text-amber-400">Stream append mode</span>
                  ) : (
                    <span className="text-emerald-400">Static / batch ready</span>
                  )}
                </div>
              </div>
            </div>

            {/* Inferred Schema Columns Pill Bar */}
            <div className="p-4 rounded-xl bg-secondary border border-border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-content flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  <span>Detected Schema Fields ({analysis.extractedColumns.length} columns)</span>
                </span>
                <span className="text-[11px] text-content-muted font-mono">
                  Target: {analysis.suggestedTemplate.tableName}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {analysis.extractedColumns.map((col, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary border border-border-subtle text-xs font-mono"
                  >
                    <span className="font-bold text-content">{col.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-accent font-semibold border border-border-subtle">
                      {col.inferredType}
                    </span>
                    {col.sampleValues[0] && (
                      <span className="text-[10px] text-content-muted truncate max-w-[120px]" title={col.sampleValues[0]}>
                        ({col.sampleValues[0]})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Raw Content Snippet Preview */}
            {analysis.sampleSnippet && (
              <div className="p-4 rounded-xl bg-secondary border border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-content-muted flex items-center gap-1.5 font-mono">
                    <FileText size={13} />
                    <span>Raw Sample Preview ({analysis.sampleFileUsed || 'Log file'})</span>
                  </span>
                  <span className="text-[10px] font-mono text-content-muted">First 1,000 characters</span>
                </div>
                <pre className="p-3 rounded-lg bg-primary border border-border-subtle text-[11px] font-mono text-content-muted overflow-x-auto max-h-36 whitespace-pre-wrap leading-relaxed">
                  {analysis.sampleSnippet}
                </pre>
              </div>
            )}

            {/* Main Action Bar for Field Operator */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h3 className="font-bold text-base text-content">Profile Bundle Ready for Developer</h3>
                </div>
                <p className="text-xs text-content-muted max-w-lg">
                  Contains all detected columns, file lock heuristics, encodings, and simulation configs. When DEV imports this file, their Vampio workspace will replicate this folder exactly.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3.5 py-2.5 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Copy a clean text summary to paste into chat or email"
                >
                  {copiedSummary ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportBundle}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Download size={15} />
                  <span>Export Profile Bundle (.vampio.profile.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
