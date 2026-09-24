import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ExportFormat } from '../types';
import { Search, Check, ChevronDown, FileCode, FileSpreadsheet, Database, Braces, Sparkles, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

export interface FormatOption {
  id: ExportFormat | string;
  name: string;
  extension: string;
  category: 'Tabular' | 'Structured' | 'Database' | 'Analytical';
  description: string;
  icon?: React.ReactNode;
  badge?: string;
  isAvailable?: boolean;
}

export const EXPORT_FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'xlsx',
    name: 'Excel Workbook (.xlsx)',
    extension: '.xlsx',
    category: 'Tabular',
    description: 'Modern Microsoft Excel OpenXML spreadsheet with native columns',
    icon: <FileSpreadsheet size={14} className="text-emerald-500" />,
    badge: 'Standard',
    isAvailable: true,
  },
  {
    id: 'xls',
    name: 'Excel 97-2004 (.xls)',
    extension: '.xls',
    category: 'Tabular',
    description: 'Legacy Microsoft Excel BIFF8 binary workbook for enterprise systems',
    icon: <FileSpreadsheet size={14} className="text-emerald-600" />,
    isAvailable: true,
  },
  {
    id: 'csv',
    name: 'CSV (Comma Separated)',
    extension: '.csv',
    category: 'Tabular',
    description: 'Universal spreadsheet & data engineering standard with headers',
    icon: <FileSpreadsheet size={14} className="text-teal-500" />,
    isAvailable: true,
  },
  {
    id: 'tsv',
    name: 'TSV (Tab Separated)',
    extension: '.tsv',
    category: 'Tabular',
    description: 'Tab-delimited table format for NLP and raw pipelines',
    icon: <FileSpreadsheet size={14} className="text-teal-600" />,
    isAvailable: true,
  },
  {
    id: 'json',
    name: 'JSON (Formatted Array)',
    extension: '.json',
    category: 'Structured',
    description: 'Hierarchical object records array with indentation',
    icon: <Braces size={14} className="text-amber-500" />,
    isAvailable: true,
  },
  {
    id: 'jsonl',
    name: 'JSON Lines (NDJSON)',
    extension: '.jsonl',
    category: 'Structured',
    description: 'High-throughput streamable newline-delimited JSON objects',
    icon: <FileCode size={14} className="text-sky-500" />,
    isAvailable: true,
  },
  {
    id: 'txt',
    name: 'Raw Text / Log (.txt)',
    extension: '.txt',
    category: 'Structured',
    description: 'Plain structured text or log lines for audit streams and multi-file outputs',
    icon: <FileCode size={14} className="text-slate-400" />,
    isAvailable: true,
  },
  {
    id: 'xml',
    name: 'XML Dataset (.xml)',
    extension: '.xml',
    category: 'Structured',
    description: 'Standard XML formatted elements for SOAP and legacy systems',
    icon: <FileCode size={14} className="text-orange-500" />,
    isAvailable: true,
  },
  {
    id: 'sql',
    name: 'SQL (INSERT Batches)',
    extension: '.sql',
    category: 'Database',
    description: 'PostgreSQL/MySQL INSERT queries with CREATE TABLE DDL',
    icon: <Database size={14} className="text-indigo-500" />,
    isAvailable: true,
  },
  {
    id: 'parquet',
    name: 'Apache Parquet (Columnar)',
    extension: '.parquet',
    category: 'Analytical',
    description: 'Compressed columnar binary format for data lakehouse analytics',
    icon: <Layers size={14} className="text-purple-400" />,
    badge: 'Coming Soon',
    isAvailable: false,
  },
];

interface FormatSelectDropdownProps {
  value: ExportFormat;
  onChange: (value: ExportFormat) => void;
  className?: string;
}

export const FormatSelectDropdown: React.FC<FormatSelectDropdownProps> = ({
  value,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    return EXPORT_FORMAT_OPTIONS.find((opt) => opt.id === value) || EXPORT_FORMAT_OPTIONS[0];
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return EXPORT_FORMAT_OPTIONS;
    return EXPORT_FORMAT_OPTIONS.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.extension.toLowerCase().includes(q) ||
        opt.category.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={cn('relative w-full', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-primary hover:bg-tertiary/60 border border-border-subtle rounded-xl text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/40 shadow-xs cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-secondary border border-border-subtle flex-shrink-0">
            {selectedOption.icon || <FileCode size={13} className="text-accent" />}
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-content truncate">{selectedOption.name}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-secondary text-accent font-bold rounded border border-border-subtle">
                {selectedOption.extension}
              </span>
            </div>
            <span className="text-[10px] text-content-muted truncate block">
              {selectedOption.category} • {selectedOption.description}
            </span>
          </div>
        </div>
        <ChevronDown
          size={14}
          className={cn('text-content-muted flex-shrink-0 transition-transform duration-200', isOpen && 'rotate-180 text-accent')}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-2 space-y-2 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-content-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search format (e.g. csv, sql, json, parquet)..."
              className="w-full pl-8 pr-3 py-1.5 bg-primary border border-border-subtle rounded-lg text-xs text-content placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-content-muted">
                No matching file formats found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                const isAvailable = opt.isAvailable !== false;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      if (isAvailable) {
                        onChange(opt.id as ExportFormat);
                        setIsOpen(false);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-lg text-left transition-all text-xs cursor-pointer',
                      !isAvailable
                        ? 'opacity-40 cursor-not-allowed bg-primary/20'
                        : isSelected
                        ? 'bg-accent text-white font-semibold shadow-xs'
                        : 'hover:bg-primary text-content'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'p-1 rounded-md flex-shrink-0 border',
                          isSelected
                            ? 'bg-white/15 border-white/20 text-white'
                            : 'bg-primary border-border-subtle'
                        )}
                      >
                        {opt.icon || <FileCode size={13} />}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('font-bold truncate text-xs', isSelected ? 'text-white' : 'text-content')}>
                            {opt.name}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-mono px-1.5 py-0.2 rounded font-bold border',
                              isSelected
                                ? 'bg-black/20 text-white border-white/20'
                                : 'bg-primary text-accent border-border-subtle'
                            )}
                          >
                            {opt.extension}
                          </span>
                          {opt.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans border border-amber-500/30">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            'text-[10px] truncate mt-0.5',
                            isSelected ? 'text-white/80' : 'text-content-muted'
                          )}
                        >
                          {opt.description}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={14} className="text-white flex-shrink-0 ml-2 font-bold" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
