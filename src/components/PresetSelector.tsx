import React, { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PresetSchema, ColumnSpec } from '../types';
import { PRESET_SCHEMAS } from '../data/presets';
import { X, Layers, ArrowRight, Download, Upload, CheckCircle2, Search } from 'lucide-react';
import { AnimatedTabs } from './AnimatedTabs';

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
        }
      } catch (err) {
        alert('Invalid JSON schema file: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.12 }}
            className="bg-primary border border-border-subtle rounded-2xl w-full max-w-4xl h-[90vh] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-secondary">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-content shadow-md">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-content">Preset Schemas & Templates</h3>
                  <p className="text-xs text-content-muted">
                    Jumpstart synthetic generation with production patterns
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="p-1.5 text-content-muted hover:text-content hover:bg-tertiary rounded-lg transition"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Import / Export Bar */}
            <div className="px-6 py-3 bg-secondary border-b border-border-subtle flex items-center justify-between gap-3 text-xs">
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

            {/* Search and Category Filter */}
            <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-primary/20 flex-shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Search presets (e.g. E-Commerce, SaaS, Finance)..."
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
              />
            </div>

            {/* Preset Cards List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="group p-4 bg-secondary hover:bg-secondary border border-border-subtle hover:border-accent rounded-xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
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
