import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  X, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  FolderCheck, 
  Sparkles, 
  Languages, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  ArrowRight,
  Database
} from 'lucide-react';
import { 
  VampioWorkspaceProfileBundle, 
  validateAndParseWorkspaceBundle, 
  formatFileSize 
} from '../utils/folderBehaviorAnalyzer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyBundle: (bundle: VampioWorkspaceProfileBundle) => void;
  onApplyAsNewWorkspace?: (bundle: VampioWorkspaceProfileBundle) => void;
}

export const WorkspaceBundleImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApplyBundle,
  onApplyAsNewWorkspace,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [bundle, setBundle] = useState<VampioWorkspaceProfileBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessText = (text: string) => {
    setError(null);
    const { valid, error: validationError, bundle: parsedBundle } = validateAndParseWorkspaceBundle(text);
    if (!valid || !parsedBundle) {
      setError(validationError || 'Invalid bundle JSON format');
      setBundle(null);
      return;
    }
    setBundle(parsedBundle);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessText(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessText(content);
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (!bundle) return;
    onApplyBundle(bundle);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-secondary border border-border-subtle w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-border-subtle bg-primary/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-accent/15 text-accent">
                <FileCode size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-content">Import Behavior Profile Bundle</h2>
                <p className="text-xs text-content-muted">
                  Load a `.vampio.profile.json` exported by field technicians or folder monitors
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-content-muted hover:text-content hover:bg-tertiary rounded-lg transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.vampio.profile.json"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Dropzone */}
            {!bundle ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition cursor-pointer text-center ${
                  dragActive
                    ? 'border-accent bg-accent/10'
                    : 'border-border-subtle hover:border-accent/50 hover:bg-primary/50'
                }`}
              >
                <div className="p-3.5 rounded-full bg-accent/15 text-accent">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-content">
                    Drag and drop your <span className="text-accent font-mono">.vampio.profile.json</span> here
                  </p>
                  <p className="text-xs text-content-muted mt-0.5">
                    or click to browse from your computer
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-secondary border border-border-subtle text-content-muted">
                  JSON Workspace Bundle v1.0
                </span>
              </div>
            ) : (
              /* Verified Bundle Preview */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-accent" />
                      <span className="font-bold text-xs text-content font-mono">
                        Valid Profile Bundle: {bundle.source.folderName}
                      </span>
                    </div>
                    <p className="text-xs text-content-muted">
                      Source: {bundle.source.platform.toUpperCase()} · {bundle.source.folderPath || 'Production Folder'} · {bundle.metrics.totalFiles} files ({formatFileSize(bundle.metrics.totalSizeBytes)})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBundle(null)}
                    className="text-xs text-accent hover:underline font-medium cursor-pointer"
                  >
                    Change File
                  </button>
                </div>

                {/* Forensic Snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-primary border border-border-subtle font-mono">
                    <div className="text-[10px] text-content-muted uppercase">Format</div>
                    <div className="font-bold text-content mt-0.5">{bundle.forensics.dominantExtension}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary border border-border-subtle font-mono">
                    <div className="text-[10px] text-content-muted uppercase">Delimiter</div>
                    <div className="font-bold text-content mt-0.5">{bundle.forensics.delimiterName || 'N/A'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary border border-border-subtle font-mono">
                    <div className="text-[10px] text-content-muted uppercase">Encoding</div>
                    <div className="font-bold text-content mt-0.5 truncate" title={bundle.forensics.encoding}>
                      {bundle.forensics.encoding}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary border border-border-subtle font-mono">
                    <div className="text-[10px] text-content-muted uppercase">Lock State</div>
                    <div className="font-bold mt-0.5 truncate">
                      {bundle.forensics.fileLockStatus === 'no_lock_detected' ? (
                        <span className="text-emerald-400">Clean</span>
                      ) : (
                        <span className="text-amber-400">Active Write</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Schema Columns Preview */}
                <div className="p-3.5 rounded-xl bg-primary border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-content flex items-center gap-1.5">
                      <Sparkles size={13} className="text-accent" />
                      <span>Workspace Columns to Generate ({bundle.vampioWorkspace.columns.length})</span>
                    </span>
                    <span className="text-[10px] font-mono text-content-muted">
                      Table: {bundle.vampioWorkspace.tableName}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {bundle.vampioWorkspace.columns.map((col, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border-subtle text-[11px] font-mono"
                      >
                        <span className="font-semibold text-content">{col.name}</span>
                        <span className="text-[9px] px-1 rounded bg-accent/15 text-accent font-bold">
                          {col.type}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Generation Settings Preview */}
                <div className="p-3 rounded-lg bg-secondary border border-border-subtle text-xs text-content-muted flex items-center justify-between flex-wrap gap-2">
                  <span>Strategy: <strong className="text-content font-mono">{bundle.vampioWorkspace.outputStrategy}</strong></span>
                  <span>Naming: <strong className="text-accent font-mono">{bundle.vampioWorkspace.filenamePattern}</strong></span>
                  <span>Interval: <strong className="text-content font-mono">{bundle.vampioWorkspace.intervalMs}ms</strong></span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border-subtle bg-primary/40 flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {onApplyAsNewWorkspace && (
                <button
                  type="button"
                  onClick={() => {
                    if (!bundle) return;
                    onApplyAsNewWorkspace(bundle);
                    onClose();
                  }}
                  disabled={!bundle}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                    bundle
                      ? 'bg-secondary hover:bg-card text-accent border-accent/40 shadow-xs'
                      : 'bg-secondary text-content-muted border-border-subtle opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>Open as New Workspace Tab</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleApply}
                disabled={!bundle}
                className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  bundle
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-secondary text-content-muted opacity-50 cursor-not-allowed'
                }`}
              >
                <span>Apply to Current Workspace</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
