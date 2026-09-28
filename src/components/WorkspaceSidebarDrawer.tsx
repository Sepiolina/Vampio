import React, { useState, useMemo } from 'react';
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
  Sparkles
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
    setDisplayMode,
    setIsSettingsModalOpen
  } = useWorkspace();

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

  const handleCreateBlankWorkspace = async () => {
    const newWs = await createWorkspace({
      name: `Workspace ${workspaces.length + 1}`,
      tableName: `table_${workspaces.length + 1}`,
      columns: [],
    });
    setEditingId(newWs.id);
    setEditingName(newWs.name);
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

  return (
    <aside className="w-72 shrink-0 bg-secondary border-r-2 border-border flex flex-col h-[calc(100vh-44px)] select-none text-xs z-20 shadow-md">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-accent" />
          <span className="font-bold text-content text-xs uppercase tracking-wider">Project Workspaces</span>
          <span className="text-[11px] font-mono font-bold text-accent bg-accent/15 px-1.5 py-0.2 rounded border border-accent/30">
            {workspaces.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-1 rounded-md text-content hover:bg-secondary border border-transparent hover:border-border transition-colors cursor-pointer"
            title="Workspace Settings"
          >
            <Settings2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('top-bar')}
            className="p-1 rounded-md text-content hover:bg-secondary border border-transparent hover:border-border transition-colors cursor-pointer"
            title="Switch to Top Tab Bar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="p-2.5 border-b border-border bg-secondary space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-content-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-card border border-border rounded-md text-xs text-content placeholder:text-content-muted focus:outline-hidden focus:border-accent"
          />
        </div>

        <button
          type="button"
          onClick={handleCreateBlankWorkspace}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded-md font-bold text-xs transition-colors cursor-pointer shadow-xs"
        >
          <Plus size={14} />
          <span>New Blank Workspace</span>
        </button>
      </div>

      {/* Project Card List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-secondary">
        {filtered.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isEditing = editingId === ws.id;
          const colCount = ws.columns?.length || 0;

          return (
            <div
              key={ws.id}
              onClick={() => !isEditing && switchWorkspace(ws.id)}
              className={`group relative p-3 rounded-lg border-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-card border-accent shadow-sm'
                  : 'bg-card hover:bg-tertiary border-border text-content'
              }`}
            >
              {/* Card Top Row: Dot, Title, Actions */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColorDot(ws.colorTag)}`} />
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
                      className="w-full px-1.5 py-0.5 bg-secondary border-2 border-accent rounded text-xs text-content font-bold focus:outline-hidden"
                    />
                  ) : (
                    <span className="font-bold text-content text-xs truncate">
                      {ws.name}
                    </span>
                  )}
                </div>

                {/* Quick card action buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(ws);
                    }}
                    className="p-1 rounded hover:bg-secondary text-content-muted hover:text-content border border-transparent hover:border-border"
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateWorkspace(ws.id);
                    }}
                    className="p-1 rounded hover:bg-secondary text-content-muted hover:text-content border border-transparent hover:border-border"
                    title="Duplicate"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportSchemaJSON(ws.columns, ws.tableName);
                    }}
                    className="p-1 rounded hover:bg-secondary text-content-muted hover:text-content border border-transparent hover:border-border"
                    title="Export Blueprint JSON"
                  >
                    <Download size={12} />
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkspace(ws.id);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-content-muted hover:text-rose-400 border border-transparent hover:border-rose-500/30"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Metadata: Table Name, Columns, Format, Time */}
              <div className="flex items-center justify-between text-xs text-content-muted font-mono tabular-nums">
                <span className="truncate max-w-[130px] font-semibold text-content">{ws.tableName}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="uppercase text-[11px] font-bold px-1.5 py-0.2 rounded bg-secondary border border-border">
                    {ws.format || 'csv'}
                  </span>
                  <span>·</span>
                  <span className="font-bold">{colCount} cols</span>
                </div>
              </div>

              {/* Sub-row: Updated time & Dirty status */}
              <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[11px] text-content-muted">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  <span>{formatTime(ws.updatedAt)}</span>
                </span>
                {ws.isDirty && (
                  <span className="text-amber-400 font-mono text-[10px] font-bold">
                    ● Unsaved
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-content-muted bg-card p-4 rounded-lg border border-border">
            <p className="text-xs">No workspaces match &quot;{search}&quot;</p>
          </div>
        )}
      </div>
    </aside>
  );
};
