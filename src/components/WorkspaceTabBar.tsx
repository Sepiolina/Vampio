import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Search, 
  Settings2, 
  Copy, 
  Check, 
  Save, 
  FolderInput, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Edit3,
  ChevronDown,
  Layers,
  Trash2
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { WorkspaceSession } from '../types';
import { COLOR_TAGS } from '../utils/workspaceStorage';

interface Props {
  onOpenImportBundle?: () => void;
  onOpenFolderMonitor?: () => void;
  onClearColumns?: () => void;
}

export const WorkspaceTabBar: React.FC<Props> = ({
  onOpenImportBundle,
  onOpenFolderMonitor,
  onClearColumns
}) => {
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    savePolicy,
    displayMode,
    switchWorkspace,
    createWorkspace,
    duplicateWorkspace,
    renameWorkspace,
    deleteWorkspace,
    saveActiveWorkspace,
    setDisplayMode,
    setIsQuickSwitcherOpen,
    setIsSettingsModalOpen
  } = useWorkspace();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Close options menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsOpen(false);
      }
    };
    if (isOptionsOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOptionsOpen]);

  // Focus rename input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (ws: WorkspaceSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(ws.id);
    setEditingName(ws.name);
  };

  const handleCommitRename = async () => {
    if (editingId && editingName.trim()) {
      await renameWorkspace(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDownRename = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommitRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Direct 1-click creation of a 100% blank workspace (zero mock/fake columns)
  const handleCreateNewBlank = async () => {
    setIsOptionsOpen(false);
    const newWs = await createWorkspace({
      name: `Workspace ${workspaces.length + 1}`,
      tableName: `table_${workspaces.length + 1}`,
      columns: [], // 100% blank state
    });
    // Immediately prompt rename so user can name it their real project
    setEditingId(newWs.id);
    setEditingName(newWs.name);
  };

  const handleDuplicateActive = async () => {
    setIsOptionsOpen(false);
    await duplicateWorkspace(activeWorkspaceId);
  };

  const getColorDot = (tagId?: string) => {
    const item = COLOR_TAGS.find((c) => c.id === tagId);
    return item ? item.dot : 'bg-emerald-500';
  };

  return (
    <div className="flex items-center justify-between h-10 min-h-[40px] max-h-[40px] px-2.5 bg-secondary border-b border-border select-none text-xs z-30 shadow-xs">
      {/* Left: Scrollable Project Tabs */}
      <div 
        ref={tabListRef} 
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1 max-w-[calc(100vw-360px)] sm:max-w-none mr-2"
      >
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isEditing = editingId === ws.id;
          const colCount = ws.columns?.length || 0;

          return (
            <div
              key={ws.id}
              onClick={() => !isEditing && switchWorkspace(ws.id)}
              onDoubleClick={(e) => handleStartRename(ws, e)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap border shrink-0 ${
                isActive
                  ? 'bg-card text-content border-border shadow-xs ring-1 ring-border'
                  : 'bg-secondary hover:bg-card text-content-muted hover:text-content border-border/60 hover:border-border'
              }`}
              title={`${ws.name} (${colCount} columns) - Double click to rename`}
            >
              {/* Colored status dot */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${getColorDot(ws.colorTag)}`} />

              {/* Title / Rename input */}
              {isEditing ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={handleKeyDownRename}
                  onClick={(e) => e.stopPropagation()}
                  className="w-28 px-1.5 py-0.5 bg-secondary border-2 border-accent rounded text-xs text-content focus:outline-hidden font-medium"
                />
              ) : (
                <span className="max-w-[140px] truncate">{ws.name}</span>
              )}

              {/* Format tag & column count */}
              <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-content-muted">
                <span className="uppercase font-semibold">{ws.format || 'csv'}</span>
                <span>·</span>
                <span>{colCount} cols</span>
              </div>

              {/* Dirty indicator */}
              {ws.isDirty && (
                <span 
                  className="w-2 h-2 rounded-full bg-amber-400 shrink-0" 
                  title="Unsaved changes" 
                />
              )}

              {/* Close Button */}
              {workspaces.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkspace(ws.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-400 text-content-muted opacity-60 group-hover:opacity-100 transition-opacity"
                  title="Close workspace"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* Action Group: Direct New Blank Workspace Button + Dropdown Options */}
        <div className="flex items-center gap-0.5 shrink-0" ref={optionsMenuRef}>
          <button
            type="button"
            onClick={handleCreateNewBlank}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card hover:bg-tertiary text-content border border-border hover:border-accent text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Create 100% Blank Workspace (0 columns)"
          >
            <Plus size={13} className="text-accent" />
            <span>New</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOptionsOpen((prev) => !prev)}
              className="p-1 rounded-md bg-card hover:bg-tertiary text-content-muted hover:text-content border border-border transition-colors cursor-pointer"
              title="Workspace creation options"
            >
              <ChevronDown size={12} />
            </button>

            {isOptionsOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-card border-2 border-border rounded-lg shadow-2xl p-1 z-50 text-xs">
                <button
                  type="button"
                  onClick={handleCreateNewBlank}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-content hover:bg-secondary text-left font-medium transition-colors"
                >
                  <Plus size={14} className="text-emerald-400" />
                  <div>
                    <div className="font-semibold">Blank Workspace</div>
                    <div className="text-[10px] text-content-muted">Start fresh with 0 columns</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDuplicateActive}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-content hover:bg-secondary text-left font-medium transition-colors"
                >
                  <Copy size={14} className="text-indigo-400" />
                  <div>
                    <div className="font-semibold">Duplicate Active</div>
                    <div className="text-[10px] text-content-muted">Clone current schema</div>
                  </div>
                </button>

                {onOpenImportBundle && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOptionsOpen(false);
                      onOpenImportBundle();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-content hover:bg-secondary text-left font-medium transition-colors"
                  >
                    <FolderInput size={14} className="text-sky-400" />
                    <div>
                      <div className="font-semibold">Import Profile Bundle</div>
                      <div className="text-[10px] text-content-muted">Open technician JSON profile</div>
                    </div>
                  </button>
                )}

                {onClearColumns && (activeWorkspace?.columns?.length || 0) > 0 && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsOptionsOpen(false);
                        onClearColumns();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 text-left font-medium transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Clear All Columns in Active Tab</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: High-Contrast Save Indicator, Quick Switcher & Layout Toggles */}
      <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-border">
        {/* Save Status / Manual Save Button */}
        {savePolicy === 'manual' ? (
          <button
            type="button"
            onClick={saveActiveWorkspace}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
              activeWorkspace?.isDirty
                ? 'bg-amber-500 text-black border border-amber-400 shadow-xs'
                : 'bg-card text-content border border-border hover:bg-tertiary'
            }`}
            title="Save active workspace (Ctrl/Cmd+S)"
          >
            <Save size={12} />
            <span>{activeWorkspace?.isDirty ? 'Save' : 'Saved'}</span>
          </button>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-content font-medium px-2 py-0.5 rounded bg-card border border-border">
            <Check size={12} className="text-emerald-400 stroke-[3]" />
            <span className="capitalize">{savePolicy} save</span>
          </div>
        )}

        {/* Quick Switcher Trigger (Cmd/Ctrl + K) */}
        <button
          type="button"
          onClick={() => setIsQuickSwitcherOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card hover:bg-tertiary border border-border text-content text-xs font-medium transition-colors cursor-pointer shadow-xs"
          title="Quick Switch Workspace (Ctrl/Cmd + K)"
        >
          <Search size={12} className="text-content-muted" />
          <span className="hidden xl:inline">Switch</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary text-content rounded border border-border font-bold">
            ⌘K
          </kbd>
        </button>

        {/* Toggle to Sidebar Mode */}
        <button
          type="button"
          onClick={() => setDisplayMode(displayMode === 'top-bar' ? 'sidebar' : 'top-bar')}
          className={`p-1.5 rounded-md transition-colors border cursor-pointer ${
            displayMode === 'sidebar'
              ? 'bg-accent text-white border-accent'
              : 'bg-card hover:bg-tertiary text-content border-border'
          }`}
          title={displayMode === 'top-bar' ? 'Switch to Sidebar Workspace Drawer' : 'Switch to Top Tab Bar'}
        >
          {displayMode === 'sidebar' ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>

        {/* Workspace Settings Dialog */}
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-1.5 rounded-md bg-card hover:bg-tertiary text-content border border-border transition-colors cursor-pointer"
          title="Workspace Settings & Save Policy"
        >
          <Settings2 size={14} />
        </button>
      </div>
    </div>
  );
};
