import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  X, 
  Plus, 
  Search, 
  Copy, 
  Trash2, 
  Edit2, 
  Check, 
  Folder, 
  FileText, 
  Layers, 
  Download,
  Settings2,
  Clock,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { WorkspaceSession } from '../types';
import { COLOR_TAGS } from '../utils/workspaceStorage';
import { exportSchemaJSON } from '../utils/sessionManager';

export const WorkspaceSidebarDrawer: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    displayMode,
    switchWorkspace,
    createWorkspace,
    duplicateWorkspace,
    renameWorkspace,
    deleteWorkspace,
    isSettingsModalOpen,
    setIsSettingsModalOpen
  } = useWorkspace();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vampio_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vampio_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          toggleCollapsed();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapsed]);

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const filtered = useMemo(() => {
    if (!search.trim()) return workspaces;
    const q = search.toLowerCase();
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.tableName.toLowerCase().includes(q) ||
        (w.format && w.format.toLowerCase().includes(q))
    );
  }, [workspaces, search]);

  if (displayMode !== 'sidebar') return null;

  const handleStartRename = (ws: WorkspaceSession) => {
    setEditingId(ws.id);
    setEditingName(ws.name);
  };

  const handleCommitRename = async () => {
    if (editingId && editingName.trim()) {
      await renameWorkspace(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const getColorDot = (tagId?: string) => {
    const item = COLOR_TAGS.find((c) => c.id === tagId);
    return item ? item.dot : 'bg-emerald-500';
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render Collapsed Sidebar Rail (Browser vertical tabs style)
  if (isCollapsed) {
    return (
      <aside className="w-12 shrink-0 bg-secondary/95 border-r border-border flex flex-col h-full select-none text-xs z-20 transition-all duration-200">
        {/* Collapsed Header / Toggle */}
        <div className="w-full p-2 flex flex-col items-center border-b border-border-subtle bg-card/40 gap-1.5">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-content-muted hover:text-content hover:bg-card border border-transparent hover:border-border-subtle transition-all cursor-pointer shadow-2xs"
            title="Expand Sidebar (Ctrl+B)"
            aria-label="Expand Sidebar"
          >
            <PanelLeftOpen size={14} className="text-accent" />
          </button>

          <button
            type="button"
            onClick={() =>
              createWorkspace({
                name: `Project ${workspaces.length + 1}`,
                tableName: `dataset_${workspaces.length + 1}`,
                columns: [],
              })
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 hover:border-accent/40 transition-all cursor-pointer shadow-2xs"
            title="New Workspace"
            aria-label="New Workspace"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Collapsed Workspace List */}
        <div className="w-full flex-1 overflow-y-auto px-2 py-1.5 flex flex-col items-center gap-1.5 no-scrollbar">
          {workspaces.map((ws, idx) => {
            const isActive = ws.id === activeWorkspaceId;
            const initial = ws.name ? ws.name.trim().charAt(0).toUpperCase() : `${idx + 1}`;

            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => switchWorkspace(ws.id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center relative transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-card border border-accent text-accent font-bold shadow-xs'
                    : 'bg-card/40 hover:bg-card border border-border-subtle hover:border-border text-content-muted hover:text-content'
                }`}
                title={`${ws.name} (${ws.tableName || 'table'}) · ${ws.columns?.length || 0} cols`}
              >
                <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${getColorDot(ws.colorTag)}`} />
                <span className="text-[11px] font-mono leading-none">
                  {initial}
                </span>
              </button>
            );
          })}
        </div>

        {/* Collapsed Footer: Settings */}
        <div className="w-full p-2 border-t border-border-subtle flex flex-col items-center bg-card/20">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(!isSettingsModalOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isSettingsModalOpen
                ? 'bg-card text-accent border border-accent/40 shadow-xs'
                : 'text-content-muted hover:text-content hover:bg-card border border-transparent'
            }`}
            title="Workspace Settings"
            aria-label="Workspace Settings"
          >
            <Settings2 size={13} />
          </button>
        </div>
      </aside>
    );
  }

  // Render Expanded Sidebar Drawer
  return (
    <aside className="w-72 shrink-0 bg-secondary/95 border-r border-border flex flex-col h-full select-none text-xs z-20 transition-all duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle bg-card/40">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-accent" />
          <span className="font-semibold text-content text-xs">Workspaces</span>
          <span className="text-[10px] font-mono text-content-muted">
            ({workspaces.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(!isSettingsModalOpen)}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isSettingsModalOpen
                ? 'bg-card text-accent'
                : 'text-content-muted hover:text-content hover:bg-card'
            }`}
            title="Workspace Settings"
          >
            <Settings2 size={13} />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1 rounded-md text-content-muted hover:text-content hover:bg-card transition-colors flex items-center gap-1 cursor-pointer"
            title="Collapse Sidebar (Ctrl+B)"
            aria-label="Collapse Sidebar"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="p-2 border-b border-border-subtle space-y-1.5">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2 text-content-muted/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects..."
            className="w-full pl-7 pr-2 py-1 bg-card border border-border-subtle rounded-md text-xs text-content placeholder:text-content-muted/50 focus:outline-hidden focus:border-accent"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            createWorkspace({
              name: `Project ${workspaces.length + 1}`,
              tableName: `dataset_${workspaces.length + 1}`,
              columns: [],
            })
          }
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 rounded-md font-medium text-xs transition-colors cursor-pointer"
        >
          <Plus size={13} />
          <span>New Workspace</span>
        </button>
      </div>

      {/* Project Card List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isEditing = editingId === ws.id;

          return (
            <div
              key={ws.id}
              onClick={() => !isEditing && switchWorkspace(ws.id)}
              className={`group relative p-2.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'bg-card border-accent/40 shadow-xs ring-1 ring-accent/20'
                  : 'bg-card/50 hover:bg-card border-border-subtle hover:border-border text-content-muted hover:text-content'
              }`}
            >
              {/* Card Top Row: Dot, Title, Actions */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getColorDot(ws.colorTag)}`} />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleCommitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="w-full px-1 py-0 bg-secondary border border-accent rounded text-xs text-content focus:outline-hidden"
                    />
                  ) : (
                    <span className="font-semibold text-content text-xs truncate">
                      {ws.name}
                    </span>
                  )}
                </div>

                {/* Quick card action buttons on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(ws);
                    }}
                    className="p-1 rounded hover:bg-secondary text-content-muted hover:text-content"
                    title="Rename"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateWorkspace(ws.id);
                    }}
                    className="p-1 rounded hover:bg-secondary text-content-muted hover:text-content"
                    title="Duplicate"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportSchemaJSON(ws.columns, ws.tableName);
                    }}
                    className="p-1 rounded hover:bg-secondary text-content-muted hover:text-content"
                    title="Export Blueprint JSON"
                  >
                    <Download size={11} />
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkspace(ws.id);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-content-muted hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Metadata: Table Name, Columns, Format, Time */}
              <div className="flex items-center justify-between text-[11px] text-content-muted/70 font-mono tabular-nums">
                <span className="truncate max-w-[120px]">{ws.tableName}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="uppercase text-[10px]">{ws.format || 'csv'}</span>
                  <span>·</span>
                  <span>{ws.columns?.length || 0} cols</span>
                </div>
              </div>

              {/* Sub-row: Updated time & Dirty status */}
              <div className="mt-1 flex items-center justify-between text-[10px] text-content-muted/60">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>{formatTime(ws.updatedAt)}</span>
                </span>
                {ws.isDirty && (
                  <span className="text-amber-400 font-mono text-[9px] font-medium">
                    ● Unsaved
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-content-muted">
            <p className="text-xs">No workspaces match &quot;{search}&quot;</p>
          </div>
        )}
      </div>
    </aside>
  );
};
