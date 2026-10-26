import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { FolderAnalysisResult, exportWorkspaceProfileBundleJson } from '../../utils/folderBehaviorAnalyzer';
import { exportLogProfileMarkdown, exportSimulationTemplateJson } from '../../utils/profileExports';
import { saveFileToDiskOrDownload } from '../../utils/fileSystem';

interface Props {
  analysis: FolderAnalysisResult;
  folderPath?: string;
}

/** Shared export choices keep workspace profiles and Presets templates distinct. */
export function ProfileExportControls({ analysis, folderPath }: Props) {
  const [includeSamples, setIncludeSamples] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const hasInferredColumns = analysis.extractedColumns.length > 0;

  const save = async (kind: 'profile' | 'template' | 'markdown') => {
    if (saving || (kind !== 'markdown' && !hasInferredColumns)) return;
    setSaving(kind);
    setMessage('');
    setFailed(false);
    try {
      const content = kind === 'profile'
        ? exportWorkspaceProfileBundleJson(analysis, folderPath, { includeSamples })
        : kind === 'template'
          ? exportSimulationTemplateJson(analysis)
          : exportLogProfileMarkdown(analysis, { includeSamples });
      const safeName = (analysis.folderName || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_');
      const extension = kind === 'markdown' ? 'md' : 'json';
      const suffix = kind === 'profile' ? 'vampio.profile.json' : kind === 'template' ? 'simulation.json' : 'report.md';
      const result = await saveFileToDiskOrDownload(`${safeName}-${suffix}`, content,
        kind === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json', {
          title: kind === 'profile' ? 'Save workspace profile' : kind === 'template' ? 'Save simulation template' : 'Save Markdown report',
          filters: [{ name: kind === 'markdown' ? 'Markdown report' : 'JSON file', extensions: [extension] }],
        });
      if (result.cancelled) setMessage('Save cancelled.');
      else if (result.success) setMessage(result.downloaded ? 'Download started.' : `Saved${result.path ? `: ${result.path}` : '.'}`);
      else throw new Error('The file could not be saved. Try another location.');
    } catch (error) {
      setFailed(true);
      setMessage(`Export failed: ${error instanceof Error ? error.message : 'Could not save this file.'}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section aria-label="Export log analysis" className="min-w-0 max-w-full [overflow-wrap:anywhere] space-y-3 p-4 rounded-xl bg-secondary border border-border-subtle">
      <div className="text-xs font-bold text-content">Export analysis</div>
      {hasInferredColumns && <p role="status" className="text-xs text-content-muted break-words">Simulation source: <span className="font-mono font-semibold text-content">{analysis.sampleFileUsed || 'Inferred schema'}</span> ({analysis.extractedColumns.length} fields). JSON exports use this schema. The Markdown report includes the full file inventory and all file profiles.</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        {([
          ['profile', 'Profile JSON', 'Import into workspace settings'],
          ['template', 'Simulation template JSON', 'Import through Presets'],
          ['markdown', 'Markdown report', 'Readable findings and evidence'],
        ] as const).map(([kind, label, description]) => (
          <button key={kind} type="button" onClick={() => void save(kind)} disabled={saving !== null || (kind !== 'markdown' && !hasInferredColumns)}
            className="min-w-0 max-w-full p-3 rounded-lg bg-primary border border-border-subtle text-left hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-xs">
            <span className="flex items-center gap-2 font-semibold text-content"><Download size={14} className="shrink-0" />{saving === kind ? 'Saving…' : label}</span>
            <span className="block text-content-muted mt-1">{description}</span>
          </button>
        ))}
      </div>
      {!hasInferredColumns && <p className="text-xs text-content-muted">No fields were inferred from these files. Profile JSON and simulation templates require an inferred schema; export Markdown for the file inventory and read findings.</p>}
      <label className="flex items-start gap-2 text-xs text-content-muted cursor-pointer">
        <input type="checkbox" checked={includeSamples} onChange={event => setIncludeSamples(event.target.checked)} className="mt-0.5 shrink-0" />
        <span>Include observed sample values and raw snippets in profile JSON and Markdown (off by default). Inferred field names, constants, enums, and ranges can still retain source information in JSON exports. Review exports before sharing.</span>
      </label>
      {message && <p role={failed ? 'alert' : 'status'} className={`text-xs break-words ${failed ? 'text-rose-400' : 'text-content-muted'}`}>{message}</p>}
    </section>
  );
}
