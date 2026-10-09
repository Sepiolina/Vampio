import React, { useRef, useEffect, useState } from 'react';
import { 
  X, 
  Settings2, 
  Save, 
  Layout, 
  Sliders, 
  Check, 
  Download, 
  Upload, 
  Command, 
  AlertCircle,
  FolderSync
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { WorkspaceSavePolicy, WorkspaceDisplayMode } from '../types';
import { exportWorkspacesAsJson } from '../utils/workspaceStorage';

export const WorkspaceSettingsModal: React.FC = () => {
  const {
    workspaces,
    savePolicy,
    displayMode,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    setSavePolicy,
    setDisplayMode,
    createWorkspace
  } = useWorkspace();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSettingsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, setIsSettingsModalOpen]);

  if (!isSettingsModalOpen) return null;

  const handleExportAll = () => {
    const jsonStr = exportWorkspacesAsJson(workspaces);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vampio_all_workspaces_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.workspaces && Array.isArray(parsed.workspaces)) {
          for (const ws of parsed.workspaces) {
            await createWorkspace({
              name: ws.name || 'Imported Workspace',
              tableName: ws.tableName,
              columns: ws.columns || [],
              format: ws.format || 'csv',
            });
          }
          setIsSettingsModalOpen(false);
        } else {
          setErrorMsg('Invalid workspaces backup file.');
        }
      } catch (err: any) {
        setErrorMsg(`Failed to import workspaces: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/35 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsSettingsModalOpen(false);
      }}
    >
      <div className="w-full max-w-lg bg-secondary border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-content flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-primary/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent/15 text-accent border border-accent/25">
              <Settings2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-content">Workspace & Project Settings</h2>
              <p className="text-[11px] text-content-muted">Configure multi-project switcher layout & persistence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-primary/60 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {errorMsg && (
          <div className="px-5 py-2.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button 
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-red-300 ml-2"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto bg-secondary">
          {/* Section 1: Save & Persistence Policy */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-content flex items-center gap-1.5">
              <Save size={13} className="text-accent" />
              <span>Workspace Save Policy</span>
            </label>
            <p className="text-[11px] text-content-muted leading-relaxed">
              How Vampio manages unsaved schema edits when swapping between projects:
            </p>

            <div className="grid grid-cols-1 gap-2">
              {/* Option A: Auto-save */}
              <button
                type="button"
                onClick={() => setSavePolicy('auto')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  savePolicy === 'auto'
                    ? 'bg-accent/15 border-accent text-content shadow-xs ring-1 ring-accent/30'
                    : 'bg-primary/50 hover:bg-primary/80 border-border-subtle text-content-muted hover:text-content'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  savePolicy === 'auto' ? 'border-accent bg-accent text-white' : 'border-border-subtle'
                }`}>
                  {savePolicy === 'auto' && <Check size={10} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-content flex items-center gap-1.5">
                    <span>Auto-Save to IndexedDB on Switch</span>
                    <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-content-muted mt-1 leading-normal">
                    Seamlessly persists changes in real-time. Zero delays, zero risk of data loss.
                  </p>
                </div>
              </button>

              {/* Option B: Prompt before switch */}
              <button
                type="button"
                onClick={() => setSavePolicy('prompt')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  savePolicy === 'prompt'
                    ? 'bg-accent/15 border-accent text-content shadow-xs ring-1 ring-accent/30'
                    : 'bg-primary/50 hover:bg-primary/80 border-border-subtle text-content-muted hover:text-content'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  savePolicy === 'prompt' ? 'border-accent bg-accent text-white' : 'border-border-subtle'
                }`}>
                  {savePolicy === 'prompt' && <Check size={10} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-content">
                    Prompt to Confirm Before Switching
                  </div>
                  <p className="text-[11px] text-content-muted mt-1 leading-normal">
                    Opens a modal dialog asking whether to save, discard, or cancel when leaving an edited project.
                  </p>
                </div>
              </button>

              {/* Option C: Manual save only */}
              <button
                type="button"
                onClick={() => setSavePolicy('manual')}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  savePolicy === 'manual'
                    ? 'bg-accent/15 border-accent text-content shadow-xs ring-1 ring-accent/30'
                    : 'bg-primary/50 hover:bg-primary/80 border-border-subtle text-content-muted hover:text-content'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  savePolicy === 'manual' ? 'border-accent bg-accent text-white' : 'border-border-subtle'
                }`}>
                  {savePolicy === 'manual' && <Check size={10} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-content flex items-center gap-1.5">
                    <span>Manual Save with Dirty Dot Indicators</span>
                    <span className="text-[9px] font-mono text-amber-400">●</span>
                  </div>
                  <p className="text-[11px] text-content-muted mt-1 leading-normal">
                    Displays an unsaved dot indicator. Projects only persist when you press Save or <kbd className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded border border-border-subtle text-content">Ctrl+S</kbd>.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Display Layout Mode */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-content flex items-center gap-1.5">
              <Layout size={13} className="text-accent" />
              <span>Workspace Navigation Style</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDisplayMode('top-bar')}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                  displayMode === 'top-bar'
                    ? 'bg-accent/15 border-accent text-content shadow-xs ring-1 ring-accent/30'
                    : 'bg-primary/50 hover:bg-primary/80 border-border-subtle text-content-muted hover:text-content'
                }`}
              >
                <div className="text-xs font-semibold text-content">Top Tab Bar (IDE / Browser)</div>
                <div className="text-[11px] text-content-muted mt-0.5">Horizontal tabs directly beneath the header.</div>
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode('sidebar')}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                  displayMode === 'sidebar'
                    ? 'bg-accent/15 border-accent text-content shadow-xs ring-1 ring-accent/30'
                    : 'bg-primary/50 hover:bg-primary/80 border-border-subtle text-content-muted hover:text-content'
                }`}
              >
                <div className="text-xs font-semibold text-content">Sidebar Workspace Drawer</div>
                <div className="text-[11px] text-content-muted mt-0.5">Docked panel with project list and rich metadata.</div>
              </button>
            </div>
          </div>

          {/* Section 3: Keyboard Shortcuts */}
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <label className="text-xs font-semibold text-content flex items-center gap-1.5">
              <Command size={13} className="text-accent" />
              <span>Keyboard Shortcuts</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/50 border border-border-subtle">
                <span className="text-content-muted">Quick Switcher</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary rounded border border-border-subtle text-content font-medium">⌘/Ctrl + K</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/50 border border-border-subtle">
                <span className="text-content-muted">Save Workspace</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary rounded border border-border-subtle text-content font-medium">⌘/Ctrl + S</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/50 border border-border-subtle">
                <span className="text-content-muted">Switch Tabs</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary rounded border border-border-subtle text-content font-medium">Ctrl+Alt+←/→</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/50 border border-border-subtle">
                <span className="text-content-muted">Rename Tab</span>
                <span className="text-[10px] font-mono text-content-muted">Double-click</span>
              </div>
            </div>
          </div>

          {/* Section 4: Backup & Restore Workspaces */}
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <div className="p-3 rounded-xl bg-primary/50 border border-border-subtle flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-content">Export / Restore All Projects</div>
                <div className="text-[11px] text-content-muted">Backup all active workspaces into a single JSON bundle</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary border border-border-subtle text-xs text-content font-medium transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary border border-border-subtle text-xs text-content font-medium transition-colors cursor-pointer"
                >
                  <Upload size={12} />
                  <span>Restore</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-border-subtle bg-primary/40">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
