import React, { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PresetSchema, ColumnSpec } from '../types';
import { PRESET_SCHEMAS } from '../data/presets';
import { X, Layers, ArrowRight, Download, Upload, Search } from 'lucide-react';
import { AnimatedTabs } from './AnimatedTabs';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetSchema) => void;
  currentColumns: ColumnSpec[];
  onImportSchema: (cols: ColumnSpec[], tableName?: string) => void;
  tableName: string;
}

export const PresetSelector: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectPreset,
  currentColumns,
  onImportSchema,
  tableName
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = useModalAccessibility(isOpen, onClose);
  const titleId = React.useId();

  const categories = useMemo(() => {
    const set = new Set<string>();
    PRESET_SCHEMAS.forEach(p => set.add(p.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredPresets = useMemo(() => {
    return PRESET_SCHEMAS.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch = searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.columns.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleExportCurrent = () => {
    const payload = {
      tableName,
      exportedAt: new Date().toISOString(),
      columns: currentColumns
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName || 'vampio_schema'}.schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportSchema(parsed);
          onClose();
        } else if (parsed.columns && Array.isArray(parsed.columns)) {
          onImportSchema(parsed.columns, parsed.tableName);
          onClose();
        } else {
          setErrorMsg('Invalid schema format. Expected array of columns or { columns: [...] }');
        }
      } catch (err: any) {
        setErrorMsg('Invalid JSON schema file: ' + (err?.message || err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Animated Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm -z-10"
          />

          {/* Animated Modal Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.12 }}
            className="bg-primary border border-border-subtle rounded-2xl w-full max-w-4xl h-[90dvh] max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border-subtle bg-secondary">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-content shadow-md">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 id={titleId} className="text-sm font-bold text-content">Preset Schemas & Templates</h3>
                  <p className="text-xs text-content-muted">
                    Jumpstart synthetic generation with production patterns
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                aria-label="Close presets"
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="p-1.5 text-content-muted hover:text-content hover:bg-tertiary rounded-lg transition"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Import / Export Bar */}
            <div className="px-4 sm:px-6 py-3 shrink-0 bg-secondary border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-content-muted">
                Have an existing schema definition or want to save your current setup?
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary hover:bg-tertiary hover:opacity-80 text-content transition font-medium"
                >
                  <Upload size={13} />
                  <span>Import JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCurrent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary hover:bg-tertiary hover:opacity-80 text-content transition font-medium"
                >
                  <Download size={13} />
                  <span>Export Current</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div role="alert" className="px-6 py-2 shrink-0 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex items-center justify-between">
                <span>{errorMsg}</span>
                <button 
                  type="button"
                  aria-label="Dismiss import error"
                  onClick={() => setErrorMsg(null)}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Search and Category Filter */}
            <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-primary/20 flex-shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Search presets (e.g. E-Commerce, SaaS, Finance)..."
                  aria-label="Search presets"
                  data-autofocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-primary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>

              <AnimatedTabs
                tabs={categories.map((c) => ({ id: c, label: c }))}
                activeTab={selectedCategory}
                onChange={(cat) => setSelectedCategory(cat)}
                layoutId="preset-categories-filter"
                variant="chip"
                size="xs"
                className="min-w-0 max-w-full sm:max-w-[55%]"
              />
            </div>

            {/* Preset Cards List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
              {filteredPresets.length === 0 && (
                <div role="status" className="py-10 text-center space-y-3">
                  <p className="text-sm text-content">No matching presets</p>
                  <p className="text-xs text-content-muted">Try a different search or category.</p>
                  <button type="button" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} className="px-3 py-2 rounded-lg border border-border-subtle text-xs text-content hover:bg-tertiary">
                    Clear filters
                  </button>
                </div>
              )}
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="group p-4 bg-secondary hover:bg-secondary border border-border-subtle hover:border-accent rounded-xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-content group-hover:text-accent transition">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-tertiary text-content-muted border border-border-subtle">
                        {preset.category}
                      </span>
                      <span className="text-[10px] font-mono text-content-muted">
                        {preset.columns.length} columns
                      </span>
                    </div>
                    <p className="text-xs text-content-muted leading-relaxed">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {preset.columns.slice(0, 6).map((c) => (
                        <span
                          key={c.id}
                          className="text-[10px] font-mono bg-primary px-2 py-0.5 rounded border border-border-subtle text-content"
                        >
                          {c.name}: <span className="text-accent">{c.type}</span>
                        </span>
                      ))}
                      {preset.columns.length > 6 && (
                        <span className="text-[10px] font-mono text-content-muted">
                          +{preset.columns.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      onSelectPreset(preset);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition shadow-md whitespace-nowrap self-start md:self-center"
                  >
                    <span>Load Schema</span>
                    <ArrowRight size={13} />
                  </motion.button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
