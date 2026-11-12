import React from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import { LogProfilePanel } from './LogProfilePanel';
import { FolderAnalysisResult } from '../../utils/folderBehaviorAnalyzer';
import { InferenceSensitivity } from '../../utils/columnInference';
import { ColumnType } from '../../types';
import { InferenceEvidence } from './InferenceDetails';

export interface FolderMonitorSchemaTabProps {
  analysis: FolderAnalysisResult | null;
  onSelectSchemaSource?: (name: string) => void;
  sensitivity?: InferenceSensitivity;
  onSensitivityChange?: (sensitivity: InferenceSensitivity) => void;
  onUpdateColumnType?: (columnName: string, newType: ColumnType, newRule: string, reason?: string) => void;
}

export const FolderMonitorSchemaTab: React.FC<FolderMonitorSchemaTabProps> = ({
  analysis,
  onSelectSchemaSource,
  sensitivity = 'balanced',
  onSensitivityChange,
  onUpdateColumnType,
}) => {
  if (!analysis?.extractedColumns || analysis.extractedColumns.length === 0) {
    return (
      <div className="space-y-4">
        {analysis && <LogProfilePanel analysis={analysis} onSelectSchemaSource={onSelectSchemaSource} />}
        <p className="text-center py-6 text-xs text-content-muted">No structured fields inferred. Select files with readable text to inspect their profiles.</p>
      </div>
    );
  }

  const sensitivityLabels: Record<InferenceSensitivity, { label: string; desc: string }> = {
    strict: {
      label: 'Strict',
      desc: 'Enums restricted to verified status keywords and heavy categorical duplication.',
    },
    balanced: {
      label: 'Balanced',
      desc: 'Semantic entities (names, places, URLs, phones) & code shapes take precedence over Enum.',
    },
    loose: {
      label: 'Loose',
      desc: 'Permits broader cardinality and compact repeating values to form Enums.',
    },
  };

  return (
    <div className="space-y-4">
      <LogProfilePanel analysis={analysis} onSelectSchemaSource={onSelectSchemaSource} />

      {/* Sensitivity Preset Toolbar */}
      {onSensitivityChange && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border-subtle bg-secondary/70 text-xs">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-accent shrink-0" />
            <div>
              <span className="font-bold text-content text-xs">Enum Detection Sensitivity:</span>
              <p className="text-[11px] text-content-muted">{sensitivityLabels[sensitivity].desc}</p>
            </div>
          </div>

          <div className="flex items-center p-0.5 rounded-lg bg-primary border border-border-subtle">
            {(['strict', 'balanced', 'loose'] as InferenceSensitivity[]).map((mode) => {
              const active = sensitivity === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSensitivityChange(mode)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-content-muted hover:text-content hover:bg-tertiary/50'
                  }`}
                  title={sensitivityLabels[mode].desc}
                >
                  {active && <Check size={11} />}
                  <span>{sensitivityLabels[mode].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Simulation Schema Table */}
      <div className="border border-border-subtle rounded-xl overflow-hidden bg-secondary/50">
        <div className="px-4 py-2.5 bg-secondary border-b border-border-subtle flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-content">
              Suggested simulation schema ({analysis.extractedColumns.length} fields)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary text-content-muted font-mono uppercase">
              Mode: {sensitivity}
            </span>
          </div>
          <span className="text-[10px] text-content-muted font-mono break-all">
            Source: {analysis.sampleFileUsed || 'Folder context'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-primary/50 text-[10px] uppercase font-bold text-content-muted border-b border-border-subtle">
                <th className="p-2.5 pl-4">Column Name</th>
                <th className="p-2.5">Inferred Type &amp; 1-Click Alternates</th>
                <th className="p-2.5">Inferred Rule</th>
                <th className="p-2.5 pr-4">Sample Values Observed</th>
                <th className="p-2.5 pr-4">Why this type?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 font-mono text-[11px]">
              {analysis.extractedColumns.map((col, idx) => {
                const alternates = col.alternateTypes || [];
                return (
                  <tr key={(col as any).id || `${col.name}-${idx}`} className="hover:bg-tertiary/40">
                    <td className="p-2.5 pl-4 font-bold text-content align-top">{col.name}</td>
                    <td className="p-2.5 align-top">
                      <div className="space-y-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-bold">
                          {col.inferredType}
                        </span>

                        {alternates.length > 0 && onUpdateColumnType && (
                          <div className="flex flex-wrap items-center gap-1 font-sans">
                            <span className="text-[9px] text-content-muted">Switch:</span>
                            {alternates.map((alt) => (
                              <button
                                key={`${alt.type}-${alt.rule}`}
                                type="button"
                                onClick={() => onUpdateColumnType(col.name, alt.type, alt.rule, alt.reason)}
                                title={`Switch to ${alt.label}: ${alt.reason || alt.rule}`}
                                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-tertiary hover:bg-accent/20 hover:text-accent text-content border border-border-subtle transition cursor-pointer"
                              >
                                {alt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td title={col.inferredRule} className="p-2.5 text-content-muted truncate max-w-[160px] align-top">
                      {col.inferredRule || 'Standard'}
                    </td>
                    <td className="p-2.5 pr-4 text-content-muted truncate max-w-[200px] align-top">
                      {col.sampleValues && col.sampleValues.length > 0 ? col.sampleValues.join(', ') : 'Synthesized default'}
                    </td>
                    <td className="p-2.5 min-w-56 align-top">
                      <InferenceEvidence column={col} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
