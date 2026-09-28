import React, { useState, useEffect, useRef } from 'react';
import { Search, Layers, ArrowRight, CornerDownLeft, Check, Plus } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { COLOR_TAGS } from '../utils/workspaceStorage';

export const WorkspaceQuickSwitcherModal: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    isQuickSwitcherOpen,
    setIsQuickSwitcherOpen,
    switchWorkspace,
    createWorkspace
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = workspaces.filter((ws) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      ws.name.toLowerCase().includes(q) ||
      ws.tableName.toLowerCase().includes(q) ||
      (ws.format && ws.format.toLowerCase().includes(q))
    );
  });

  // Focus input when opened
  useEffect(() => {
    if (isQuickSwitcherOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isQuickSwitcherOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        switchWorkspace(filtered[selectedIndex].id);
        setIsQuickSwitcherOpen(false);
      } else if (query.trim()) {
        // Create new workspace with typed name
        createWorkspace({ name: query.trim() });
        setIsQuickSwitcherOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsQuickSwitcherOpen(false);
    }
  };

  if (!isQuickSwitcherOpen) return null;

  const getColorDot = (tagId?: string) => {
    const item = COLOR_TAGS.find((c) => c.id === tagId);
    return item ? item.dot : 'bg-emerald-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/80 backdrop-blur-md select-none">
      <div 
        className="w-full max-w-lg bg-secondary border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-border-subtle bg-primary/40">
          <Search size={16} className="text-content-muted mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Switch workspace or type new project name..."
            className="w-full bg-transparent text-sm text-content placeholder:text-content-muted/60 focus:outline-hidden"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-content-muted bg-secondary rounded border border-border-subtle shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1 bg-secondary">
          {filtered.map((ws, idx) => {
            const isSelected = idx === selectedIndex;
            const isActive = ws.id === activeWorkspaceId;

            return (
              <div
                key={ws.id}
                onClick={() => {
                  switchWorkspace(ws.id);
                  setIsQuickSwitcherOpen(false);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-accent/15 border-accent/40 text-content shadow-2xs' 
                    : 'bg-primary/40 hover:bg-primary/70 border-transparent text-content-muted hover:text-content'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getColorDot(ws.colorTag)}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-content truncate">{ws.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-content-muted font-mono truncate mt-0.5">
                      {ws.tableName} · {ws.columns?.length || 0} columns · {ws.format?.toUpperCase() || 'CSV'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isSelected && (
                    <span className="text-[10px] font-mono text-accent flex items-center gap-1">
                      <span>Jump</span>
                      <CornerDownLeft size={10} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-content-muted">
              <p>No existing workspace matches &quot;{query}&quot;.</p>
              <button
                type="button"
                onClick={() => {
                  createWorkspace({ name: query.trim() });
                  setIsQuickSwitcherOpen(false);
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-xs"
              >
                <Plus size={13} />
                <span>Create &quot;{query.trim()}&quot; as New Workspace</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-subtle bg-primary/40 text-[10px] font-mono text-content-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to close</span>
          </div>
          <span>Total {workspaces.length} workspaces</span>
        </div>
      </div>
    </div>
  );
};
