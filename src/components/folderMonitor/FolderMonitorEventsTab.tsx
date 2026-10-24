import React from 'react';
import { Radio, Pause, RefreshCw } from 'lucide-react';
import { FolderMonitorEvent } from '../../utils/folderBehaviorAnalyzer';
import type { MonitorSourceKind } from '../../utils/folderMonitorState';

export interface FolderMonitorEventsTabProps {
  events: FolderMonitorEvent[];
  isLiveMonitoring: boolean;
  isLoading: boolean;
  folderHandle: any | null;
  onToggleLiveMonitoring: () => void;
  onRescan: () => void;
  sourceKind?: MonitorSourceKind;
  error?: string | null;
  lastScanAt?: number | null;
}

export const FolderMonitorEventsTab: React.FC<FolderMonitorEventsTabProps> = ({
  events,
  isLiveMonitoring,
  isLoading,
  folderHandle,
  onToggleLiveMonitoring,
  onRescan,
  sourceKind = 'directory',
  error,
  lastScanAt,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleLiveMonitoring}
            disabled={sourceKind !== 'directory' || !folderHandle}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isLiveMonitoring && sourceKind === 'directory' && folderHandle
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-secondary text-content-muted border-border-subtle'
            }`}
          >
            {isLiveMonitoring && sourceKind === 'directory' && folderHandle ? <Radio size={12} className="animate-pulse" /> : <Pause size={12} />}
            <span>{sourceKind === 'snapshot' ? 'Static snapshot' : !folderHandle ? 'No folder selected' : isLiveMonitoring ? 'Polling enabled' : 'Polling paused'}</span>
          </button>

          <span className="text-[11px] text-content-muted">
            {sourceKind === 'snapshot' ? 'Re-select files to observe later changes' : 'Checks folder changes every 3 seconds'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRescan}
          disabled={isLoading || !folderHandle}
          className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          title="Re-scan the folder for new, modified, or deleted files"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin text-accent' : ''} />
          <span>{sourceKind === 'snapshot' ? 'Refresh snapshot analysis' : 'Re-scan folder'}</span>
        </button>
      </div>

      {error && <div role="alert" className="text-xs text-red-400">{error}</div>}
      {lastScanAt && <p className="text-[11px] text-content-muted">Last successful scan: {new Date(lastScanAt).toLocaleTimeString()}</p>}
      <div className="p-3 rounded-xl bg-black/80 border border-border-subtle font-mono text-[11px] text-emerald-400 space-y-1.5 max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-content-muted">No events logged yet. Select a source folder or files to begin.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-content-muted text-[10px] flex-shrink-0">[{e.timestamp}]</span>
              <span
                className={
                  e.type === 'error' || e.type === 'access_changed'
                    ? 'text-red-400'
                    : e.type === 'pattern_matched'
                    ? 'text-accent font-bold'
                    : e.type === 'file_added'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {e.message}
                {e.details && <span className="block text-content-muted">{e.details}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
