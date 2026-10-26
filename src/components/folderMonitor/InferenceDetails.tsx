import React from 'react';
import type { ExtractedFolderColumn } from '../../utils/folderBehaviorAnalyzer';

export function TypeInferenceGuide() {
  return (
    <details className="rounded-lg border border-border-subtle bg-primary text-xs">
      <summary className="p-3 cursor-pointer font-semibold text-content">How Enum, Regex and String are chosen</summary>
      <div className="px-3 pb-3 space-y-2 text-content-muted leading-relaxed">
        <p><strong className="text-content">Enum:</strong> Recognized status labels such as OK, Error and not OK, or short repeated categories. Generic categories need at least four nonempty samples, at most 32 choices, and no more than half the samples distinct. All observed choices and their frequency weights are retained. A category-like header can suggest a provisional enum from sparse samples.</p>
        <p><strong className="text-content">Regex:</strong> Mostly distinct codes with consistent character groups, separators and widths. At least three distinct codes and 70% distinct values are needed; zero-padded codes can establish their width sooner. Generated codes follow the pattern rather than copying the observed list.</p>
        <p><strong className="text-content">String:</strong> Free text, mixed shapes or insufficient evidence for categories or a safe code pattern. Numbers, valid dates, times and other recognized formats are checked first.</p>
        <p>Decisions use up to 200 records from each bounded file sample. Confidence describes the available evidence, not certainty about the full file. Review the explanation and change a type or rule in Developer Studio if needed.</p>
      </div>
    </details>
  );
}

export function InferenceEvidence({ column }: { column: ExtractedFolderColumn }) {
  if (!column.inferenceReason) return <span className="text-content-muted">No inference explanation recorded.</span>;
  return (
    <div className="space-y-1 min-w-0 text-xs text-content-muted [overflow-wrap:anywhere]">
      <p>{column.inferenceReason}</p>
      <p className="text-[10px] font-mono">
        {Number.isFinite(column.inferenceConfidence) && <span>{column.inferenceConfidence}% confidence · </span>}
        {column.nonNullCount ?? 0}/{column.sampleCount ?? 0} nonempty · {column.distinctCount ?? 0} distinct
        {Number.isFinite(column.nullRatio) && <span> · {Math.round(column.nullRatio! * 100)}% missing</span>}
      </p>
    </div>
  );
}
