import React from 'react';
import type { ExtractedFolderColumn } from '../../utils/folderBehaviorAnalyzer';

export function TypeInferenceGuide() {
  return (
    <details className="rounded-lg border border-border-subtle bg-primary text-xs">
      <summary className="p-3 cursor-pointer font-semibold text-content">How Entities, Enum, Regex and String are inferred</summary>
      <div className="px-3 pb-3 space-y-2 text-content-muted leading-relaxed">
        <p><strong className="text-content">Semantic Entities:</strong> Verified entity shapes—including URLs, domains, phone numbers, email addresses, cities, countries, person names, and company names—take strict priority over Set/Enum, preventing premature classification of real-world vocabularies into static enum lists.</p>
        <p><strong className="text-content">Regex &amp; Code Shapes:</strong> Structured alphanumeric codes (e.g. SKU numbers, order IDs, zero-padded tokens) generalize into pattern expressions rather than fixed enum copies.</p>
        <p><strong className="text-content">Enum &amp; Sensitivity Modes:</strong> Status choices (OK, NG, active, inactive) are recognized immediately. For general categories, sensitivity presets control the threshold: <em>Strict</em> requires verified status keywords or heavy duplication; <em>Balanced</em> prioritizes entities and patterns while grouping clear categories; <em>Loose</em> permits wider cardinality tolerance.</p>
        <p><strong className="text-content">1-Click Alternates:</strong> Whenever a column could plausibly be interpreted as an Enum, Regex, or Entity, instant 1-click alternative switches appear directly in the schema table for immediate override.</p>
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
