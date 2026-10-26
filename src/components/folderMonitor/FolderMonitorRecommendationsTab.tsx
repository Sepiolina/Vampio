import React from 'react';
import {
  FolderLock,
  Upload,
  FileText,
  Sliders,
  Layers,
  Sparkles,
  Zap,
  Check,
} from 'lucide-react';
import { FolderAnalysisResult } from '../../utils/folderBehaviorAnalyzer';

export interface FolderMonitorRecommendationsTabProps {
  analysis: FolderAnalysisResult | null;
  hasApplied: boolean;
  isLoading: boolean;
  isDraggingOver: boolean;
  dragProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => Promise<unknown>;
  };
  onApplyAll: () => void;
  onApplyModeOnly: () => void;
  onApplyTemplateOnly: () => void;
  onPickDirectory: () => void;
  onSelectFolderFallback: () => void;
  onSelectFiles: () => void;
}

export const FolderMonitorRecommendationsTab: React.FC<FolderMonitorRecommendationsTabProps> = ({
  analysis,
  hasApplied,
  isLoading,
  isDraggingOver,
  dragProps,
  onApplyAll,
  onApplyModeOnly,
  onApplyTemplateOnly,
  onPickDirectory,
  onSelectFolderFallback,
  onSelectFiles,
}) => {
  if (!analysis) {
    return (
      <div className="py-6 space-y-4">
        <div
          {...dragProps}
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
            <h3 className="text-base font-bold text-content">Drag &amp; Drop Target Folder Here</h3>
            <p className="text-xs text-content-muted leading-relaxed">
              Drop any local folder or dataset files directly here to inspect file structure, detect schemas, and configure ingestion.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onPickDirectory}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent-hover text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <FolderLock size={13} />
              <span>Select Target Folder</span>
            </button>
            <button
              type="button"
              onClick={onSelectFolderFallback}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Upload size={13} className="text-content-muted" />
              <span>Upload Local Folder</span>
            </button>
            <button
              type="button"
              onClick={onSelectFiles}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <FileText size={13} className="text-content-muted" />
              <span>Select Batch Files</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      {/* Top Comparison Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box 1: Suggested Mode */}
        <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary/80 border border-border-subtle flex flex-col justify-between space-y-3">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-content-muted flex items-center gap-1.5">
                <Sliders size={12} className="text-accent" />
                Recommended Set Mode
              </span>
              <span className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent/15 text-accent border border-accent/25">
                {analysis.suggestedMode.strategyConfidence}% Confidence
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
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
                  {analysis.suggestedMode.suggestedRowsPerFile && <span className="text-content-muted text-[11px] block mt-0.5">
                    ~{analysis.suggestedMode.suggestedRowsPerFile} rows per generated file
                  </span>}
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

          <div className="pt-2 border-t border-border-subtle/70 flex flex-wrap gap-2 items-start justify-between text-[11px]">
            <span className="text-content-muted">Target Destination:</span>
            <span className="font-mono text-content font-semibold">New simulation download</span>
          </div>
        </div>

        {/* Box 2: Suggested Template */}
        <div className="min-w-0 max-w-full p-4 rounded-xl bg-secondary/80 border border-border-subtle flex flex-col justify-between space-y-3">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-content-muted flex items-center gap-1.5">
                <Layers size={12} className="text-accent" />
                Recommended Template
              </span>
              <span className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                {analysis.suggestedTemplate.confidence}% Match
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="min-w-0 text-sm font-bold text-content [overflow-wrap:anywhere]" title={analysis.suggestedTemplate.presetName}>
                  {analysis.suggestedTemplate.presetName}
                </h3>
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
                  {analysis.suggestedTemplate.columns.map((c, idx) => (
                    <span
                      key={c.id || `${c.name}-${idx}`}
                      className="min-w-0 max-w-full flex-wrap px-1.5 py-0.5 rounded bg-primary border border-border-subtle text-[10px] font-mono text-content flex items-center gap-1"
                    >
                      <span className="text-accent font-semibold">{c.name}</span>
                      <span className="text-content-muted text-[9px]">({c.type})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle/70 flex flex-wrap gap-2 items-start justify-between text-[11px]">
            <span className="text-content-muted">Target Table Name:</span>
            <span className="font-mono text-accent font-semibold">
              {analysis.suggestedTemplate.tableName}
            </span>
          </div>
        </div>
      </div>

      {!analysis.extractedColumns.length && <p className="text-xs text-content-muted">No fields were inferred, so simulation recommendations cannot be applied. Review file profiles and export Markdown for the inventory and read findings.</p>}

      {/* Primary One-Click Action Deck */}
      <div className="min-w-0 max-w-full p-4 rounded-xl bg-accent/10 border border-accent/30 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-content flex items-start gap-1.5">
              <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
              One-Click Apply Recommendations
            </h4>
            <p className="text-xs text-content-muted mt-0.5">
              Loads the inferred schema and simulation settings for a new download. Choose an output folder separately if needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 max-w-full">
            <button
              type="button"
              onClick={onApplyAll}
              disabled={!analysis.extractedColumns.length || isLoading}
              className="disabled:opacity-50 disabled:cursor-not-allowed min-w-0 max-w-full flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
            >
              {hasApplied ? <Check size={15} /> : <Zap size={15} className="shrink-0" />}
              <span>{hasApplied ? 'Applied Successfully!' : 'Apply Mode & Template'}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-accent/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-content-muted text-[11px]">Need granular control?</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onApplyModeOnly}
              disabled={!analysis.extractedColumns.length || isLoading}
              className="disabled:opacity-50 disabled:cursor-not-allowed max-w-full px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
            >
              Apply Mode Only (Keep Columns)
            </button>
            <button
              type="button"
              onClick={onApplyTemplateOnly}
              disabled={!analysis.extractedColumns.length || isLoading}
              className="disabled:opacity-50 disabled:cursor-not-allowed max-w-full px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
            >
              Apply Template Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
