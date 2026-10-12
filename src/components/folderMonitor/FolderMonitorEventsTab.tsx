import React from 'react';
import { Radio, Pause, RefreshCw } from 'lucide-react';
import { FolderMonitorEvent } from '../../utils/folderBehaviorAnalyzer';

export interface FolderMonitorEventsTabProps {
  events: FolderMonitorEvent[];
  isLiveMonitoring: boolean;
  isLoading: boolean;
  folderHandle: any | null;
  onToggleLiveMonitoring: () => void;
  onRescan: () => void;
}

export const FolderMonitorEventsTab: React.FC<FolderMonitorEventsTabProps> = ({
  events,
  isLiveMonitoring,
  isLoading,
  folderHandle,
  onToggleLiveMonitoring,
  onRescan,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLiveMonitoring}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isLiveMonitoring
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-secondary text-content-muted border-border-subtle'
            }`}
          >
            {isLiveMonitoring ? <Radio size={12} className="animate-pulse" /> : <Pause size={12} />}
            <span>{isLiveMonitoring ? 'Watcher Active' : 'Watcher Paused'}</span>
          </button>

          <span className="text-[11px] text-content-muted">
            Polls real folder changes every 3 seconds
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
          <span>Re-scan Real Folder</span>
        </button>
      </div>

      <div className="p-3 rounded-xl bg-black/80 border border-border-subtle font-mono text-[11px] text-emerald-400 space-y-1.5 max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-content-muted">No events logged yet. Lock a target folder to begin.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-content-muted text-[10px] flex-shrink-0">[{e.timestamp}]</span>
              <span
                className={
                  e.type === 'pattern_matched'
                    ? 'text-accent font-bold'
                    : e.type === 'file_added'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {e.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
