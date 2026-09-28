import React from 'react';
import { AlertCircle, Save, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

export const UnsavedChangesPromptModal: React.FC = () => {
  const {
    isUnsavedPromptOpen,
    activeWorkspace,
    workspaces,
    pendingTargetWorkspaceId,
    confirmSwitchWithSave,
    confirmSwitchWithoutSave,
    cancelSwitch
  } = useWorkspace();

  if (!isUnsavedPromptOpen) return null;

  const targetWs = workspaces.find((w) => w.id === pendingTargetWorkspaceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="w-full max-w-md bg-card border-2 border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-100 text-content">
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertCircle size={22} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-content">
                Save changes to &quot;{activeWorkspace?.name}&quot;?
              </h3>
              <p className="text-xs text-content-muted leading-relaxed">
                You have unsaved changes in this workspace. Switching to &quot;{targetWs?.name || 'another project'}&quot; without saving will discard recent modifications.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={cancelSwitch}
              className="px-3.5 py-2 rounded-md border-2 border-border hover:bg-secondary text-xs text-content font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSwitchWithoutSave}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border-2 border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Discard Changes</span>
            </button>
            <button
              type="button"
              onClick={confirmSwitchWithSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Save size={13} />
              <span>Save & Switch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
