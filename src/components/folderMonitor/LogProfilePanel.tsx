import React from 'react';
import { FolderAnalysisResult, formatFileSize } from '../../utils/folderBehaviorAnalyzer';
import { InferenceEvidence, TypeInferenceGuide } from './InferenceDetails';

interface Props {
  analysis: FolderAnalysisResult;
  onSelectSchemaSource?: (name: string) => void;
}

export function LogProfilePanel({ analysis, onSelectSchemaSource }: Props) {
  if (!analysis.fileProfiles?.length) return null;
  return (
    <section aria-label="Per-file log profiles" className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-content">File profiles</h3>
        <p className="text-xs text-content-muted mt-1">Format and encoding are inferred from sampled bytes. Expand a file to inspect its evidence and fields, or select it as the simulation source.</p>
      </div>
      <TypeInferenceGuide />
      {analysis.fileProfiles.map(profile => {
        const sourceId = profile.sourceId || profile.name;
        const isSelected = analysis.sampleFileUsed === sourceId;
        return (
        <details key={sourceId} className="rounded-xl border border-border-subtle bg-secondary overflow-hidden">
          <summary className="p-3 cursor-pointer text-xs text-content [overflow-wrap:anywhere]">
            <span className="font-mono font-semibold">{sourceId}</span>
            {isSelected && <span className="inline-block ml-2 px-2 py-0.5 rounded bg-accent/15 text-accent font-semibold">Simulation source</span>}
            <span className="block sm:inline sm:ml-3 mt-1 sm:mt-0 text-content-muted">
              {profile.format.replace(/_/g, ' ')} · {profile.encoding} · {profile.encodingConfidence}% encoding confidence · {profile.readStatus.replace(/_/g, ' ')}
            </span>
          </summary>
          <div className="p-3 border-t border-border-subtle space-y-3 text-xs select-text">
            {onSelectSchemaSource && profile.columns.length > 0 && (profile.readStatus === 'sampled' || profile.format === 'spreadsheet') && !profile.readError && (
              <button type="button" onClick={() => onSelectSchemaSource(sourceId)}
                disabled={isSelected}
                aria-label={`Use ${sourceId} for simulation`}
                className="px-3 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover disabled:bg-accent/15 disabled:text-accent disabled:cursor-default">
                {isSelected ? 'Selected simulation source' : 'Use for simulation'}
              </button>
            )}
            {profile.readError && <p className="text-rose-400 break-words">Read error: {profile.readError}</p>}
            <p className="text-content-muted">Sampled {formatFileSize(profile.sampledBytes)} · Newlines: {profile.newlineType}{profile.truncated ? ' · Sample limited; remaining content was not inspected' : ''}</p>
            <div className="grid gap-3 sm:grid-cols-2 [&>div]:min-w-0 [overflow-wrap:anywhere]">
              <div><h4 className="font-semibold text-content mb-1">Encoding evidence</h4><ul className="list-disc pl-4 text-content-muted space-y-1">{profile.encodingEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
              <div><h4 className="font-semibold text-content mb-1">Format evidence</h4><ul className="list-disc pl-4 text-content-muted space-y-1">{profile.formatEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
            </div>
            {profile.columns.length > 0 ? (
              <div className="overflow-x-auto"><table className="w-full text-left text-xs">
                <caption className="text-left text-content font-semibold mb-2">Fields inferred from this file</caption>
                <thead className="text-content-muted"><tr><th className="p-2">Field</th><th className="p-2">Type</th><th className="p-2">Observed examples</th><th className="p-2">Why this type?</th></tr></thead>
                <tbody>{profile.columns.map((column, index) => <tr key={`${column.name}-${index}`} className="border-t border-border-subtle align-top"><td className="p-2 font-mono text-content break-all">{column.name}</td><td className="p-2 text-accent">{column.inferredType}</td><td className="p-2 font-mono text-content-muted break-all">{column.sampleValues.slice(0, 3).join(', ') || 'No values sampled'}</td><td className="p-2 min-w-52"><InferenceEvidence column={column} /></td></tr>)}</tbody>
              </table></div>
            ) : <p className="text-content-muted">No structured fields inferred.</p>}
          </div>
        </details>
        );
      })}
    </section>
  );
}
