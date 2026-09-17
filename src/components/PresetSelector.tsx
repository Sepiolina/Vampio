import React, { useRef } from 'react';
import { PresetSchema, ColumnSpec } from '../types';
import { PRESET_SCHEMAS } from '../data/presets';
import { X, Layers, ArrowRight, Download, Upload, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetSchema) => void;
  currentColumns: ColumnSpec[];
  onImportSchema: (cols: ColumnSpec[], tableName?: string) => void;
  tableName: string;
}

export const PresetSelector: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectPreset,
  currentColumns,
  onImportSchema,
  tableName
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportCurrent = () => {
    const payload = {
      tableName,
      exportedAt: new Date().toISOString(),
      columns: currentColumns
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName || 'vampio_schema'}.schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportSchema(parsed);
          onClose();
        } else if (parsed.columns && Array.isArray(parsed.columns)) {
          onImportSchema(parsed.columns, parsed.tableName);
          onClose();
        }
      } catch (err) {
        alert('Invalid JSON schema file: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-primary border border-border-subtle rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-secondary">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-content shadow-md">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-content">Preset Schemas & Templates</h3>
              <p className="text-xs text-content-muted">
                Jumpstart synthetic generation with production patterns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-content-muted hover:text-content hover:bg-tertiary rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Import / Export Bar */}
        <div className="px-6 py-3 bg-secondary border-b border-border-subtle flex items-center justify-between gap-3 text-xs">
          <div className="text-content-muted">
            Have an existing schema definition or want to save your current setup?
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary hover:bg-tertiary hover:opacity-80 text-content transition font-medium"
            >
              <Upload size={13} />
              <span>Import JSON</span>
            </button>
            <button
              onClick={handleExportCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary hover:bg-tertiary hover:opacity-80 text-content transition font-medium"
            >
              <Download size={13} />
              <span>Export Current</span>
            </button>
          </div>
        </div>

        {/* Preset Cards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {PRESET_SCHEMAS.map((preset) => (
            <div
              key={preset.id}
              className="group p-4 bg-secondary hover:bg-secondary border border-border-subtle hover:border-accent rounded-xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-content group-hover:text-accent transition">
                    {preset.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-tertiary text-content-muted border border-border-subtle">
                    {preset.category}
                  </span>
                  <span className="text-[10px] font-mono text-content-muted">
                    {preset.columns.length} columns
                  </span>
                </div>
                <p className="text-xs text-content-muted leading-relaxed">
                  {preset.description}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {preset.columns.slice(0, 6).map((c) => (
                    <span
                      key={c.id}
                      className="text-[10px] font-mono bg-primary px-2 py-0.5 rounded border border-border-subtle text-content"
                    >
                      {c.name}: <span className="text-accent">{c.type}</span>
                    </span>
                  ))}
                  {preset.columns.length > 6 && (
                    <span className="text-[10px] font-mono text-content-muted">
                      +{preset.columns.length - 6} more
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-content text-xs font-semibold transition shadow-md whitespace-nowrap self-start md:self-center"
              >
                <span>Load Schema</span>
                <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
