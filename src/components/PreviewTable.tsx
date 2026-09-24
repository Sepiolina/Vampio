import React, { useState, useEffect } from 'react';
import { ColumnSpec, ThemeId } from '../types';
import { Table, Code, Copy, Check, Search, RefreshCw, List, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, X, Filter, FilterX, Plus } from 'lucide-react';
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
  const prevColCountRef = React.useRef(columns.length);

  useEffect(() => {
    const handleClickOutside = () => setCellContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
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
      <div className="px-3 sm:px-4 h-8 min-h-[32px] max-h-[32px] bg-secondary/50 border-b border-border-subtle flex items-center justify-between gap-2 overflow-x-auto text-[11px] flex-shrink-0 scrollbar-none [&::-webkit-scrollbar]:hidden select-none w-full">
        {/* Left: View Mode Toggle & Sample Row Count */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden flex-shrink-0">
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
      {data.length > 0 && columns.length > 0 && (
        <DataHeatmap 
          data={filteredData} 
          columns={columns} 
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
        ) : viewMode === 'table' ? (
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead className="sticky top-0 bg-secondary backdrop-blur text-content-muted z-10 border-b border-border-subtle shadow-sm">
              <tr>
                <th className="px-3 py-2 w-10 text-content-muted font-mono text-[10px]">#</th>
                {columns.map((col) => (
                  <th key={col.id} className="px-3.5 py-2 font-semibold text-content whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-tertiary text-content-muted font-normal">
                        {col.type}
                      </span>
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
                  {columns.map((col) => {
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
                      className="opacity-0 group-hover:opacity-100 p-1 text-content-muted hover:text-content transition"
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
                    {columns.map((col) => {
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
                          <span className="text-[10px] text-content-muted uppercase tracking-wider mb-0.5 truncate" title={col.name}>
                            {col.name}
                          </span>
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
          <pre className="p-4 text-xs font-mono text-emerald-400/90 leading-relaxed overflow-auto">
            {JSON.stringify(filteredData, null, 2)}
          </pre>
        )}
      </div>

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
