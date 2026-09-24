import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  FileCode,
  Plus,
  Trash2,
  Download,
  Check,
  X,
  Sparkles,
  Dices,
  RefreshCw,
  AlertCircle,
  Database,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  CustomEntityDataset,
  getRegisteredCustomEntities,
  saveCustomEntity,
  deleteCustomEntity,
  parseEntityUpload,
  DEFAULT_STARTER_ENTITIES
} from '../utils/customTypesManager';

interface CustomEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity: (entity: CustomEntityDataset) => void;
  initialSelectedId?: string;
}

export const CustomEntityModal: React.FC<CustomEntityModalProps> = ({
  isOpen,
  onClose,
  onSelectEntity,
  initialSelectedId
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
  const [customEntities, setCustomEntities] = useState<CustomEntityDataset[]>([]);
  
  // Upload form state
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [entityName, setEntityName] = useState('');
  const [entityDescription, setEntityDescription] = useState('');
  const [rawText, setRawText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [samplePick, setSamplePick] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = () => {
    setCustomEntities(getRegisteredCustomEntities());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Re-parse when rawText or deduplicate changes
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedItems([]);
      setSamplePick(null);
      return;
    }
    const { name, items } = parseEntityUpload(rawText, uploadedFileName);
    if (!entityName && name) {
      setEntityName(name);
    }
    let finalItems = items;
    if (deduplicate) {
      finalItems = Array.from(new Set(finalItems));
    }
    setParsedItems(finalItems);
    if (finalItems.length > 0) {
      setSamplePick(finalItems[Math.floor(Math.random() * finalItems.length)]);
    }
  }, [rawText, uploadedFileName, deduplicate]);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawText(content);
        const { name } = parseEntityUpload(content, file.name);
        setEntityName(name);
        setStatusMessage(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleLoadPreset = (preset: CustomEntityDataset) => {
    setEntityName(preset.name);
    setEntityDescription(preset.description || '');
    setUploadedFileName(`${preset.id}.txt`);
    setRawText(preset.items.join('\n'));
    setStatusMessage(`Loaded preset "${preset.name}" (${preset.items.length} items)`);
  };

  const handleSaveAndUse = () => {
    const name = entityName.trim() || 'Custom Entity';
    if (parsedItems.length === 0) {
      alert('Please upload a file or paste at least one entity item.');
      return;
    }

    const id = `entity:${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(-4)}`;
    const newEntity: CustomEntityDataset = {
      id,
      name,
      description: entityDescription.trim() || `${parsedItems.length} custom mock records`,
      items: parsedItems,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveCustomEntity(newEntity);
    refreshList();
    onSelectEntity(newEntity);
    onClose();
  };

  const handleDeleteEntity = (id: string, name: string) => {
    if (confirm(`Delete custom entity dataset "${name}"?`)) {
      deleteCustomEntity(id);
      refreshList();
      setStatusMessage(`Deleted "${name}"`);
    }
  };

  const handleExportText = (entity: CustomEntityDataset) => {
    const text = entity.items.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity.name.toLowerCase().replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = (entity: CustomEntityDataset) => {
    const json = JSON.stringify(entity.items, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-secondary border border-border-subtle rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-primary/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <span>Custom Entity Mock Datasets</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  .txt / .json
                </span>
              </h2>
              <p className="text-xs text-content-muted">
                Upload files (line-by-line or JSON array) or paste custom items to mock any entity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 border-b border-border-subtle bg-secondary">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              <Upload size={14} />
              <span>Upload / Add New Entity</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('library');
                refreshList();
              }}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'library'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              <Layers size={14} />
              <span>Saved Datasets ({customEntities.length})</span>
            </button>
          </div>

          {statusMessage && (
            <span className="text-[11px] text-emerald-400 font-mono animate-in fade-in truncate max-w-xs">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'upload' ? (
            <div className="space-y-5">
              {/* Presets Quick Inspiration */}
              <div className="bg-primary/50 border border-border-subtle rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-content flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Quick Starter Samples (Click to load):</span>
                  </span>
                  <span className="text-[10px] text-content-muted">One-click templates</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_STARTER_ENTITIES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      className="px-2.5 py-1 text-xs bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded-lg border border-border-subtle transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span className="font-medium">{preset.name}</span>
                      <span className="text-[10px] font-mono opacity-70">({preset.items.length})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Switcher: File Upload vs Direct Paste */}
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <span className="text-xs font-semibold text-content mr-1">Input Method:</span>
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                    inputMode === 'file'
                      ? 'bg-accent/15 text-accent border-accent/40 font-bold'
                      : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                  }`}
                >
                  <Upload size={13} />
                  <span>Upload File (.txt, .json, .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                    inputMode === 'text'
                      ? 'bg-accent/15 text-accent border-accent/40 font-bold'
                      : 'bg-primary border-border-subtle text-content-muted hover:text-content'
                  }`}
                >
                  <FileText size={13} />
                  <span>Direct Paste (Separate by Enter)</span>
                </button>
              </div>

              {/* Input Zone */}
              {inputMode === 'file' ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-accent bg-accent/10'
                      : 'border-border-subtle hover:border-accent/60 bg-primary/30 hover:bg-primary/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.csv,.tsv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-secondary border border-border-subtle flex items-center justify-center text-accent shadow-sm">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-content">
                      Click to browse or drop file here
                    </p>
                    <p className="text-xs text-content-muted mt-0.5">
                      Supports <span className="font-mono text-accent">.txt</span> (one item per line separated by Enter),{' '}
                      <span className="font-mono text-accent">.json</span> (array of strings), or <span className="font-mono text-accent">.csv</span>
                    </p>
                  </div>
                  {uploadedFileName && (
                    <div className="mt-2 px-3 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 text-xs font-mono flex items-center gap-1.5">
                      <FileCode size={13} />
                      <span>{uploadedFileName}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-content flex items-center gap-1">
                      <span>Enter Items (Separated by Enter / Newline)</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-content-muted font-mono">
                      1 item per line
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={"Cardiology\nNeurology\nPediatrics\nOncology\nRadiology\nOrthopedics\nEmergency"}
                    className="w-full px-3 py-2 text-xs font-mono bg-primary border border-border-subtle rounded-xl text-content focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Entity Configuration Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-primary/40 p-3.5 rounded-xl border border-border-subtle">
                <div>
                  <label className="text-xs font-semibold text-content block mb-1">
                    Entity Category Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="e.g. Hospital Departments, Car Brands, Crypto Tickers"
                    className="w-full px-3 py-2 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-content block mb-1">
                    Short Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={entityDescription}
                    onChange={(e) => setEntityDescription(e.target.value)}
                    placeholder="e.g. Custom clinical specialties dataset"
                    className="w-full px-3 py-2 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Deduplication & Cleaning Options */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-secondary p-3 rounded-xl border border-border-subtle">
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span className="text-content font-medium">Remove duplicate entries</span>
                </label>

                <div className="flex items-center gap-3 text-content-muted font-mono text-[11px]">
                  <span>Parsed: <strong className="text-accent">{parsedItems.length}</strong> items</span>
                  {samplePick && (
                    <span className="hidden sm:inline">
                      Sample: <span className="text-content font-bold">"{samplePick}"</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Live Preview Badges */}
              {parsedItems.length > 0 && (
                <div className="space-y-2 bg-primary/30 p-3.5 rounded-xl border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-content flex items-center gap-1.5">
                      <Sparkles size={13} className="text-accent" />
                      <span>Parsed Dataset Preview ({parsedItems.length} items)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (parsedItems.length > 0) {
                          setSamplePick(parsedItems[Math.floor(Math.random() * parsedItems.length)]);
                        }
                      }}
                      className="px-2 py-1 text-[10px] font-medium bg-secondary hover:bg-tertiary text-content rounded-md border border-border-subtle transition flex items-center gap-1 cursor-pointer"
                    >
                      <Dices size={12} className="text-accent" />
                      <span>Roll Random Sample</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                    {parsedItems.slice(0, 30).map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-secondary text-content border border-border-subtle text-xs font-mono truncate max-w-xs"
                      >
                        {item}
                      </span>
                    ))}
                    {parsedItems.length > 30 && (
                      <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/25 text-xs font-bold font-mono">
                        +{parsedItems.length - 30} more items
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Saved Datasets Library Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-content-muted">
                  Your registered custom mock datasets. Available in all columns and Custom Column Types.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-accent text-accent-content font-bold text-xs rounded-lg shadow-sm hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Upload New Entity</span>
                </button>
              </div>

              {customEntities.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border-subtle rounded-xl p-8">
                  <Database size={32} className="mx-auto text-content-muted/50 mb-2" />
                  <p className="text-sm font-semibold text-content">No Custom Entities Found</p>
                  <p className="text-xs text-content-muted mt-1 max-w-sm mx-auto">
                    Upload a .txt or .json file to create custom entity datasets for realistic data generation.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {customEntities.map((entity) => {
                    const isSelected = initialSelectedId === entity.id;
                    return (
                      <div
                        key={entity.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-accent/10 border-accent/40 shadow-xs'
                            : 'bg-primary/60 border-border-subtle hover:border-accent/30'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-content truncate">{entity.name}</h3>
                            <span className="px-2 py-0.5 rounded-full bg-secondary text-content-muted border border-border-subtle text-[10px] font-mono">
                              {entity.items.length} items
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold text-[10px]">
                                Selected
                              </span>
                            )}
                          </div>
                          {entity.description && (
                            <p className="text-[11px] text-content-muted truncate">{entity.description}</p>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-content-muted font-mono truncate">
                            <span>Samples:</span>
                            <span className="text-content">
                              {entity.items.slice(0, 3).join(', ')}
                              {entity.items.length > 3 ? '...' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          {/* Export buttons */}
                          <button
                            type="button"
                            onClick={() => handleExportText(entity)}
                            title="Download as .txt (one item per line)"
                            className="p-1.5 rounded-lg bg-secondary hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle text-[10px] transition cursor-pointer flex items-center gap-1"
                          >
                            <Download size={12} />
                            <span className="hidden sm:inline">.txt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportJson(entity)}
                            title="Download as .json array"
                            className="p-1.5 rounded-lg bg-secondary hover:bg-tertiary text-content-muted hover:text-content border border-border-subtle text-[10px] transition cursor-pointer flex items-center gap-1"
                          >
                            <Download size={12} />
                            <span className="hidden sm:inline">.json</span>
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteEntity(entity.id, entity.name)}
                            title="Delete dataset"
                            className="p-1.5 rounded-lg bg-secondary hover:bg-rose-500/10 text-content-muted hover:text-rose-400 border border-border-subtle transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>

                          {/* Select button */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectEntity(entity);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-accent text-accent-content font-bold text-xs shadow-xs hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer ml-1"
                          >
                            <span>Use Dataset</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border-subtle bg-primary/40">
          <div className="text-xs text-content-muted">
            {activeTab === 'upload' && parsedItems.length > 0 && (
              <span>Ready to save <strong className="text-accent">{parsedItems.length}</strong> items</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-content-muted hover:text-content bg-secondary hover:bg-tertiary rounded-xl border border-border-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            {activeTab === 'upload' && (
              <button
                type="button"
                onClick={handleSaveAndUse}
                disabled={parsedItems.length === 0}
                className="px-4 py-2 text-xs font-bold text-accent-content bg-accent hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                <span>Save & Use Dataset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
