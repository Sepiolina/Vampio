import React from 'react';
import { LogProfilePanel } from './LogProfilePanel';
import { FolderAnalysisResult } from '../../utils/folderBehaviorAnalyzer';

export interface FolderMonitorSchemaTabProps {
  analysis: FolderAnalysisResult | null;
  onSelectSchemaSource?: (name: string) => void;
}

export const FolderMonitorSchemaTab: React.FC<FolderMonitorSchemaTabProps> = ({ analysis, onSelectSchemaSource }) => {
  if (!analysis?.extractedColumns || analysis.extractedColumns.length === 0) {
    return (
      <div className="space-y-4">
        {analysis && <LogProfilePanel analysis={analysis} onSelectSchemaSource={onSelectSchemaSource} />}
        <p className="text-center py-6 text-xs text-content-muted">No structured fields inferred. Select files with readable text to inspect their profiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LogProfilePanel analysis={analysis} onSelectSchemaSource={onSelectSchemaSource} />
      <div className="border border-border-subtle rounded-xl overflow-hidden bg-secondary/50">
        <div className="px-4 py-2 bg-secondary border-b border-border-subtle flex flex-wrap gap-2 items-center justify-between">
          <span className="text-xs font-bold text-content">
            Suggested simulation schema ({analysis.extractedColumns.length} fields)
          </span>
          <span className="text-[10px] text-content-muted font-mono break-all">
            Source: {analysis.sampleFileUsed || 'Folder context'}
          </span>
        </div>

        <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-primary/50 text-[10px] uppercase font-bold text-content-muted border-b border-border-subtle">
              <th className="p-2.5 pl-4">Column Name</th>
              <th className="p-2.5">Inferred Type</th>
              <th className="p-2.5">Inferred Rule</th>
              <th className="p-2.5 pr-4">Sample Values Observed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/50 font-mono text-[11px]">
            {analysis.extractedColumns.map((col, idx) => (
              <tr key={(col as any).id || `${col.name}-${idx}`} className="hover:bg-tertiary/40">
                <td className="p-2.5 pl-4 font-bold text-content">{col.name}</td>
                <td className="p-2.5">
                  <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-bold">
                    {col.inferredType}
                  </span>
                </td>
                <td className="p-2.5 text-content-muted truncate max-w-[150px]">
                  {col.inferredRule || 'Standard'}
                </td>
                <td className="p-2.5 pr-4 text-content-muted truncate max-w-[200px]">
                  {col.sampleValues.length > 0 ? col.sampleValues.join(', ') : 'Synthesized default'}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};
