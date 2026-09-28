import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Search, 
  Copy, 
  FileCode, 
  Sparkles, 
  Check, 
  Save, 
  FolderInput, 
  Edit3,
  ChevronDown,
  Layers
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { WorkspaceSession } from '../types';
import { COLOR_TAGS } from '../utils/workspaceStorage';
import { PRESET_SCHEMAS } from '../data/presets';

interface Props {
  onOpenImportBundle?: () => void;
  onOpenPresets?: () => void;
  onOpenFolderMonitor?: () => void;
}

export const WorkspaceTabBar: React.FC<Props> = ({
  onOpenImportBundle,
  onOpenPresets,
  onOpenFolderMonitor
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
    setIsQuickSwitcherOpen
  } = useWorkspace();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Close Add Menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isAddMenuOpen]);

  // Focus rename input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // If sidebar mode is active, completely collapse/hide the top tab bar
  if (displayMode !== 'top-bar') {
    return null;
  }

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

  const handleCreateNewBlank = async () => {
    setIsAddMenuOpen(false);
    await createWorkspace({
      name: `Project ${workspaces.length + 1}`,
      tableName: `dataset_${workspaces.length + 1}`,
      columns: [],
    });
  };

  const handleDuplicateActive = async () => {
    setIsAddMenuOpen(false);
    await duplicateWorkspace(activeWorkspaceId);
  };

  const handlePresetSelect = async (presetId: string) => {
    setIsAddMenuOpen(false);
    const preset = PRESET_SCHEMAS.find((p) => p.id === presetId);
    if (!preset) return;
    await createWorkspace({
      name: preset.name,
      tableName: preset.tableName,
      columns: preset.columns,
    });
  };

  const getColorDot = (tagId?: string) => {
    const item = COLOR_TAGS.find((c) => c.id === tagId);
    return item ? item.dot : 'bg-emerald-500';
  };

  return (
    <div className="flex items-center justify-between h-9 min-h-[36px] max-h-[36px] px-2 bg-secondary/80 border-b border-border-subtle select-none text-xs z-30">
      {/* Left: Scrollable Tabs */}
      <div 
        ref={tabListRef} 
        className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 flex-1 max-w-[calc(100vw-340px)] sm:max-w-none mr-2"
      >
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isEditing = editingId === ws.id;

          return (
            <div
              key={ws.id}
              onClick={() => !isEditing && switchWorkspace(ws.id)}
              onDoubleClick={(e) => handleStartRename(ws, e)}
              className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 whitespace-nowrap border shrink-0 ${
                isActive
                  ? 'bg-card text-content border-border shadow-xs'
                  : 'bg-transparent text-content-muted hover:text-content hover:bg-card/40 border-transparent hover:border-border-subtle/50'
              }`}
              title={`${ws.name} (${ws.columns?.length || 0} columns) - Double click to rename`}
            >
              {/* Colored status dot */}
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColorDot(ws.colorTag)}`} />

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
                  className="w-24 px-1 py-0 bg-secondary border border-accent rounded text-xs text-content focus:outline-hidden"
                />
              ) : (
                <span className="max-w-[130px] truncate">{ws.name}</span>
              )}

              {/* Format tag & column count */}
              <div className="flex items-center gap-1 text-[10px] text-content-muted/70 font-mono tabular-nums">
                <span className="uppercase">{ws.format || 'csv'}</span>
                <span>·</span>
                <span>{ws.columns?.length || 0}c</span>
              </div>

              {/* Dirty indicator */}
              {ws.isDirty && (
                <span 
                  className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" 
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
                  className="ml-0.5 p-0.5 rounded-sm hover:bg-rose-500/20 hover:text-rose-400 text-content-muted/60 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Close workspace"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus / New Workspace Dropdown */}
        <div ref={addMenuRef} className="relative inline-block shrink-0">
          <button
            type="button"
            onClick={() => setIsAddMenuOpen((prev) => !prev)}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-card/70 text-content-muted hover:text-content border border-transparent hover:border-border-subtle transition-colors"
            title="New Project Workspace"
          >
            <Plus size={13} />
          </button>

          {isAddMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-lg shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={handleCreateNewBlank}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors"
              >
                <Plus size={13} className="text-emerald-400" />
                <span>Blank Workspace</span>
              </button>
              <button
                type="button"
                onClick={handleDuplicateActive}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors"
              >
                <Copy size={13} className="text-indigo-400" />
                <span>Duplicate Active</span>
              </button>
              {onOpenPresets && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    onOpenPresets();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors"
                >
                  <Sparkles size={13} className="text-amber-400" />
                  <span>From Preset Template...</span>
                </button>
              )}
              {onOpenImportBundle && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    onOpenImportBundle();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors"
                >
                  <FolderInput size={13} className="text-sky-400" />
                  <span>Import Profile Bundle...</span>
                </button>
              )}

              <div className="h-px bg-border-subtle my-1" />

              <div className="px-2 py-1 text-[10px] uppercase font-mono tracking-wider text-content-muted">
                Popular Presets
              </div>
              {PRESET_SCHEMAS.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-xs text-content-muted hover:text-content hover:bg-secondary text-left transition-colors"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] font-mono text-content-muted/60">{p.columns.length}c</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Quick Switcher, Save Indicator & Layout Toggles */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-border-subtle/80">
        {/* Save Status / Manual Save Button */}
        {savePolicy === 'manual' ? (
          <button
            type="button"
            onClick={saveActiveWorkspace}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
              activeWorkspace?.isDirty
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 animate-pulse'
                : 'bg-secondary text-content-muted border border-border-subtle hover:text-content'
            }`}
            title="Save active workspace (Ctrl/Cmd+S)"
          >
            <Save size={11} />
            <span>{activeWorkspace?.isDirty ? 'Save' : 'Saved'}</span>
          </button>
        ) : (
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-content-muted/70 px-1.5">
            <Check size={11} className="text-emerald-400" />
            <span className="capitalize">{savePolicy} save</span>
          </div>
        )}

        {/* Quick Switcher Trigger (Cmd/Ctrl + K) */}
        <button
          type="button"
          onClick={() => setIsQuickSwitcherOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card/60 hover:bg-card border border-border-subtle hover:border-border text-content-muted hover:text-content text-[11px] transition-colors"
          title="Quick Switch Workspace (Ctrl/Cmd + K)"
        >
          <Search size={11} />
          <span className="hidden xl:inline">Switch</span>
          <kbd className="hidden sm:inline-block px-1 py-0 text-[9px] font-mono bg-secondary rounded border border-border-subtle">
            ⌘K
          </kbd>
        </button>
      </div>
    </div>
  );
};
