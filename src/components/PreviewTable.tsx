import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ColumnSpec, ThemeId } from '../types';
import { 
  Table, 
  Code, 
  Copy, 
  Check, 
  Search, 
  RefreshCw, 
  List, 
  ChevronDown, 
  ChevronRight, 
  ChevronsDown, 
  ChevronsUp, 
  X, 
  Filter, 
  FilterX, 
  Plus,
  Columns,
  Eye,
  EyeOff,
  Focus
} from 'lucide-react';
import { DataSearch } from './DataSearch';
import { DataHeatmap } from './DataHeatmap';

interface Props {
  columns: ColumnSpec[];
  data: Record<string, unknown>[];
  isStreaming: boolean;
  onRefreshPreview: () => void;
  previewCount: number;
  onChangePreviewCount: (count: number) => void;
  theme: ThemeId;
}

export const PreviewTable: React.FC<Props> = ({
  columns,
  data,
  isStreaming,
  onRefreshPreview,
  previewCount,
  onChangePreviewCount,
  theme
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'json' | 'list'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [collapsedRecords, setCollapsedRecords] = useState<Set<number>>(new Set());
  const [cellContextMenu, setCellContextMenu] = useState<{ x: number, y: number, colName: string, value: string, isNull: boolean } | null>(null);
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number, col: ColumnSpec } | null>(null);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(new Set());
  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);
  const [columnSearchFilter, setColumnSearchFilter] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number, left: number } | null>(null);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);
  const prevColCountRef = useRef(columns.length);

  const toggleColumnsDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isColumnsDropdownOpen) {
      setIsColumnsDropdownOpen(false);
    } else {
      if (columnsButtonRef.current) {
        const rect = columnsButtonRef.current.getBoundingClientRect();
        const left = Math.min(rect.left, Math.max(8, window.innerWidth - 270));
        setDropdownPos({
          top: rect.bottom + 6,
          left: Math.max(8, left)
        });
      }
      setIsColumnsDropdownOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setCellContextMenu(null);
      setHeaderContextMenu(null);
      if (
        columnsDropdownRef.current && 
        !columnsDropdownRef.current.contains(e.target as Node) &&
        columnsButtonRef.current &&
        !columnsButtonRef.current.contains(e.target as Node)
      ) {
        setIsColumnsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isColumnsDropdownOpen && columnsButtonRef.current) {
        const rect = columnsButtonRef.current.getBoundingClientRect();
        const left = Math.min(rect.left, Math.max(8, window.innerWidth - 270));
        setDropdownPos({
          top: rect.bottom + 6,
          left: Math.max(8, left)
        });
      }
    };
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isColumnsDropdownOpen]);

  // Prune hiddenColumnIds if columns are removed from schema
  useEffect(() => {
    setHiddenColumnIds(prev => {
      const validIds = new Set(columns.map(c => c.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach(id => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [columns]);

  // Derived visible columns
  const visibleColumns = useMemo(() => {
    return columns.filter(c => !hiddenColumnIds.has(c.id));
  }, [columns, hiddenColumnIds]);

  const handleHideColumn = (colId: string) => {
    setHiddenColumnIds(prev => new Set([...prev, colId]));
  };

  const handleShowOnlyColumn = (colId: string) => {
    const allOtherIds = columns.filter(c => c.id !== colId).map(c => c.id);
    setHiddenColumnIds(new Set(allOtherIds));
  };

  const handleShowAllColumns = () => {
    setHiddenColumnIds(new Set());
  };

  const handleToggleColumn = (colId: string) => {
    setHiddenColumnIds(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const handleHideAllExceptFirst = () => {
    if (columns.length > 0) {
      const otherIds = columns.slice(1).map(c => c.id);
      setHiddenColumnIds(new Set(otherIds));
    }
  };

  // Auto-switch to list view if crossing 10 columns
  useEffect(() => {
    if (columns.length > 10 && prevColCountRef.current <= 10) {
      setViewMode('list');
    }
    prevColCountRef.current = columns.length;
  }, [columns.length]);

  // Filter rows based on search
  const filteredData = data.filter((row) => {
    if (!searchQuery.trim()) return true;
    const tokens = searchQuery.split(' ').filter(Boolean);
    
    if (tokens.length === 0) return true;

    // Helper to evaluate a single token
    const evaluateToken = (part: string) => {
      part = part.toLowerCase();
      // Column specific search: col_name:value
      if (part.includes(':')) {
        const [colName, expectedVal] = part.split(':');
        const col = columns.find(c => c.name.toLowerCase() === colName);
        if (col) {
          const val = row[col.name];
          if (expectedVal === 'null') {
            return val === null || val === undefined;
          }
          if (expectedVal === '!null') {
            return val !== null && val !== undefined;
          }
          if (expectedVal.startsWith('!')) {
            return !String(val).toLowerCase().includes(expectedVal.substring(1));
          }
          return String(val).toLowerCase().includes(expectedVal);
        }
      }
      
      // Global search
      return Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(part)
      );
    };

    // A very simple expression evaluator for AND/OR
    // Tokens are separated by OR. Each OR group is evaluated with AND.
    const orGroups: string[][] = [[]];
    for (const token of tokens) {
      if (token.toUpperCase() === 'OR' || token === '||') {
        orGroups.push([]);
      } else if (token.toUpperCase() !== 'AND' && token !== '&&') {
        orGroups[orGroups.length - 1].push(token);
      }
    }

    return orGroups.some(group => 
      group.length === 0 ? false : group.every(evaluateToken)
    );
  });

  const handleCopyRow = (row: Record<string, unknown>, idx: number) => {
    const exportedRow = hiddenColumnIds.size === 0
      ? row
      : Object.fromEntries(visibleColumns.map(c => [c.name, row[c.name]]));
    navigator.clipboard.writeText(JSON.stringify(exportedRow, null, 2));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCopyAll = () => {
    const exportedRows = hiddenColumnIds.size === 0 
      ? filteredData 
      : filteredData.map(row => {
          const res: Record<string, unknown> = {};
          visibleColumns.forEach(c => { res[c.name] = row[c.name]; });
          return res;
        });
    navigator.clipboard.writeText(JSON.stringify(exportedRows, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const toggleRecord = (idx: number) => {
    setCollapsedRecords(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedRecords(new Set(filteredData.map((_, i) => i)));
  };

  const expandAll = () => {
    setCollapsedRecords(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-primary overflow-hidden min-w-0">
      {/* Table Header Bar - Row 1 (aligned with Schema Architecture Controls Bar, 40px) */}
      <div className="relative z-30 flex items-center justify-between px-3 sm:px-4 h-10 min-h-[40px] max-h-[40px] border-b border-border-subtle bg-secondary flex-shrink-0 gap-2 select-none w-full min-w-0">
        {/* Left: Title & Records Count */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <div className="flex items-center gap-1.5 text-content min-w-0">
            <Table size={13} className="text-accent flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap truncate">
              <span className="hidden sm:inline">Reactive </span>Preview
            </span>
            {isStreaming && (
              <span className="flex h-2 w-2 relative flex-shrink-0" title="Live Stream Active">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] bg-tertiary text-content-muted px-1.5 py-0.5 rounded-md font-mono border border-border-subtle/50 whitespace-nowrap flex-shrink-0">
            {filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {/* Right: Search Box + Refresh & Copy Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink min-w-0 justify-end">
          <div className="min-w-0 flex-1 flex-shrink max-w-[130px] sm:max-w-[170px] lg:max-w-[210px]">
            <DataSearch 
              value={searchQuery}
              onChange={setSearchQuery}
              columns={columns}
              data={data}
              compact
            />
          </div>

          <button
            type="button"
            onClick={onRefreshPreview}
            title="Regenerate Preview"
            className="h-7 w-7 rounded-md bg-primary hover:bg-tertiary border border-border-subtle text-content-muted hover:text-content flex items-center justify-center transition shadow-2xs active:scale-95 cursor-pointer flex-shrink-0 z-10"
          >
            <RefreshCw size={12} className={isStreaming ? 'animate-spin text-accent' : ''} />
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            title={copiedAll ? 'Copied to clipboard!' : 'Copy preview JSON'}
            className="h-7 w-7 rounded-md bg-primary hover:bg-tertiary border border-border-subtle text-content-muted hover:text-content flex items-center justify-center transition shadow-2xs active:scale-95 cursor-pointer flex-shrink-0 z-10"
          >
            {copiedAll ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Table Sub-header Bar - Row 2 (aligned with Quick Insert Strip, 32px) */}
      <div className="relative z-20 px-3 sm:px-4 h-8 min-h-[32px] max-h-[32px] bg-secondary/50 border-b border-border-subtle flex items-center justify-between gap-2 text-[11px] flex-shrink-0 select-none w-full">
        {/* Left: View Mode Toggle & Sample Row Count */}
        <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-content-muted/80 mr-0.5 flex-shrink-0">
            <span>View:</span>
          </div>

          <div className="flex bg-primary p-0.5 rounded-md border border-border-subtle h-6 items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'table' ? 'bg-accent text-white shadow-2xs' : 'text-content-muted hover:text-content'
              }`}
              title="Table View"
            >
              <Table size={11} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'list' ? 'bg-accent text-white shadow-2xs' : 'text-content-muted hover:text-content'
              }`}
              title="List View"
            >
              <List size={11} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'json' ? 'bg-accent text-white shadow-2xs' : 'text-content-muted hover:text-content'
              }`}
              title="JSON View"
            >
              <Code size={11} />
              <span className="hidden sm:inline">JSON</span>
            </button>
          </div>

          {/* Sample Rows Count Selector */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <select
              value={previewCount}
              onChange={(e) => onChangePreviewCount(Number(e.target.value))}
              className="h-6 px-1.5 text-[10px] font-mono bg-primary border border-border-subtle rounded-md text-content-muted hover:text-content focus:outline-none focus:border-accent transition cursor-pointer"
              title="Sample Rows Count"
            >
              <option value="5">5 rows</option>
              <option value="10">10 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
            </select>
          </div>

          {/* Columns Visibility Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              ref={columnsButtonRef}
              type="button"
              onClick={toggleColumnsDropdown}
              className={`h-6 px-2 rounded-md border text-[10px] font-medium flex items-center gap-1.5 transition shadow-2xs cursor-pointer select-none ${
                hiddenColumnIds.size > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-primary border-border-subtle text-content-muted hover:text-content hover:bg-tertiary'
              }`}
              title="Filter & Hide Columns"
              aria-expanded={isColumnsDropdownOpen}
            >
              <Columns size={11} className={hiddenColumnIds.size > 0 ? 'text-amber-400' : 'text-accent'} />
              <span>Columns ({visibleColumns.length}/{columns.length})</span>
              <ChevronDown size={10} className={`transition-transform duration-200 ${isColumnsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isColumnsDropdownOpen && dropdownPos && (
              <div 
                ref={columnsDropdownRef}
                className="fixed z-50 w-64 bg-primary border border-border-subtle rounded-xl shadow-2xl p-2 text-xs flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  top: dropdownPos.top,
                  left: dropdownPos.left
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-1 pb-1 border-b border-border-subtle">
                  <span className="text-[11px] font-bold text-content uppercase tracking-wider">
                    Column Visibility
                  </span>
                  <span className="text-[10px] font-mono text-content-muted">
                    {visibleColumns.length} of {columns.length} visible
                  </span>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-2 text-content-muted" />
                  <input
                    type="text"
                    value={columnSearchFilter}
                    onChange={(e) => setColumnSearchFilter(e.target.value)}
                    placeholder="Filter columns..."
                    className="w-full h-7 pl-6 pr-6 bg-secondary border border-border-subtle rounded-md text-[11px] text-content placeholder:text-content-muted/60 focus:outline-none focus:border-accent"
                  />
                  {columnSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setColumnSearchFilter('')}
                      className="absolute right-1.5 top-1.5 p-0.5 text-content-muted hover:text-content cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Bulk actions */}
                <div className="flex items-center justify-between px-1 text-[10px]">
                  <button
                    type="button"
                    onClick={handleShowAllColumns}
                    className="text-accent hover:underline cursor-pointer font-medium"
                  >
                    Show All
                  </button>
                  <button
                    type="button"
                    onClick={handleHideAllExceptFirst}
                    className="text-content-muted hover:text-content hover:underline cursor-pointer"
                  >
                    Hide All
                  </button>
                </div>

                {/* Column Checklist */}
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
                  {columns
                    .filter(c => !columnSearchFilter || c.name.toLowerCase().includes(columnSearchFilter.toLowerCase()))
                    .map((col) => {
                      const isVisible = !hiddenColumnIds.has(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer transition select-none ${
                            !isVisible ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => handleToggleColumn(col.id)}
                              className="rounded border-border-subtle text-accent focus:ring-0 focus:outline-none cursor-pointer"
                            />
                            <span className={`text-[11px] truncate ${isVisible ? 'text-content font-medium' : 'text-content-muted line-through'}`}>
                              {col.name}
                            </span>
                          </div>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-tertiary text-content-muted font-mono ml-2 shrink-0">
                            {col.type}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Reset Badge if any columns are hidden */}
          {hiddenColumnIds.size > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] flex-shrink-0 animate-in fade-in duration-150">
              <EyeOff size={11} className="shrink-0" />
              <span className="font-semibold">{hiddenColumnIds.size} hidden</span>
              <button
                type="button"
                onClick={handleShowAllColumns}
                className="text-amber-300 hover:text-white underline ml-0.5 cursor-pointer font-medium transition"
                title="Show all columns"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Right: Clear Filter (if active) & Expand/Collapse (if list mode) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="h-6 px-1.5 rounded text-[10px] bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition flex items-center gap-1 cursor-pointer flex-shrink-0"
              title="Clear active filter"
            >
              <X size={10} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {viewMode === 'list' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={expandAll}
                className="h-6 px-1.5 rounded text-[10px] bg-primary border border-border-subtle text-content-muted hover:text-content transition cursor-pointer"
                title="Expand all list cards"
              >
                Expand
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="h-6 px-1.5 rounded text-[10px] bg-primary border border-border-subtle text-content-muted hover:text-content transition cursor-pointer"
                title="Collapse all list cards"
              >
                Collapse
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Visual Analytics & Distribution Panel */}
      {data.length > 0 && visibleColumns.length > 0 && (
        <DataHeatmap 
          data={filteredData} 
          columns={visibleColumns} 
          theme={theme} 
          isStreaming={isStreaming} 
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-primary relative">
        {columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-content-muted py-12">
            <Table size={28} className="mb-2 opacity-40 text-content-muted" />
            <p className="text-xs">No columns defined yet</p>
            <p className="text-[11px] text-content-muted">Add a column to see real-time synthetic data</p>
          </div>
        ) : visibleColumns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-content-muted py-12">
            <EyeOff size={30} className="mb-2 text-amber-500/70" />
            <p className="text-xs font-semibold text-content">All columns are currently hidden</p>
            <p className="text-[11px] text-content-muted mt-1">
              ({columns.length} columns defined in schema are hidden in preview)
            </p>
            <button
              type="button"
              onClick={handleShowAllColumns}
              className="mt-3 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold shadow-xs hover:bg-accent-hover transition cursor-pointer"
            >
              Show All Columns
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead className="sticky top-0 bg-secondary backdrop-blur text-content-muted z-10 border-b border-border-subtle shadow-sm">
              <tr>
                <th className="px-3 py-2 w-10 text-content-muted font-mono text-[10px]">#</th>
                {visibleColumns.map((col) => (
                  <th 
                    key={col.id} 
                    className="px-3.5 py-2 font-semibold text-content whitespace-nowrap cursor-context-menu hover:bg-tertiary/60 transition-colors select-none group/th"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHeaderContextMenu({ x: e.clientX, y: e.clientY, col });
                    }}
                    title={`Right-click to hide or isolate "${col.name}"`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span>{col.name}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-tertiary text-content-muted font-normal">
                          {col.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideColumn(col.id);
                        }}
                        className="opacity-0 group-hover/th:opacity-100 hover:text-amber-400 p-0.5 rounded transition text-content-muted cursor-pointer"
                        title={`Hide column "${col.name}"`}
                      >
                        <EyeOff size={11} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 w-10 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40">
              {filteredData.map((row, idx) => (
                <tr key={idx} className="group hover:bg-tertiary/60 transition-colors">
                  <td className="px-3 py-2 text-[10px] text-content-muted font-mono">
                    {idx + 1}
                  </td>
                  {visibleColumns.map((col) => {
                    const val = row[col.name];
                    const isNull = val === null || val === undefined;
                    return (
                      <td 
                        key={col.id} 
                        className="px-3.5 py-2 text-content whitespace-nowrap max-w-xs truncate cursor-context-menu"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCellContextMenu({ x: e.clientX, y: e.clientY, colName: col.name, value: String(val), isNull });
                        }}
                      >
                        {isNull ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-amber-500/80 border border-amber-900/30 italic font-sans">
                            null
                          </span>
                        ) : typeof val === 'boolean' ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              val ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            }`}
                          >
                            {val ? 'TRUE' : 'FALSE'}
                          </span>
                        ) : typeof val === 'number' ? (
                          <span className="text-accent font-mono">{val.toLocaleString()}</span>
                        ) : (
                          <span className="text-content">{String(val)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopyRow(row, idx)}
                      title="Copy Row JSON"
                      className="opacity-0 group-hover:opacity-100 p-1 text-content-muted hover:text-content transition cursor-pointer"
                    >
                      {copiedIndex === idx ? (
                        <Check size={11} className="text-accent" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : viewMode === 'list' ? (
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex items-center justify-end gap-3 mb-1">
              <button
                onClick={expandAll}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-content-muted hover:text-content transition"
              >
                <ChevronsDown size={12} />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-content-muted hover:text-content transition"
              >
                <ChevronsUp size={12} />
                Collapse All
              </button>
            </div>
            {filteredData.map((row, idx) => {
              const isCollapsed = collapsedRecords.has(idx);
              return (
              <div key={idx} className="bg-secondary border border-border-subtle rounded-xl p-3 sm:p-4 hover:border-accent/30 transition-colors">
                <div 
                  className={`flex items-center justify-between cursor-pointer select-none ${isCollapsed ? '' : 'border-b border-border-subtle/50 pb-2 mb-3'}`}
                  onClick={() => toggleRecord(idx)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={14} className="text-content-muted" /> : <ChevronDown size={14} className="text-content-muted" />}
                    <span className="text-xs font-bold text-content-muted tracking-wider uppercase">Record {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyRow(row, idx);
                    }}
                    title="Copy Record JSON"
                    className="p-1.5 text-content-muted hover:text-content hover:bg-tertiary rounded transition"
                  >
                    {copiedIndex === idx ? (
                      <Check size={13} className="text-accent" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2">
                    {visibleColumns.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      return (
                        <div 
                          key={col.id} 
                          className="flex flex-col py-1 border-b border-border-subtle/30 last:border-0 sm:border-0 sm:py-0 cursor-context-menu"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCellContextMenu({ x: e.clientX, y: e.clientY, colName: col.name, value: String(val), isNull });
                          }}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span 
                              className="text-[10px] text-content-muted uppercase tracking-wider truncate cursor-context-menu hover:text-content select-none" 
                              title={`Right-click to hide or isolate "${col.name}"`}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHeaderContextMenu({ x: e.clientX, y: e.clientY, col });
                              }}
                            >
                              {col.name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHideColumn(col.id);
                              }}
                              className="text-content-muted/60 hover:text-amber-400 p-0.5 rounded transition cursor-pointer"
                              title={`Hide "${col.name}"`}
                            >
                              <EyeOff size={10} />
                            </button>
                          </div>
                          <div className="text-xs font-mono truncate">
                            {isNull ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-amber-500/80 border border-amber-900/30 italic font-sans">
                                null
                              </span>
                            ) : typeof val === 'boolean' ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  val ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                                }`}
                              >
                                {val ? 'TRUE' : 'FALSE'}
                              </span>
                            ) : typeof val === 'number' ? (
                              <span className="text-accent">{val.toLocaleString()}</span>
                            ) : (
                              <span className="text-content">{String(val)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )})}
          </div>
        ) : (
          <div className="relative h-full flex flex-col">
            {hiddenColumnIds.size > 0 && (
              <div className="px-4 py-2 bg-secondary/80 border-b border-border-subtle text-[11px] text-content-muted flex items-center justify-between flex-shrink-0">
                <span className="flex items-center gap-1.5">
                  <EyeOff size={12} className="text-amber-400" />
                  Showing {visibleColumns.length} of {columns.length} columns in preview JSON ({hiddenColumnIds.size} hidden)
                </span>
                <button
                  type="button"
                  onClick={handleShowAllColumns}
                  className="text-accent hover:underline font-medium cursor-pointer"
                >
                  Show all columns
                </button>
              </div>
            )}
            <pre className="p-4 text-xs font-mono text-emerald-400/90 leading-relaxed overflow-auto flex-1">
              {JSON.stringify(
                filteredData.map(row => {
                  if (hiddenColumnIds.size === 0) return row;
                  const filteredRow: Record<string, unknown> = {};
                  visibleColumns.forEach(c => {
                    filteredRow[c.name] = row[c.name];
                  });
                  return filteredRow;
                }),
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Header Context Menu (Hide / Isolate / Restore Columns) */}
      {headerContextMenu && (
        <div 
          className="fixed z-50 min-w-[210px] bg-primary border border-border-subtle rounded-xl shadow-2xl overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            top: headerContextMenu.y, 
            left: headerContextMenu.x,
            transform: `translate(${headerContextMenu.x > window.innerWidth - 240 ? '-100%' : '0'}, ${headerContextMenu.y > window.innerHeight - 220 ? '-100%' : '0'})` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col py-1">
            <div className="px-3 py-1.5 border-b border-border-subtle flex items-center justify-between text-[11px] font-mono text-content-muted">
              <span className="font-bold text-content truncate max-w-[140px]">{headerContextMenu.col.name}</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-tertiary text-content-muted font-sans">
                {headerContextMenu.col.type}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                handleHideColumn(headerContextMenu.col.id);
                setHeaderContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-content hover:bg-secondary text-xs transition cursor-pointer"
            >
              <EyeOff size={13} className="text-amber-400" />
              <span>Hide Column &quot;{headerContextMenu.col.name}&quot;</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleShowOnlyColumn(headerContextMenu.col.id);
                setHeaderContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-content hover:bg-secondary text-xs transition cursor-pointer"
            >
              <Focus size={13} className="text-accent" />
              <span>Show Only This Column</span>
            </button>

            {hiddenColumnIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  handleShowAllColumns();
                  setHeaderContextMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-2 text-content hover:bg-secondary text-xs transition cursor-pointer"
              >
                <Eye size={13} className="text-emerald-400" />
                <span>Show All Columns ({hiddenColumnIds.size} hidden)</span>
              </button>
            )}

            <div className="h-px bg-border-subtle my-1"></div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(headerContextMenu.col.name);
                setHeaderContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-content hover:bg-secondary text-xs transition cursor-pointer"
            >
              <Copy size={13} className="text-content-muted" />
              <span>Copy Column Name</span>
            </button>
          </div>
        </div>
      )}

      {/* Cell Value Context Menu */}
      {cellContextMenu && (
        <div 
          className="fixed z-50 min-w-[200px] bg-primary border border-border-subtle rounded-xl shadow-xl overflow-hidden text-sm"
          style={{ 
            top: cellContextMenu.y, 
            left: cellContextMenu.x,
            transform: `translate(${cellContextMenu.x > window.innerWidth - 250 ? '-100%' : '0'}, ${cellContextMenu.y > window.innerHeight - 200 ? '-100%' : '0'})` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col py-1">
            <div className="px-3 py-1.5 border-b border-border-subtle text-[10px] font-mono text-content-muted truncate max-w-[250px]">
              {cellContextMenu.colName}: {cellContextMenu.isNull ? 'null' : cellContextMenu.value}
            </div>
            
            <button
              onClick={() => {
                const token = cellContextMenu.isNull ? `${cellContextMenu.colName}:null` : `${cellContextMenu.colName}:${cellContextMenu.value}`;
                setSearchQuery(token);
                setCellContextMenu(null);
              }}
              className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
            >
              <Filter size={14} className="text-content-muted" /> Filter only this
            </button>
            <button
              onClick={() => {
                const token = cellContextMenu.isNull ? `${cellContextMenu.colName}:null` : `${cellContextMenu.colName}:${cellContextMenu.value}`;
                setSearchQuery(prev => prev ? `${prev} ${token}` : token);
                setCellContextMenu(null);
              }}
              className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
            >
              <Plus size={14} className="text-content-muted" /> Add to filter
            </button>
            <button
              onClick={() => {
                const token = cellContextMenu.isNull ? `${cellContextMenu.colName}:!null` : `!${cellContextMenu.colName}:${cellContextMenu.value}`;
                setSearchQuery(prev => prev ? `${prev} ${token}` : token);
                setCellContextMenu(null);
              }}
              className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
            >
              <FilterX size={14} className="text-content-muted" /> Exclude this
            </button>
            <div className="h-px bg-border-subtle my-1"></div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cellContextMenu.isNull ? 'null' : cellContextMenu.value);
                setCellContextMenu(null);
              }}
              className="flex items-center gap-3 px-3 py-2 text-content hover:bg-secondary transition"
            >
              <Copy size={14} className="text-content-muted" /> Copy value
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
