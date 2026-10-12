import React from 'react';
import { FileText } from 'lucide-react';
import {
  DiscoveredFolderFile,
  FolderAnalysisResult,
  formatFileSize,
} from '../../utils/folderBehaviorAnalyzer';

export interface FolderMonitorMetricsTabProps {
  analysis: FolderAnalysisResult | null;
  discoveredFiles: DiscoveredFolderFile[];
  selectedFileForPreview: DiscoveredFolderFile | null;
  onSelectFileForPreview: (file: DiscoveredFolderFile) => void;
}

export const FolderMonitorMetricsTab: React.FC<FolderMonitorMetricsTabProps> = ({
  analysis,
  discoveredFiles,
  selectedFileForPreview,
  onSelectFileForPreview,
}) => {
  return (
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
                onClick={() => onSelectFileForPreview(file)}
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
  );
};
