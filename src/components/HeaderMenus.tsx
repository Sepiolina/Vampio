import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  Clock,
  Save,
  RotateCcw,
  Download,
  Upload,
  Settings,
  Sliders,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Keyboard,
  Info,
  Check,
  Trash2,
  Database,
  Layers,
  FileSpreadsheet,
  FolderLock,
  X,
  ExternalLink,
  ChevronDown,
  Wand2,
  FileCode,
  Tag,
  Globe
} from 'lucide-react';
import { ColumnSpec, ExportFormat } from '../types';
import { AnimatedTabs } from './AnimatedTabs';
import { FormatSelectDropdown } from './FormatSelectDropdown';
import { CustomTypeModal, CustomTypeModalTab } from './CustomTypeModal';
import { useI18n, LanguageSelectDropdown } from '../i18n';
import { getCustomColumnTypes, CustomColumnType, exportCustomColumnTypesJSON } from '../utils/customTypesManager';
import {
  getLatestSession,
  getSavedSessions,
  saveNamedSession,
  deleteSavedSession,
  getRecentFiles,
  clearRecentFiles,
  getRecentFolders,
  clearRecentFolders,
  exportSchemaJSON,
  SavedSession,
  RecentFileRecord,
  RecentFolderRecord
} from '../utils/sessionManager';

interface HeaderMenusProps {
  columns: ColumnSpec[];
  setColumns: (cols: ColumnSpec[]) => void;
  tableName: string;
  setTableName: (name: string) => void;
  format: ExportFormat;
  setFormat: (fmt: ExportFormat) => void;
  count: number;
  setCount: (count: number) => void;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  selectedFolderName: string | null;
  onSelectFolder: () => void;
  onClearFolder: () => void;
  onImportSchema: (cols: ColumnSpec[], tableName?: string) => void;
  onOpenPresets: () => void;
  onOpenOfflineExtractor: () => void;
  onOpenFolderMonitor: () => void;
  onOpenRestApi?: () => void;
  setStatusMessage: (msg: string) => void;
}

export const HeaderMenus: React.FC<HeaderMenusProps> = ({
  columns,
  setColumns,
  tableName,
  setTableName,
  format,
  setFormat,
  count,
  setCount,
  intervalMs,
  setIntervalMs,
  selectedFolderName,
  onSelectFolder,
  onClearFolder,
  onImportSchema,
  onOpenPresets,
  onOpenOfflineExtractor,
  onOpenFolderMonitor,
  onOpenRestApi,
  setStatusMessage
}) => {
  const { t, locale, setLocale, availableLocales } = useI18n();
  const [activeMenu, setActiveMenu] = useState<'files' | 'settings' | 'advance' | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isFormulasOpen, setIsFormulasOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [customSessionName, setCustomSessionName] = useState('');

  // Advance Custom Types Studio State
  const [isCustomTypeModalOpen, setIsCustomTypeModalOpen] = useState(false);
  const [customTypeInitialTab, setCustomTypeInitialTab] = useState<CustomTypeModalTab>('examples');
  const [customTypesList, setCustomTypesList] = useState<CustomColumnType[]>([]);

  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFileRecord[]>([]);
  const [recentFolders, setRecentFolders] = useState<RecentFolderRecord[]>([]);
  const [latestSession, setLatestSession] = useState<SavedSession | null>(null);

  const menuContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refresh lists whenever menu opens
  const refreshStorageData = () => {
    setSavedSessions(getSavedSessions());
    setRecentFiles(getRecentFiles());
    setRecentFolders(getRecentFolders());
    setLatestSession(getLatestSession());
    setCustomTypesList(getCustomColumnTypes());
  };

  useEffect(() => {
    if (activeMenu) {
      refreshStorageData();
    }
  }, [activeMenu]);

  // Click outside and ESC listeners
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setIsShortcutsOpen(false);
        setIsFormulasOpen(false);
        setIsAboutOpen(false);
        setIsSaveModalOpen(false);
      }
    };

    if (activeMenu) {
      document.addEventListener('pointerdown', handlePointerDown);
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  // Handle adding custom column to active schema
  const handleAddCustomColumnToSchema = (colPartial: Partial<ColumnSpec>) => {
    const newCol: ColumnSpec = {
      id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: colPartial.name || 'custom_field',
      type: (colPartial.type as any) || 'String',
      rule: colPartial.rule || '',
      skip_pct: 0,
      condition: '',
      customTypeId: colPartial.customTypeId,
      notes: colPartial.notes
    };
    setColumns([...columns, newCol]);
    setStatusMessage(`Added custom field "${newCol.name}" to schema`);
  };

  // Handle Restore Session
  const handleRestoreSession = (sess: SavedSession) => {
    if (!sess || !sess.columns || sess.columns.length === 0) {
      setStatusMessage('No valid schema data found in session.');
      return;
    }
    setColumns(sess.columns);
    if (sess.tableName) setTableName(sess.tableName);
    if (sess.format) setFormat(sess.format);
    if (sess.count) setCount(sess.count);
    if (sess.intervalMs) setIntervalMs(sess.intervalMs);
    setActiveMenu(null);
    setStatusMessage(`Restored session "${sess.name}" (${sess.columns.length} columns)`);
  };

  // Handle Save Session Snapshot
  const handleSaveCurrentSession = () => {
    const name = customSessionName.trim() || `${tableName || 'schema'}_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    saveNamedSession({
      name,
      columns,
      tableName,
      format,
      count,
      intervalMs,
      selectedFolderName
    });
    setCustomSessionName('');
    setIsSaveModalOpen(false);
    refreshStorageData();
    setStatusMessage(`Saved session snapshot "${name}"`);
  };

  // Handle Import JSON Blueprint
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.columns && Array.isArray(parsed.columns)) {
          onImportSchema(parsed.columns, parsed.tableName || file.name.replace(/\.[^/.]+$/, ''));
          setStatusMessage(`Loaded blueprint "${file.name}" (${parsed.columns.length} columns)`);
        } else if (Array.isArray(parsed)) {
          onImportSchema(parsed, file.name.replace(/\.[^/.]+$/, ''));
          setStatusMessage(`Loaded schema array (${parsed.length} columns)`);
        } else {
          alert('Invalid blueprint JSON format. Expected { columns: [...] }');
        }
      } catch (err: any) {
        alert(`Failed to parse blueprint JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
    setActiveMenu(null);
  };

  return (
    <div className="relative flex items-center gap-0.5" ref={menuContainerRef}>
      {/* Hidden File Input for Blueprint Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* 1. Files Menu Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'files' ? null : 'files')}
          className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeMenu === 'files'
              ? 'bg-accent text-white shadow-xs'
              : 'text-content hover:bg-tertiary/70 border border-transparent hover:border-border-subtle'
          }`}
          aria-expanded={activeMenu === 'files'}
          title={t('header.fileMenu')}
        >
          <span>{t('header.fileMenu')}</span>
          <ChevronDown
            size={11}
            className={`transition-transform duration-150 ${activeMenu === 'files' ? 'rotate-180 text-white' : 'text-content-muted'}`}
          />
        </button>

        {/* Files Dropdown */}
        <AnimatePresence>
          {activeMenu === 'files' && (
            <motion.div
              key="files-dropdown"
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 2, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1.5 w-80 min-w-[320px] max-w-[90vw] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-2 backdrop-blur-md max-h-[85vh] overflow-y-auto space-y-2.5 text-xs select-none"
            >
              {/* Target Folder Action Section */}
              <div className="bg-primary/70 p-2.5 rounded-lg border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                    <FolderOpen size={12} className="text-accent" />
                    {t('header.targetDestination')}
                  </span>
                  {selectedFolderName && (
                    <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t('header.directDiskWrites')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectFolder();
                      setActiveMenu(null);
                    }}
                    title={selectedFolderName ? t('header.changeFolder') : t('header.selectOutputFolder')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                  >
                    <FolderPlus size={13} />
                    <span>{selectedFolderName ? t('header.changeFolder') : t('header.selectOutputFolder')}</span>
                  </button>
                  {selectedFolderName && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearFolder();
                        setActiveMenu(null);
                      }}
                      className="py-1.5 px-2 rounded-md bg-secondary hover:bg-tertiary border border-border-subtle text-rose-400 hover:text-rose-300 transition cursor-pointer"
                      title={t('sidebar.reset')}
                    >
                      {t('common.reset')}
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-mono text-content-muted truncate">
                  {selectedFolderName ? (
                    <span className="text-accent font-semibold">📁 /{selectedFolderName}</span>
                  ) : (
                    <span className="text-content-muted/70">{t('sidebar.browserDownload')}</span>
                  )}
                </div>

                {/* Recent Folders (Real History Only) */}
                {recentFolders.length > 0 && (
                  <div className="pt-1.5 border-t border-border-subtle/50 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-content-muted">
                      <span>{t('header.recentUsedFolders')}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearRecentFolders();
                          refreshStorageData();
                        }}
                        title={t('common.reset')}
                        className="text-[9px] text-content-muted hover:text-rose-400 hover:underline"
                      >
                        {t('common.reset')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {recentFolders.map((f) => (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => {
                            onSelectFolder();
                            setActiveMenu(null);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary hover:bg-tertiary border border-border-subtle text-content truncate max-w-[130px] transition cursor-pointer"
                          title={`Select ${f.name}`}
                        >
                          📁 {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sessions Management */}
              <div className="space-y-1">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between">
                  <span>{t('header.sessionHistory')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveModalOpen(true);
                      setActiveMenu(null);
                    }}
                    title={t('header.saveCurrent')}
                    className="text-[10px] text-accent hover:underline lowercase font-normal flex items-center gap-0.5 cursor-pointer"
                  >
                    <Save size={10} />
                    {t('header.saveCurrent')}
                  </button>
                </div>

                {/* Quick Restore Latest Session */}
                {latestSession && (
                  <button
                    type="button"
                    onClick={() => handleRestoreSession(latestSession)}
                    title={t('header.restoreLatestSession')}
                    className="w-full text-left p-2 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle flex items-center justify-between gap-2 transition group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-content text-xs flex items-center gap-1.5 truncate">
                        <RotateCcw size={11} className="text-accent group-hover:rotate-[-45deg] transition-transform" />
                        <span className="truncate">{t('header.restoreLatestSession')}</span>
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        {latestSession.tableName} • {latestSession.columns.length} cols • {new Date(latestSession.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium flex-shrink-0">
                      Auto
                    </span>
                  </button>
                )}

                {/* Saved Custom Sessions */}
                {savedSessions.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                    {savedSessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between p-1.5 rounded-md hover:bg-primary border border-transparent hover:border-border-subtle text-content transition group"
                      >
                        <button
                          type="button"
                          onClick={() => handleRestoreSession(sess)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <div className="font-medium truncate text-xs">{sess.name}</div>
                          <div className="text-[10px] text-content-muted truncate font-mono">
                            {sess.columns.length} cols • {sess.format.toUpperCase()} • {new Date(sess.timestamp).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedSession(sess.id);
                            refreshStorageData();
                          }}
                          className="p-1 text-content-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Delete saved session"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : !latestSession ? (
                  <div className="p-2 text-center text-[10px] text-content-muted/70 bg-primary/30 rounded border border-border-subtle/50">
                    {t('header.noSavedSnapshots')}
                  </div>
                ) : null}
              </div>

              {/* Recent Files Section (Real History Only) */}
              <div className="space-y-1">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between">
                  <span>{t('header.recentExports')}</span>
                  {recentFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearRecentFiles();
                        refreshStorageData();
                      }}
                      title={t('common.reset')}
                      className="text-[9px] text-content-muted hover:text-rose-400 hover:underline lowercase font-normal cursor-pointer"
                    >
                      {t('common.reset')}
                    </button>
                  )}
                </div>
                {recentFiles.length > 0 ? (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {recentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-1.5 rounded-md bg-primary/40 border border-border-subtle/60 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex items-center gap-1.5">
                          <FileText size={12} className="text-content-muted flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono font-medium text-xs truncate text-content">
                              {file.filename}
                            </div>
                            <div className="text-[10px] text-content-muted truncate">
                              {file.rowCount.toLocaleString()} rows • {file.folderName ? `/${file.folderName}` : 'download'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1 rounded bg-secondary text-content-muted border border-border-subtle flex-shrink-0">
                          {file.format}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-center text-[10px] text-content-muted/70 bg-primary/30 rounded border border-border-subtle/50">
                    {t('header.noFilesGenerated')}
                  </div>
                )}
              </div>

              {/* Blueprint Export / Import / Reset */}
              <div className="pt-2 border-t border-border-subtle space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    exportSchemaJSON(columns, tableName);
                    setActiveMenu(null);
                    setStatusMessage(`Exported schema blueprint "${tableName}_blueprint.json"`);
                  }}
                  title={t('header.exportBlueprint')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <Download size={12} className="text-accent" />
                  <span>{t('header.exportBlueprint')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  title={t('header.importBlueprint')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <Upload size={12} className="text-accent" />
                  <span>{t('header.importBlueprint')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear all fields to start with an empty schema?')) {
                      setColumns([]);
                      setActiveMenu(null);
                      setStatusMessage('Schema reset to blank.');
                    }
                  }}
                  title={t('header.resetBlankSchema')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition text-left cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>{t('header.resetBlankSchema')}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Settings Menu Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'settings' ? null : 'settings')}
          className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeMenu === 'settings'
              ? 'bg-accent text-white shadow-xs'
              : 'text-content hover:bg-tertiary/70 border border-transparent hover:border-border-subtle'
          }`}
          aria-expanded={activeMenu === 'settings'}
          title={t('header.settingsMenu')}
        >
          <span>{t('header.settingsMenu')}</span>
          <ChevronDown
            size={11}
            className={`transition-transform duration-150 ${activeMenu === 'settings' ? 'rotate-180 text-white' : 'text-content-muted'}`}
          />
        </button>

        {/* Settings Dropdown */}
        <AnimatePresence>
          {activeMenu === 'settings' && (
            <motion.div
              key="settings-dropdown"
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 2, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1.5 w-80 min-w-[320px] max-w-[90vw] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-3 backdrop-blur-md space-y-3 text-xs select-none"
            >
              <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                <span className="font-bold uppercase tracking-wider text-[11px] text-content flex items-center gap-1.5">
                  <Sliders size={13} className="text-accent" />
                  <span>{t('header.settingsMenu')}</span>
                </span>
              </div>

              {/* Language Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe size={11} className="text-accent" />
                    {t('header.language')}
                  </span>
                  <span className="font-mono text-accent">
                    {availableLocales.find((l) => l.code === locale)?.nativeName}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {availableLocales.map((loc) => {
                    const isSel = loc.code === locale;
                    return (
                      <button
                        key={loc.code}
                        type="button"
                        onClick={() => setLocale(loc.code)}
                        title={`Switch language to ${loc.nativeName} (${loc.name})`}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer text-left ${
                          isSel
                            ? 'bg-accent text-white border-accent shadow-xs font-semibold'
                            : 'bg-primary hover:bg-tertiary border-border-subtle text-content'
                        }`}
                      >
                        <span className="text-xs leading-none">{loc.flag}</span>
                        <span className="truncate">{loc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Export Format */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                  {t('header.defaultExportFormat')}
                </label>
                <FormatSelectDropdown value={format} onChange={setFormat} />
              </div>

              {/* Batch Size Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between">
                  <span>{t('header.batchOutputRows')}</span>
                  <span className="font-mono text-accent">{count.toLocaleString()}</span>
                </label>
                <AnimatedTabs
                  tabs={[
                    { id: '500', label: '500', title: '500 rows' },
                    { id: '1000', label: '1k', title: '1,000 rows' },
                    { id: '5000', label: '5k', title: '5,000 rows' },
                    { id: '25000', label: '25k', title: '25,000 rows' },
                  ]}
                  activeTab={String(count)}
                  onChange={(c) => setCount(Number(c))}
                  layoutId="settings-batch-count"
                  variant="pill"
                  size="xs"
                  fullWidth
                />
              </div>

              {/* Stream Throttle Speed */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between">
                  <span>{t('header.streamingThrottle')}</span>
                  <span className="font-mono text-content-muted">{intervalMs}ms</span>
                </label>
                <AnimatedTabs
                  tabs={[
                    { id: '50', label: 'Fast (50ms)', title: '50ms interval (High speed)' },
                    { id: '150', label: 'Norm (150ms)', title: '150ms interval (Balanced)' },
                    { id: '400', label: 'Eco (400ms)', title: '400ms interval (Resource saver)' },
                  ]}
                  activeTab={String(intervalMs)}
                  onChange={(ms) => setIntervalMs(Number(ms))}
                  layoutId="settings-stream-throttle"
                  variant="pill"
                  size="xs"
                  fullWidth
                />
              </div>

              {/* Reset Defaults */}
              <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setFormat('csv');
                    setCount(1000);
                    setIntervalMs(150);
                    setStatusMessage('Preferences reset to default values.');
                  }}
                  title={t('header.resetDefaults')}
                  className="text-[10px] text-content-muted hover:text-content hover:underline cursor-pointer"
                >
                  {t('header.resetDefaults')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMenu(null)}
                  title={t('header.done')}
                  className="px-2.5 py-1 bg-primary hover:bg-tertiary border border-border-subtle rounded text-[11px] font-medium text-content transition cursor-pointer"
                >
                  {t('header.done')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Advance & More Combined Menu Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'advance' ? null : 'advance')}
          className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeMenu === 'advance'
              ? 'bg-accent text-white shadow-xs'
              : 'text-content hover:bg-tertiary/70 border border-transparent hover:border-border-subtle'
          }`}
          aria-expanded={activeMenu === 'advance'}
          title={t('header.advanceMenu')}
        >
          <Sparkles size={11} className={activeMenu === 'advance' ? 'text-white' : 'text-accent'} />
          <span>{t('header.advanceMenu')}</span>
          <ChevronDown
            size={11}
            className={`transition-transform duration-150 ${activeMenu === 'advance' ? 'rotate-180 text-white' : 'text-content-muted'}`}
          />
        </button>

        {/* Advance & More Dropdown */}
        <AnimatePresence>
          {activeMenu === 'advance' && (
            <motion.div
              key="advance-dropdown"
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 2, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1.5 w-80 min-w-[320px] max-w-[92vw] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-2 backdrop-blur-md space-y-2 text-xs select-none max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-2 pt-1 pb-1.5 border-b border-border-subtle/60">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  <span className="font-bold text-xs text-content uppercase tracking-wider">{t('header.advanceEngine')}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
                  Extensible
                </span>
              </div>

              {/* Section 1: Custom Column Type Architect */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomTypeInitialTab(customTypesList.length > 0 ? 'installed' : 'examples');
                    setIsCustomTypeModalOpen(true);
                    setActiveMenu(null);
                  }}
                  title={t('header.customColumnStudioDesc')}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-tertiary text-content transition text-left group border border-border-subtle/70 bg-primary/40 hover:border-border-subtle cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-accent/15 text-accent group-hover:bg-accent group-hover:text-white transition flex-shrink-0">
                      <Layers size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate">{t('header.customColumnStudio')}</div>
                      <div className="text-[10px] text-content-muted truncate">{t('header.customColumnStudioDesc')}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded text-content-muted border border-border-subtle flex-shrink-0 ml-2">
                    {customTypesList.length} {t('common.active')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenRestApi?.();
                    setActiveMenu(null);
                  }}
                  title="Connect external REST APIs to fetch real columns and enrich synthetic rows"
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-tertiary text-content transition text-left group border border-border-subtle/70 bg-primary/40 hover:border-border-subtle cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition flex-shrink-0">
                      <Globe size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate">REST API Live Retrieval</div>
                      <div className="text-[10px] text-content-muted truncate">Real API endpoints for columns & rows</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded flex-shrink-0 ml-2 font-bold">
                    HTTP/S
                  </span>
                </button>
              </div>

              {/* Section 2: Schemas & Tools */}
              <div className="pt-1.5 border-t border-border-subtle/60 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPresets();
                    setActiveMenu(null);
                  }}
                  title={t('header.presetsDesc')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-accent/10 text-accent flex-shrink-0">
                    <Layers size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{t('header.presetsMenu')}</div>
                    <div className="text-[10px] text-content-muted">{t('header.presetsDesc')}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenFolderMonitor();
                    setActiveMenu(null);
                  }}
                  title={t('header.folderMonitorDesc')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-500 flex-shrink-0">
                    <FolderLock size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>{t('header.folderMonitor')}</span>
                      <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">
                        100% Offline
                      </span>
                    </div>
                    <div className="text-[10px] text-content-muted">{t('header.folderMonitorDesc')}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenOfflineExtractor();
                    setActiveMenu(null);
                  }}
                  title={t('header.offlineExtractorDesc')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-accent/10 text-accent flex-shrink-0">
                    <FileSpreadsheet size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{t('header.offlineExtractor')}</div>
                    <div className="text-[10px] text-content-muted">{t('header.offlineExtractorDesc')}</div>
                  </div>
                </button>
              </div>

              {/* Section 3: Reference & Guides */}
              <div className="pt-1.5 border-t border-border-subtle/60 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormulasOpen(true);
                    setActiveMenu(null);
                  }}
                  title={t('header.formulaEngine')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <HelpCircle size={13} className="text-content-muted" />
                  <span>{t('header.formulaEngine')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsShortcutsOpen(true);
                    setActiveMenu(null);
                  }}
                  title={t('header.shortcutsGuide')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <Keyboard size={13} className="text-content-muted" />
                  <span>{t('header.shortcutsGuide')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAboutOpen(true);
                    setActiveMenu(null);
                  }}
                  title={t('header.aboutEngine')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-tertiary text-content transition text-left cursor-pointer"
                >
                  <Info size={13} className="text-content-muted" />
                  <span>{t('header.aboutEngine')}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save Session Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-secondary border border-border-subtle rounded-xl shadow-2xl p-5 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-content flex items-center gap-2">
                  <Save size={15} className="text-accent" />
                  Save Session Snapshot
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="p-1 rounded text-content-muted hover:text-content"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-content-muted">Snapshot Name</label>
                <input
                  type="text"
                  value={customSessionName}
                  onChange={(e) => setCustomSessionName(e.target.value)}
                  placeholder={`${tableName || 'schema'}_checkpoint`}
                  className="w-full px-3 py-2 text-xs bg-primary border border-border-subtle rounded-md text-content focus:outline-none focus:border-accent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCurrentSession();
                  }}
                />
              </div>

              <div className="text-[11px] text-content-muted">
                Captures {columns.length} columns, active table name, export format, and synthesis parameters into local storage.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-content-muted hover:text-content"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentSession}
                  className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-md text-xs font-semibold shadow-xs"
                >
                  Save Snapshot
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {isShortcutsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-secondary border border-border-subtle rounded-xl shadow-2xl p-5 max-w-md w-full space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="font-bold text-sm text-content flex items-center gap-2">
                  <Keyboard size={16} className="text-accent" />
                  Keyboard Shortcuts
                </h3>
                <button
                  type="button"
                  onClick={() => setIsShortcutsOpen(false)}
                  className="p-1 rounded text-content-muted hover:text-content"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'Ctrl / ⌘ + Enter', desc: 'Generate Batch or toggle Live Stream' },
                  { key: 'Ctrl / ⌘ + S', desc: 'Save Session Snapshot' },
                  { key: 'Ctrl / ⌘ + K', desc: 'Search columns or datasets' },
                  { key: 'Esc', desc: 'Close open dialogs, menus, or context popups' },
                  { key: 'Right Click', desc: 'Field card context menu (Copy, Cut, Duplicate, Delete)' }
                ].map((s) => (
                  <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-border-subtle/40">
                    <span className="text-content-muted">{s.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-primary border border-border-subtle font-mono text-[11px] text-accent font-semibold shadow-2xs">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsShortcutsOpen(false)}
                  className="px-4 py-1.5 bg-primary hover:bg-tertiary border border-border-subtle rounded-md font-semibold text-content"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Formula Syntax Modal */}
      <AnimatePresence>
        {isFormulasOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-secondary border border-border-subtle rounded-xl shadow-2xl p-5 max-w-lg w-full space-y-4 text-xs max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="font-bold text-sm text-content flex items-center gap-2">
                  <HelpCircle size={16} className="text-accent" />
                  Formula & Type Reference
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormulasOpen(false)}
                  className="p-1 rounded text-content-muted hover:text-content"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { type: 'Int', rule: 'min, max', ex: '10, 100', desc: 'Uniform random integer between min and max' },
                  { type: 'Float', rule: 'min, max, decimals', ex: '1.5, 99.9, 2', desc: 'Random float rounded to specified decimals' },
                  { type: 'Sequence', rule: 'startNumber', ex: '1001', desc: 'Incrementing sequence per row' },
                  { type: 'Set / Enum', rule: 'val1, val2, val3', ex: 'Active, Pending, Suspended', desc: 'Picks randomly from comma-separated list' },
                  { type: 'RegEx', rule: 'pattern', ex: '[A-Z]{3}-\\d{4}', desc: 'Synthesizes strings matching regex syntax' },
                  { type: 'Calculation', rule: 'expression with {col_name}', ex: '{price} * {quantity} * 1.08', desc: 'Dynamic math evaluation referencing other columns' },
                  { type: 'DateTime', rule: 'format', ex: 'YYYY-MM-DD HH:mm:ss', desc: 'Random timestamp within the last 12 months' },
                  { type: 'Entity', rule: 'entity_type', ex: 'full_name, email, city, country, company', desc: 'Realistic semantic identities and coordinates' }
                ].map((item) => (
                  <div key={item.type} className="p-2.5 rounded-lg bg-primary border border-border-subtle space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-accent font-mono">{item.type}</span>
                      <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                        {item.ex}
                      </code>
                    </div>
                    <div className="text-[11px] text-content-muted">{item.desc}</div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormulasOpen(false)}
                  className="px-4 py-1.5 bg-primary hover:bg-tertiary border border-border-subtle rounded-md font-semibold text-content"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* About Vampio Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-secondary border border-border-subtle rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4 text-center"
            >
              <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent border border-accent/30 mx-auto flex items-center justify-center font-mono font-bold text-lg">
                V
              </div>
              <div>
                <h3 className="font-bold text-base text-content font-mono">VAMPIO SYNTHESIZER</h3>
                <p className="text-[11px] text-content-muted mt-0.5">High-Performance Synthetic Data Engine</p>
              </div>

              <div className="text-xs text-content-muted bg-primary p-3 rounded-lg border border-border-subtle space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span>Engine Mode:</span>
                  <span className="font-mono text-emerald-500 font-bold">100% Client-Side</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Data Privacy:</span>
                  <span className="font-mono text-accent">Zero Telemetry</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Direct Write:</span>
                  <span className="font-mono text-content">FS Access API</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-xs font-semibold shadow-xs"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advance Custom Column Types Studio Modal */}
      <CustomTypeModal
        isOpen={isCustomTypeModalOpen}
        onClose={() => {
          setIsCustomTypeModalOpen(false);
          refreshStorageData();
        }}
        initialTab={customTypeInitialTab}
        onAddColumnToSchema={handleAddCustomColumnToSchema}
        setStatusMessage={setStatusMessage}
      />
    </div>
  );
};
