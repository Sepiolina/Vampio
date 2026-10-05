import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Close Add Menu on outside click or Escape key
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(target) &&
        dropdownPortalRef.current &&
        !dropdownPortalRef.current.contains(target)
      ) {
        setIsAddMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddMenuOpen]);

  // Keep menu position anchored when scrolling tab bar or resizing window
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const updatePosition = () => {
      if (addMenuRef.current) {
        const rect = addMenuRef.current.getBoundingClientRect();
        setMenuCoords({
          top: rect.bottom + 4,
          left: Math.min(Math.max(8, rect.left), window.innerWidth - 220),
        });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isAddMenuOpen]);

  const handleToggleAddMenu = () => {
    if (!isAddMenuOpen && addMenuRef.current) {
      const rect = addMenuRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + 4,
        left: Math.min(Math.max(8, rect.left), window.innerWidth - 220),
      });
    }
    setIsAddMenuOpen((prev) => !prev);
  };

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
    const existingNames = new Set(workspaces.map((w) => w.name.toLowerCase()));
    let nextNum = workspaces.length + 1;
    while (
      existingNames.has(`workspace ${nextNum}`.toLowerCase()) || 
      existingNames.has(`project ${nextNum}`.toLowerCase()) ||
      existingNames.has(`tab ${nextNum}`.toLowerCase())
    ) {
      nextNum++;
    }
    await createWorkspace({
      name: `Workspace ${nextNum}`,
      tableName: `dataset_${nextNum}`,
      columns: [],
    });
    setTimeout(() => {
      if (tabListRef.current) {
        tabListRef.current.scrollTo({ left: tabListRef.current.scrollWidth, behavior: 'smooth' });
      }
    }, 40);
  };

  const handleDuplicateActive = async () => {
    setIsAddMenuOpen(false);
    await duplicateWorkspace(activeWorkspaceId);
    setTimeout(() => {
      if (tabListRef.current) {
        tabListRef.current.scrollTo({ left: tabListRef.current.scrollWidth, behavior: 'smooth' });
      }
    }, 40);
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
    setTimeout(() => {
      if (tabListRef.current) {
        tabListRef.current.scrollTo({ left: tabListRef.current.scrollWidth, behavior: 'smooth' });
      }
    }, 40);
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
        onDoubleClick={(e) => {
          if (e.target === tabListRef.current) {
            handleCreateNewBlank();
          }
        }}
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

        {/* Plus / New Workspace (Click creates immediately, chevron opens templates) */}
        <div ref={addMenuRef} className="relative inline-flex items-center shrink-0">
          <button
            type="button"
            onClick={handleCreateNewBlank}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-card text-content-muted hover:text-accent border border-transparent hover:border-border-subtle transition-all active:scale-95 cursor-pointer"
            title="New Tab (Click to create new workspace)"
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={handleToggleAddMenu}
            className={`flex items-center justify-center w-4 h-6 -ml-1 rounded-r-md hover:bg-card text-content-muted hover:text-content border border-transparent hover:border-border-subtle transition-colors cursor-pointer ${
              isAddMenuOpen ? 'bg-card text-accent' : ''
            }`}
            title="Tab options (Duplicate, Preset...)"
            aria-expanded={isAddMenuOpen}
          >
            <ChevronDown size={10} className={`transition-transform duration-150 ${isAddMenuOpen ? 'rotate-180 text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Render Dropdown Menu via Portal so it is never clipped by tabList overflow or tab bar height */}
      {isAddMenuOpen && menuCoords && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownPortalRef}
          className="fixed z-50 w-52 bg-card border border-border rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100 text-content select-none"
          style={{ top: menuCoords.top, left: menuCoords.left }}
        >
          <button
            type="button"
            onClick={() => {
              setIsAddMenuOpen(false);
              handleCreateNewBlank();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors cursor-pointer"
          >
            <Plus size={13} className="text-emerald-400" />
            <span>Blank Workspace</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddMenuOpen(false);
              handleDuplicateActive();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors cursor-pointer"
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
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors cursor-pointer"
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
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-content hover:bg-secondary text-left transition-colors cursor-pointer"
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
              onClick={() => {
                setIsAddMenuOpen(false);
                handlePresetSelect(p.id);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-xs text-content-muted hover:text-content hover:bg-secondary text-left transition-colors cursor-pointer"
            >
              <span className="truncate">{p.name}</span>
              <span className="text-[10px] font-mono text-content-muted/60">{p.columns.length}c</span>
            </button>
          ))}
        </div>,
        document.body
      )}

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
