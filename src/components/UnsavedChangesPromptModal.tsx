import React from 'react';
import { AlertCircle, Save, Trash2, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-md bg-secondary border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-content">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-content">
                Save changes to &quot;{activeWorkspace?.name}&quot;?
              </h3>
              <p className="text-xs text-content-muted leading-relaxed">
                You have unsaved changes in this workspace. Switching to &quot;{targetWs?.name || 'another project'}&quot; without saving will discard recent modifications.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelSwitch}
              className="px-3 py-1.5 rounded-md border border-border-subtle hover:bg-secondary text-xs text-content font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSwitchWithoutSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-medium transition-colors"
            >
              <Trash2 size={12} />
              <span>Discard Changes</span>
            </button>
            <button
              type="button"
              onClick={confirmSwitchWithSave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90 text-xs font-medium transition-colors shadow-xs"
            >
              <Save size={12} />
              <span>Save & Switch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
