import React, { useState } from 'react';
import { 
  FolderSearch, 
  FolderCheck, 
  Activity, 
  FileText, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  Code2, 
  Sparkles, 
  Globe, 
  Languages, 
  ArrowRight, 
  FileSpreadsheet
} from 'lucide-react';
import { 
  formatFileSize, 
  generateWorkspaceProfileBundle,
  VampioWorkspaceProfileBundle
} from '../utils/folderBehaviorAnalyzer';
import { useFolderMonitor } from '../hooks/useFolderMonitor';
import { ProfileExportControls } from './folderMonitor/ProfileExportControls';
import { LogProfilePanel } from './folderMonitor/LogProfilePanel';
import { useUserRole } from '../context/UserRoleContext';
import { useI18n, LanguageSelectDropdown } from '../i18n';

interface Props {
  onOpenInDeveloperStudio?: (bundle: VampioWorkspaceProfileBundle) => void;
}

export const OperatorMonitorView: React.FC<Props> = ({ onOpenInDeveloperStudio }) => {
  const { setRole } = useUserRole();
  const { t } = useI18n();
  const monitor = useFolderMonitor({
    isOpen: true,
    initialDirectoryHandle: null,
    initialFolderName: null,
    onSelectLockedFolder: () => {},
  });
  const { folderHandle: directoryHandle, folderName, isLoading: isScanning, discoveredFiles, analysis,
    isLiveMonitoring: isAutoWatch, setIsLiveMonitoring: setIsAutoWatch } = monitor;
  const folderPath = typeof directoryHandle?.path === 'string' ? directoryHandle.path : folderName;
  const schemaProfile = analysis?.fileProfiles?.find(profile => (profile.sourceId || profile.name) === analysis.sampleFileUsed);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const notify = (message: string) => setStatusNotification(message);
  const handleSelectFolder = monitor.handlePickDirectory;
  const hasInferredColumns = !!analysis?.extractedColumns.length;
  const handleSelectFiles = () => { void monitor.filePicker.selectFiles().catch(() => {}); };

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
      `File Lock Status: ${f.fileLockStatus === 'no_lock_detected' ? 'No lock evidence observed; OS locking and write access unverified' : f.lockDetails || 'Possible contention'}`,
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
    if (analysis && !hasInferredColumns) return;
    if (analysis) {
      const bundle = generateWorkspaceProfileBundle(analysis, folderPath);
      if (onOpenInDeveloperStudio) {
        onOpenInDeveloperStudio(bundle);
      }
    }
    setRole('developer');
  };

  return (
    <div className="min-w-0 [overflow-wrap:anywhere] min-h-screen bg-primary text-content flex flex-col font-sans select-none">
      {/* Top Header Bar */}
      <header className="min-h-14 py-2 gap-2 border-b border-border-subtle bg-secondary/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-content tracking-tight">Vampio</span>
                <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  {t('operator.modeBadge')}
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-content-muted leading-none truncate">
                {t('operator.modeSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Right switch button and language selector */}
        <div className="flex items-center gap-2 shrink-0">
          <LanguageSelectDropdown compact />
          <button
            type="button"
            onClick={handleOpenStudio}
            disabled={!!analysis && !hasInferredColumns}
            aria-label={analysis && !hasInferredColumns ? 'Developer Studio handoff unavailable: no fields were inferred' : t('operator.switchToDev')}
            className="disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs group"
            title={analysis && !hasInferredColumns ? 'No fields were inferred. Export Markdown to review the findings.' : t('operator.switchToDevTooltip')}
          >
            <Code2 size={14} className="text-accent group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">{t('operator.switchToDev')}</span>
            <span className="sm:hidden">{t('operator.devStudio')}</span>
            <ArrowRight size={13} className="hidden sm:block text-content-muted" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="min-w-0 flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Status Toast Notification */}
        {statusNotification && (
          <div role="status" className="p-3 rounded-xl bg-accent text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span>{statusNotification}</span>
            </div>
          </div>
        )}

        {/* Hero Section: Select Folder / Active Monitor Status */}
        <div className="p-6 rounded-2xl bg-secondary border border-border-subtle shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h1 className="text-lg font-bold text-content flex items-start gap-2 min-w-0">
                {monitor.sourceKind !== 'none' ? (
                  <>
                    <FolderCheck className="text-emerald-400 shrink-0 mt-1" size={20} />
                    <span className="min-w-0 break-words">{monitor.sourceKind === 'snapshot' ? 'Uploaded snapshot' : t('operator.monitoredFolder')}: <span className="text-accent">{folderName}</span></span>
                  </>
                ) : (
                  <>
                    <FolderSearch className="text-accent shrink-0 mt-1" size={20} />
                    <span className="min-w-0 break-words">{t('operator.targetFolderSelection')}</span>
                  </>
                )}
              </h1>
              <p className="text-xs text-content-muted break-all">
                {monitor.sourceKind !== 'none'
                  ? (folderPath ? `${t('operator.path')}: ${folderPath}` : t('operator.watcherActiveSubtitle'))
                  : t('operator.selectFolderPrompt')}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {monitor.sourceKind !== 'none' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void monitor.refresh()}
                    disabled={isScanning || !monitor.canPoll}
                    className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw size={13} className={isScanning ? 'animate-spin text-accent' : ''} />
                    <span>{isScanning ? t('operator.scanning') : monitor.canPoll ? t('operator.rescanFolder') : 'Snapshot'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/80 border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FolderSearch size={13} />
                    <span>{t('operator.changeFolder')}</span>
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
                  <span>{isScanning ? t('operator.scanningDirectory') : t('operator.selectFolderToMonitor')}</span>
                </button>
              )}
              <button type="button" onClick={handleSelectFiles} disabled={isScanning}
                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                <FileText size={13} className="shrink-0" /><span>Select files snapshot</span>
              </button>
            </div>
          </div>

          {/* Active Live Watcher Beacon */}
          {monitor.sourceKind !== 'none' && (
            <div className="pt-3 border-t border-border-subtle/70 flex items-center justify-between text-xs text-content-muted flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap" role="status">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${monitor.canPoll && isAutoWatch && !monitor.error ? 'animate-ping' : 'hidden'}`}></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className={`font-mono font-medium ${monitor.error ? 'text-rose-400' : monitor.canPoll && isAutoWatch ? 'text-emerald-400' : 'text-content-muted'}`}>{isScanning ? 'Scanning' : monitor.error ? 'Scan failed' : monitor.sourceKind === 'snapshot' ? 'Uploaded snapshot · no live refresh' : isAutoWatch ? 'Live · refresh every 3 seconds' : 'Paused'}</span>
                <span className="text-content-muted/60">·</span>
                <span>{discoveredFiles.length} {t('operator.filesDetected')}</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={isAutoWatch && monitor.canPoll}
                    disabled={!monitor.canPoll}
                    onChange={(e) => setIsAutoWatch(e.target.checked)}
                    className="rounded text-accent focus:ring-0"
                  />
                  <span>Auto refresh</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {monitor.error && <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 break-words">{monitor.error}</div>}
        {monitor.lastScanAt && <p className="text-xs text-content-muted">Last scan: {new Date(monitor.lastScanAt).toLocaleString()}</p>}

        {/* Profiler Forensic Results */}
        {analysis && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* 4 Forensic Diagnostic Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Files & Volume */}
              <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary border border-border-subtle shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-content-muted">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">{t('operator.filesVolume')}</span>
                  <FileSpreadsheet size={15} className="text-accent" />
                </div>
                <div>
                  <div className="text-xl font-bold text-content font-mono">
                    {analysis.metrics.totalFiles} <span className="text-xs font-normal text-content-muted">{t('operator.filesDetected')}</span>
                  </div>
                  <div className="text-xs text-content-muted mt-0.5">
                    {formatFileSize(analysis.metrics.totalSizeBytes)}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 flex items-center gap-1 text-[11px] text-content-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span>File-time estimate: {analysis.metrics.temporalCadence.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Card 2: Format & Delimiter */}
              <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary border border-border-subtle shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-content-muted">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">{t('operator.formatDelimiter')}</span>
                  <FileText size={15} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-content font-mono uppercase">
                    {schemaProfile?.format.replace(/_/g, ' ') || analysis.forensics.dominantExtension}
                  </div>
                  <div className="text-xs text-content-muted mt-0.5">
                    {t('operator.delimiter')}: <span className="text-accent font-semibold">{analysis.forensics.delimiterName || 'N/A'}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 flex items-center gap-1 text-[11px] text-content-muted font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>{t('operator.newline')}: {analysis.forensics.newlineType}</span>
                </div>
              </div>

              {/* Card 3: Encoding & Language */}
              <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary border border-border-subtle shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-content-muted">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">{t('operator.encodingScript')}</span>
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
                  <span>{t('operator.confidence')}: {analysis.forensics.encodingConfidence}%</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-content-muted">{t('operator.lockStatus')}</span>
                  {analysis.forensics.fileLockStatus === 'no_lock_detected' ? (
                    <ShieldCheck size={16} className="text-emerald-400" />
                  ) : (
                    <ShieldAlert size={16} className="text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold">
                    {analysis.forensics.fileLockStatus === 'no_lock_detected'
                      ? 'No lock evidence observed'
                      : analysis.forensics.fileLockStatus === 'active_lock_suspected'
                        ? 'Possible active writer'
                        : 'Read/access problem'}
                  </div>
                  <div className="text-[11px] text-content-muted mt-0.5 break-words">
                    {analysis.forensics.lockDetails || 'Sample reads completed'}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border-subtle/60 text-[11px] font-mono">
                  <span className="text-content-muted">OS locks and write access unverified</span>
                </div>
              </div>
            </div>

            <LogProfilePanel analysis={analysis} onSelectSchemaSource={monitor.selectSchemaSource} />

            {/* Inferred Schema Columns Pill Bar */}
            <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary border border-border-subtle space-y-2.5">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <span className="text-xs font-bold text-content flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  <span>{t('operator.detectedSchemaFields')} ({analysis.extractedColumns.length} {t('operator.columnsCount')})</span>
                </span>
                <span className="text-[11px] text-content-muted font-mono">
                  {t('operator.target')}: {analysis.suggestedTemplate.tableName}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {analysis.extractedColumns.map((col, idx) => (
                  <div
                    key={idx}
                    className="min-w-0 max-w-full inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary border border-border-subtle text-xs font-mono"
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
              <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary border border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-content-muted flex items-center gap-1.5 font-mono">
                    <FileText size={13} />
                    <span>{t('operator.rawSamplePreview')} ({analysis.sampleFileUsed || 'Log file'})</span>
                  </span>
                  <span className="text-[10px] font-mono text-content-muted">{t('operator.first1000Chars')}</span>
                </div>
                <pre className="p-3 rounded-lg bg-primary border border-border-subtle text-[11px] font-mono text-content-muted overflow-x-auto max-h-36 whitespace-pre-wrap leading-relaxed select-text">
                  {analysis.sampleSnippet}
                </pre>
              </div>
            )}

            <ProfileExportControls analysis={analysis} folderPath={folderPath} />

            {/* Main Action Bar for Field Operator */}
            <div className="min-w-0 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="min-w-0 space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h3 className="font-bold text-base text-content">Analysis summary</h3>
                </div>
                <p className="text-xs text-content-muted max-w-lg">
                  Copy the observed file patterns and recommendations for review.
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
                  <span>{copiedSummary ? t('operator.copied') : t('operator.copySummary')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
