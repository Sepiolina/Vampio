import React, { useRef } from 'react';
import { 
  X, 
  Settings2, 
  Save, 
  Layout, 
  Check, 
  Download, 
  Upload, 
  Command
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
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
          alert('Invalid workspaces backup file.');
        }
      } catch (err: any) {
        alert(`Failed to import workspaces: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="w-full max-w-lg bg-card border-2 border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-100 text-content">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-border bg-secondary">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-accent text-white">
              <Settings2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-content">Workspace & Project Settings</h2>
              <p className="text-xs text-content-muted">Configure multi-project switcher layout & persistence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-1.5 rounded-md text-content hover:bg-card border border-transparent hover:border-border transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto bg-card">
          {/* Section 1: Save & Persistence Policy */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-content flex items-center gap-1.5 uppercase tracking-wider">
              <Save size={14} className="text-accent" />
              <span>Workspace Save Policy</span>
            </label>
            <p className="text-xs text-content-muted leading-relaxed">
              How Vampio manages unsaved schema edits when swapping between projects:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option A: Auto-save */}
              <button
                type="button"
                onClick={() => setSavePolicy('auto')}
                className={`flex items-start gap-3 p-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  savePolicy === 'auto'
                    ? 'bg-secondary border-accent text-content shadow-xs'
                    : 'bg-secondary/40 hover:bg-secondary border-border text-content-muted hover:text-content'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  savePolicy === 'auto' ? 'border-accent bg-accent text-white' : 'border-border'
                }`}>
                  {savePolicy === 'auto' && <Check size={11} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-content flex items-center gap-2">
                    <span>Auto-Save to IndexedDB on Switch</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-content-muted mt-0.5">
                    Seamlessly persists changes in real-time. Zero delays, zero risk of data loss.
                  </p>
                </div>
              </button>

              {/* Option B: Prompt before switch */}
              <button
                type="button"
                onClick={() => setSavePolicy('prompt')}
                className={`flex items-start gap-3 p-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  savePolicy === 'prompt'
                    ? 'bg-secondary border-accent text-content shadow-xs'
                    : 'bg-secondary/40 hover:bg-secondary border-border text-content-muted hover:text-content'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  savePolicy === 'prompt' ? 'border-accent bg-accent text-white' : 'border-border'
                }`}>
                  {savePolicy === 'prompt' && <Check size={11} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-content">
                    Prompt to Confirm Before Switching
                  </div>
                  <p className="text-xs text-content-muted mt-0.5">
                    Opens a modal dialog asking whether to save, discard, or cancel when leaving an edited project.
                  </p>
                </div>
              </button>

              {/* Option C: Manual save only */}
              <button
                type="button"
                onClick={() => setSavePolicy('manual')}
                className={`flex items-start gap-3 p-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  savePolicy === 'manual'
                    ? 'bg-secondary border-accent text-content shadow-xs'
                    : 'bg-secondary/40 hover:bg-secondary border-border text-content-muted hover:text-content'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  savePolicy === 'manual' ? 'border-accent bg-accent text-white' : 'border-border'
                }`}>
                  {savePolicy === 'manual' && <Check size={11} strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-content flex items-center gap-1.5">
                    <span>Manual Save with Dirty Dot Indicators</span>
                    <span className="text-xs font-mono text-amber-400 font-bold">●</span>
                  </div>
                  <p className="text-xs text-content-muted mt-0.5">
                    Displays an unsaved dot indicator. Projects only persist when you press Save or <kbd className="text-xs font-mono bg-card px-1.5 py-0.5 rounded border border-border">Ctrl+S</kbd>.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Display Layout Mode */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-content flex items-center gap-1.5 uppercase tracking-wider">
              <Layout size={14} className="text-accent" />
              <span>Workspace Navigation Style</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDisplayMode('top-bar')}
                className={`flex flex-col gap-1 p-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  displayMode === 'top-bar'
                    ? 'bg-secondary border-accent text-content shadow-xs'
                    : 'bg-secondary/40 hover:bg-secondary border-border text-content-muted'
                }`}
              >
                <div className="text-xs font-bold text-content">Top Tab Bar (IDE / Browser)</div>
                <div className="text-xs text-content-muted">Horizontal tabs directly beneath the header.</div>
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode('sidebar')}
                className={`flex flex-col gap-1 p-3.5 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  displayMode === 'sidebar'
                    ? 'bg-secondary border-accent text-content shadow-xs'
                    : 'bg-secondary/40 hover:bg-secondary border-border text-content-muted'
                }`}
              >
                <div className="text-xs font-bold text-content">Sidebar Workspace Drawer</div>
                <div className="text-xs text-content-muted">Docked panel with project list and rich metadata.</div>
              </button>
            </div>
          </div>

          {/* Section 3: Keyboard Shortcuts */}
          <div className="space-y-2 pt-2 border-t-2 border-border">
            <label className="text-xs font-bold text-content flex items-center gap-1.5 uppercase tracking-wider">
              <Command size={14} className="text-accent" />
              <span>Keyboard Shortcuts</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-md bg-secondary border border-border">
                <span className="text-content-muted font-medium">Quick Switcher</span>
                <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-card text-content rounded border border-border">⌘/Ctrl + K</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-secondary border border-border">
                <span className="text-content-muted font-medium">Save Workspace</span>
                <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-card text-content rounded border border-border">⌘/Ctrl + S</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-secondary border border-border">
                <span className="text-content-muted font-medium">Switch Tabs</span>
                <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-card text-content rounded border border-border">Ctrl+Alt+←/→</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-secondary border border-border">
                <span className="text-content-muted font-medium">Rename Tab</span>
                <span className="text-xs font-mono font-bold text-accent">Double-click</span>
              </div>
            </div>
          </div>

          {/* Section 4: Backup & Restore Workspaces */}
          <div className="space-y-2 pt-2 border-t-2 border-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs font-bold text-content">Export / Restore All Projects</div>
                <div className="text-xs text-content-muted">Backup all active workspaces into a single JSON bundle</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-card border-2 border-border text-xs text-content font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download size={13} />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-card border-2 border-border text-xs text-content font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Upload size={13} />
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
        <div className="flex items-center justify-end px-5 py-3.5 border-t-2 border-border bg-secondary">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-5 py-2 rounded-md bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
