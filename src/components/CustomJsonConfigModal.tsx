import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Code, 
  Check, 
  AlertCircle, 
  Copy, 
  Sparkles, 
  RotateCcw, 
  FileCode, 
  Variable, 
  CheckCircle2,
  Braces
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { CustomJsonConfig, ColumnSpec } from '../types';
import { 
  JSON_TEMPLATE_PRESETS, 
  DEFAULT_CUSTOM_JSON_TEMPLATE, 
  DEFAULT_CUSTOM_JSON_CONFIG,
  validateJsonTemplate, 
  renderCustomJsonTemplate 
} from '../utils/customJsonTemplate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Optional override props for action/webhook config modal if passed directly
  configOverride?: CustomJsonConfig;
  onSaveOverride?: (config: CustomJsonConfig) => void;
  columns?: ColumnSpec[];
  tableName?: string;
  sampleRows?: Record<string, unknown>[];
}

export const CustomJsonConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  configOverride,
  onSaveOverride,
  columns: passedColumns,
  tableName: passedTableName,
  sampleRows: passedSampleRows
}) => {
  const { activeWorkspace, updateCustomJsonConfig } = useWorkspace();

  // Determine initial configuration
  const currentConfig: CustomJsonConfig = useMemo(() => {
    if (configOverride) return configOverride;
    if (activeWorkspace?.customJsonConfig) return activeWorkspace.customJsonConfig;
    return DEFAULT_CUSTOM_JSON_CONFIG;
  }, [configOverride, activeWorkspace?.customJsonConfig]);

  const [enabled, setEnabled] = useState<boolean>(currentConfig.enabled);
  const [template, setTemplate] = useState<string>(currentConfig.template || DEFAULT_CUSTOM_JSON_TEMPLATE);
  const [rowTemplate, setRowTemplate] = useState<string>(currentConfig.rowTemplate || '');
  const [useRowTemplate, setUseRowTemplate] = useState<boolean>(Boolean(currentConfig.rowTemplate?.trim()));
  const [prettyPrint, setPrettyPrint] = useState<boolean>(currentConfig.prettyPrint !== false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state whenever modal opens or currentConfig changes
  useEffect(() => {
    if (isOpen) {
      setEnabled(currentConfig.enabled);
      setTemplate(currentConfig.template || DEFAULT_CUSTOM_JSON_TEMPLATE);
      setRowTemplate(currentConfig.rowTemplate || '');
      setUseRowTemplate(Boolean(currentConfig.rowTemplate?.trim()));
      setPrettyPrint(currentConfig.prettyPrint !== false);
    }
  }, [isOpen, currentConfig]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const effectiveColumns = useMemo(() => {
    if (passedColumns && passedColumns.length > 0) return passedColumns;
    return activeWorkspace?.columns || [];
  }, [passedColumns, activeWorkspace?.columns]);

  const effectiveTableName = passedTableName || activeWorkspace?.tableName || 'users';

  // Generate realistic sample records for live preview
  const sampleData = useMemo(() => {
    if (passedSampleRows && passedSampleRows.length > 0) return passedSampleRows.slice(0, 3);

    // Build 2 synthetic preview rows based on active columns
    const cols = effectiveColumns.length > 0 
      ? effectiveColumns 
      : [
          { name: 'id', type: 'Int' },
          { name: 'name', type: 'String' },
          { name: 'email', type: 'String' },
          { name: 'status', type: 'String' }
        ];

    return [
      cols.reduce((acc, c) => {
        if (c.name.toLowerCase().includes('id')) acc[c.name] = 101;
        else if (c.name.toLowerCase().includes('email')) acc[c.name] = 'alice@example.com';
        else if (c.name.toLowerCase().includes('name')) acc[c.name] = 'Alice Johnson';
        else if (c.name.toLowerCase().includes('status')) acc[c.name] = 'active';
        else if (c.name.toLowerCase().includes('price') || c.name.toLowerCase().includes('amount')) acc[c.name] = 49.99;
        else acc[c.name] = `Sample ${c.name} 1`;
        return acc;
      }, {} as Record<string, unknown>),
      cols.reduce((acc, c) => {
        if (c.name.toLowerCase().includes('id')) acc[c.name] = 102;
        else if (c.name.toLowerCase().includes('email')) acc[c.name] = 'bob@example.com';
        else if (c.name.toLowerCase().includes('name')) acc[c.name] = 'Bob Smith';
        else if (c.name.toLowerCase().includes('status')) acc[c.name] = 'pending';
        else if (c.name.toLowerCase().includes('price') || c.name.toLowerCase().includes('amount')) acc[c.name] = 89.50;
        else acc[c.name] = `Sample ${c.name} 2`;
        return acc;
      }, {} as Record<string, unknown>)
    ];
  }, [passedSampleRows, effectiveColumns]);

  // Validate template in real-time
  const colNames = useMemo(() => effectiveColumns.map((c) => c.name), [effectiveColumns]);
  const validation = useMemo(() => {
    return validateJsonTemplate(template, colNames);
  }, [template, colNames]);

  // Live rendered preview
  const previewJson = useMemo(() => {
    try {
      return renderCustomJsonTemplate(
        {
          enabled: true,
          template,
          rowTemplate: useRowTemplate ? rowTemplate : undefined,
          prettyPrint
        },
        sampleData,
        {
          tableName: effectiveTableName,
          count: sampleData.length,
          timestamp: new Date().toISOString()
        }
      );
    } catch (err: unknown) {
      return `// Preview rendering error:\n${err instanceof Error ? err.message : String(err)}`;
    }
  }, [template, rowTemplate, useRowTemplate, prettyPrint, sampleData, effectiveTableName]);

  if (!isOpen) return null;

  // Insert placeholder token at textarea cursor position
  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setTemplate((prev) => prev + placeholder);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = template;
    const next = current.substring(0, start) + placeholder + current.substring(end);
    setTemplate(next);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 10);
  };

  const handleApplyPreset = (preset: typeof JSON_TEMPLATE_PRESETS[0]) => {
    setTemplate(preset.template);
    if (preset.rowTemplate) {
      setRowTemplate(preset.rowTemplate);
      setUseRowTemplate(true);
    } else {
      setRowTemplate('');
      setUseRowTemplate(false);
    }
  };

  const handleReset = () => {
    setTemplate(DEFAULT_CUSTOM_JSON_TEMPLATE);
    setRowTemplate('');
    setUseRowTemplate(false);
    setEnabled(false);
  };

  const handleSave = async () => {
    const updatedConfig: CustomJsonConfig = {
      enabled,
      template: template.trim() || DEFAULT_CUSTOM_JSON_TEMPLATE,
      rowTemplate: useRowTemplate && rowTemplate.trim() ? rowTemplate.trim() : undefined,
      prettyPrint
    };

    if (onSaveOverride) {
      onSaveOverride(updatedConfig);
    } else {
      await updateCustomJsonConfig(updatedConfig);
    }
    onClose();
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewJson);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-secondary border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-content flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-primary/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent/15 text-accent border border-accent/25">
              <Braces size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-content">Custom JSON Payload Architecture</h2>
                {enabled && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-content-muted">
                Define the root envelope and nested schema for file exports, JSON preview & webhook dispatches
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-primary/60 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Top Control Bar: Master Toggle + Presets */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-primary/60 border border-border-subtle">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  enabled ? 'bg-accent' : 'bg-tertiary'
                }`}
                role="switch"
                aria-checked={enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <div>
                <span className="font-semibold text-content block">
                  {enabled ? 'Custom JSON Structure Enabled' : 'Standard Array Format'}
                </span>
                <span className="text-[10px] text-content-muted block">
                  {enabled 
                    ? 'Outputs payload according to your template below' 
                    : 'Outputs standard flat array [ { ... }, { ... } ]'}
                </span>
              </div>
            </div>

            {/* Presets Quick Picker */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider flex items-center gap-1 mr-1">
                <Sparkles size={11} className="text-accent" />
                Presets:
              </span>
              {JSON_TEMPLATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2 py-1 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] text-content-muted hover:text-content transition cursor-pointer"
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Placeholders Variable Bar */}
          <div className="space-y-1.5 bg-card/40 p-3 rounded-xl border border-border-subtle">
            <div className="flex items-center justify-between text-[11px] text-content-muted font-medium">
              <span className="flex items-center gap-1">
                <Variable size={12} className="text-accent" />
                <span>Click a placeholder token to insert at cursor:</span>
              </span>
              <span className="text-[10px] font-mono text-content-muted/80">
                Double curly braces: &#123;&#123;variable&#125;&#125;
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => insertPlaceholder('"{{records}}"')}
                className="px-2 py-0.5 rounded-md bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-mono text-[10px] font-semibold transition cursor-pointer"
                title="Inserts array of generated records"
              >
                "&#123;&#123;records&#125;&#125;" (Full Array)
              </button>
              <button
                type="button"
                onClick={() => insertPlaceholder('"{{count}}"')}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-content font-mono text-[10px] transition cursor-pointer"
                title="Total row count"
              >
                &#123;&#123;count&#125;&#125;
              </button>
              <button
                type="button"
                onClick={() => insertPlaceholder('"{{timestamp}}"')}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-content font-mono text-[10px] transition cursor-pointer"
                title="ISO 8601 Timestamp"
              >
                &#123;&#123;timestamp&#125;&#125;
              </button>
              <button
                type="button"
                onClick={() => insertPlaceholder('"{{tableName}}"')}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-content font-mono text-[10px] transition cursor-pointer"
                title="Current dataset or table name"
              >
                &#123;&#123;tableName&#125;&#125;
              </button>
              <button
                type="button"
                onClick={() => insertPlaceholder('"{{epochMs}}"')}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-content font-mono text-[10px] transition cursor-pointer"
                title="Unix timestamp milliseconds"
              >
                &#123;&#123;epochMs&#125;&#125;
              </button>

              {/* Column Fields */}
              {effectiveColumns.slice(0, 6).map((col, idx) => (
                <button
                  key={col.id || `${col.name}-${idx}`}
                  type="button"
                  onClick={() => insertPlaceholder(`"{{${col.name}}}"`)}
                  className="px-1.5 py-0.5 rounded-md bg-primary hover:bg-tertiary border border-border-subtle/80 text-content-muted hover:text-content font-mono text-[10px] transition cursor-pointer"
                  title={`Insert column: ${col.name} (${col.type})`}
                >
                  &#123;&#123;{col.name}&#125;&#125;
                </button>
              ))}
            </div>
          </div>

          {/* Main Workspace: Side-by-Side Editor & Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[340px]">
            {/* Left Column: Template Editor */}
            <div className="flex flex-col rounded-xl border border-border-subtle overflow-hidden bg-primary">
              <div className="px-3 py-2 border-b border-border-subtle bg-secondary/80 flex items-center justify-between text-[11px] font-semibold text-content-muted">
                <span className="flex items-center gap-1.5 text-content">
                  <Code size={13} className="text-accent" />
                  <span>Payload Template Editor</span>
                </span>
                
                {/* Real-time Syntax Validation Indicator */}
                <div className="flex items-center gap-1.5">
                  {validation.valid ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 size={11} />
                      <span>Valid JSON</span>
                    </span>
                  ) : (
                    <span 
                      className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 truncate max-w-[180px]"
                      title={validation.error}
                    >
                      <AlertCircle size={11} className="shrink-0" />
                      <span className="truncate">{validation.error}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 p-2 flex flex-col min-h-[260px]">
                <textarea
                  ref={textareaRef}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Enter JSON template with {{records}} placeholder..."
                  spellCheck={false}
                  className="w-full flex-1 bg-transparent p-2 text-xs font-mono text-content placeholder:text-content-muted/50 focus:outline-hidden resize-none leading-relaxed border-0"
                />
              </div>

              {/* Optional Row Schema Template toggle */}
              <div className="p-2.5 border-t border-border-subtle bg-secondary/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-content cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useRowTemplate}
                      onChange={(e) => setUseRowTemplate(e.target.checked)}
                      className="rounded border-border-subtle text-accent focus:ring-accent"
                    />
                    <span>Custom Individual Row Schema (Optional)</span>
                  </label>
                  {useRowTemplate && (
                    <span className="text-[10px] font-mono text-content-muted">
                      Maps each item inside &#123;&#123;records&#125;&#125;
                    </span>
                  )}
                </div>

                {useRowTemplate && (
                  <textarea
                    value={rowTemplate}
                    onChange={(e) => setRowTemplate(e.target.value)}
                    placeholder='{ "id": "{{id}}", "fullName": "{{name}}" }'
                    rows={3}
                    spellCheck={false}
                    className="w-full p-2 bg-primary border border-border-subtle rounded-lg text-xs font-mono text-content focus:outline-hidden focus:border-accent resize-none leading-relaxed"
                  />
                )}
              </div>
            </div>

            {/* Right Column: Live Interactive Preview */}
            <div className="flex flex-col rounded-xl border border-border-subtle overflow-hidden bg-primary">
              <div className="px-3 py-2 border-b border-border-subtle bg-secondary/80 flex items-center justify-between text-[11px] font-semibold text-content-muted">
                <span className="flex items-center gap-1.5 text-content">
                  <FileCode size={13} className="text-emerald-400" />
                  <span>Real-time Output Preview</span>
                  <span className="text-[10px] font-mono text-content-muted font-normal">
                    (Sample 2 records)
                  </span>
                </span>
                
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[10px] text-content-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prettyPrint}
                      onChange={(e) => setPrettyPrint(e.target.checked)}
                      className="rounded border-border-subtle text-accent focus:ring-accent"
                    />
                    <span>Indent (2-spaces)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCopyPreview}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[10px] text-content transition cursor-pointer"
                    title="Copy sample JSON to clipboard"
                  >
                    {copySuccess ? (
                      <>
                        <Check size={10} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={10} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 p-2 overflow-y-auto max-h-[380px] bg-secondary/20">
                <pre className="text-[11px] font-mono text-content/90 p-2 leading-relaxed whitespace-pre-wrap break-all select-text">
                  {previewJson}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-primary/40 flex-shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-content-muted hover:text-content hover:bg-secondary transition text-xs cursor-pointer"
            title="Reset to default envelope template"
          >
            <RotateCcw size={12} />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-border-subtle text-content-muted hover:text-content hover:bg-secondary transition text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white transition text-xs font-semibold shadow-xs cursor-pointer"
            >
              Save & Apply Architecture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
