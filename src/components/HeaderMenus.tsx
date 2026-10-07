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
  Globe,
  Activity,
  Plus
} from 'lucide-react';
import { ColumnSpec, ExportFormat } from '../types';
import { AnimatedTabs } from './AnimatedTabs';
import { FormatSelectDropdown } from './FormatSelectDropdown';
import { CustomTypeModal, CustomTypeModalTab } from './CustomTypeModal';
import { useI18n, LanguageSelectDropdown, FlagIcon } from '../i18n';
import { useUserRole } from '../context/UserRoleContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportWorkspacesAsJson } from '../utils/workspaceStorage';
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
  onOpenImportBundle?: () => void;
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
  onOpenImportBundle,
  onOpenRestApi,
  setStatusMessage
}) => {
  const { t, locale, setLocale, availableLocales } = useI18n();
  const { setRole } = useUserRole();
  const { 
    workspaces, 
    activeWorkspaceId, 
    savePolicy,
    setSavePolicy,
    displayMode,
    setDisplayMode,
    isSettingsModalOpen,
    switchWorkspace, 
    createWorkspace, 
    setIsQuickSwitcherOpen, 
    setIsSettingsModalOpen 
  } = useWorkspace();
  const [activeMenu, setActiveMenu] = useState<'files' | 'settings' | 'advance' | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'workspace'>('general');
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
  const workspaceFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize with external settings open events (e.g. from tab bar gear)
  useEffect(() => {
    if (isSettingsModalOpen) {
      setActiveMenu('settings');
      setSettingsSubTab('workspace');
      setIsSettingsModalOpen(false);
    }
  }, [isSettingsModalOpen, setIsSettingsModalOpen]);

  // Listen for custom types manager request
  useEffect(() => {
    const handleOpenCustomTypes = () => {
      setIsCustomTypeModalOpen(true);
    };
    window.addEventListener('vampio-open-custom-types', handleOpenCustomTypes);
    return () => window.removeEventListener('vampio-open-custom-types', handleOpenCustomTypes);
  }, []);

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
          setStatusMessage('Error: Invalid blueprint JSON format. Expected { columns: [...] }');
        }
      } catch (err: any) {
        setStatusMessage(`Error: Failed to parse blueprint JSON: ${err.message}`);
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
          className={`h-7 px-1.5 sm:px-2 md:px-2.5 rounded-md text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer ${
            activeMenu === 'files'
              ? 'bg-accent text-white shadow-xs'
              : 'text-content hover:bg-tertiary/70 border border-transparent hover:border-border-subtle'
          }`}
          aria-expanded={activeMenu === 'files'}
          title={t('header.fileMenu')}
        >
          <Folder size={12} className={activeMenu === 'files' ? 'text-white' : 'text-accent flex-shrink-0'} />
          <span className="hidden md:inline truncate">{t('header.fileMenu')}</span>
          <ChevronDown
            size={10}
            className={`transition-transform duration-150 flex-shrink-0 ${activeMenu === 'files' ? 'rotate-180 text-white' : 'text-content-muted'}`}
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
              className="absolute left-0 top-full mt-1.5 w-80 min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-1rem)] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-2 backdrop-blur-md max-h-[85vh] overflow-y-auto space-y-2.5 text-xs select-none"
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

              {/* Multi-Project Workspaces Section */}
              <div className="space-y-1 bg-primary/40 p-2 rounded-lg border border-border-subtle/70">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-content-muted">
                  <div className="flex items-center gap-1.5">
                    <Layers size={11} className="text-accent" />
                    <span>Project Workspaces ({workspaces.length})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        createWorkspace({
                          name: `Project ${workspaces.length + 1}`,
                          tableName: `dataset_${workspaces.length + 1}`,
                          columns: [],
                        });
                        setActiveMenu(null);
                      }}
                      title="New Project Workspace"
                      className="text-[9px] text-accent hover:underline flex items-center gap-0.5 cursor-pointer font-normal"
                    >
                      <Plus size={10} />
                      <span>New</span>
                    </button>
                    <span className="text-border-subtle">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickSwitcherOpen(true);
                        setActiveMenu(null);
                      }}
                      className="text-[9px] text-content-muted hover:text-content font-mono cursor-pointer"
                    >
                      ⌘K
                    </button>
                  </div>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                  {workspaces.map((ws) => {
                    const isActive = ws.id === activeWorkspaceId;
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => {
                          switchWorkspace(ws.id);
                          setActiveMenu(null);
                        }}
                        className={`w-full flex items-center justify-between p-1.5 rounded-md text-left transition cursor-pointer border ${
                          isActive
                            ? 'bg-card border-accent/40 text-content shadow-2xs'
                            : 'hover:bg-primary border-transparent text-content-muted hover:text-content'
                        }`}
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                            <span className="truncate">{ws.name}</span>
                          </div>
                          <div className="text-[10px] text-content-muted truncate font-mono">
                            {ws.tableName} · {ws.columns?.length || 0} cols · {ws.format?.toUpperCase() || 'CSV'}
                          </div>
                        </div>
                        {isActive && (
                          <span className="text-[9px] px-1 py-0 rounded bg-emerald-500/15 text-emerald-400 font-mono shrink-0 ml-1">
                            active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
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
          className={`h-7 px-1.5 sm:px-2 md:px-2.5 rounded-md text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer ${
            activeMenu === 'settings'
              ? 'bg-accent text-white shadow-xs'
              : 'text-content hover:bg-tertiary/70 border border-transparent hover:border-border-subtle'
          }`}
          aria-expanded={activeMenu === 'settings'}
          title={t('header.settingsMenu')}
        >
          <Sliders size={12} className={activeMenu === 'settings' ? 'text-white' : 'text-accent flex-shrink-0'} />
          <span className="hidden md:inline truncate">{t('header.settingsMenu')}</span>
          <ChevronDown
            size={10}
            className={`transition-transform duration-150 flex-shrink-0 ${activeMenu === 'settings' ? 'rotate-180 text-white' : 'text-content-muted'}`}
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
              className="absolute left-0 top-full mt-1.5 w-80 min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-1rem)] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-3 backdrop-blur-md space-y-3 text-xs select-none"
            >
              <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                <span className="font-bold uppercase tracking-wider text-[11px] text-content flex items-center gap-1.5">
                  <Sliders size={13} className="text-accent" />
                  <span>{t('header.settingsMenu')}</span>
                </span>
              </div>

              {/* Subtabs Header: General vs Workspace & Projects */}
              <div className="flex items-center gap-1 border-b border-border-subtle/70 pb-2 mb-2">
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('general')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    settingsSubTab === 'general'
                      ? 'bg-accent/15 text-accent border border-accent/40 font-semibold'
                      : 'text-content-muted hover:text-content hover:bg-primary/60 border border-transparent'
                  }`}
                >
                  <Sliders size={12} />
                  <span>General</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('workspace')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    settingsSubTab === 'workspace'
                      ? 'bg-accent/15 text-accent border border-accent/40 font-semibold'
                      : 'text-content-muted hover:text-content hover:bg-primary/60 border border-transparent'
                  }`}
                >
                  <Layers size={12} />
                  <span>Workspaces & Projects</span>
                </button>
              </div>

              {settingsSubTab === 'general' ? (
                <>
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
                            <span className="text-xs leading-none flex items-center justify-center">
                              <FlagIcon country={loc.code} className="w-3.5 h-2.5" title={loc.name} />
                            </span>
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
                </>
              ) : (
                /* Workspace & Projects Tab */
                <div className="space-y-3">
                  {/* Save Policy */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Save size={11} className="text-accent" />
                        <span>Save Policy</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 capitalize">
                        {savePolicy}
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setSavePolicy('auto')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition cursor-pointer ${
                          savePolicy === 'auto'
                            ? 'bg-accent/15 text-accent border-accent font-semibold shadow-xs'
                            : 'bg-primary/50 hover:bg-tertiary border-border-subtle text-content-muted hover:text-content'
                        }`}
                        title="Auto-saves modifications in real time to IndexedDB"
                      >
                        <span className="text-[11px] font-medium">Auto-Save</span>
                        <span className="text-[9px] text-emerald-400 font-mono">Recommended</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavePolicy('prompt')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition cursor-pointer ${
                          savePolicy === 'prompt'
                            ? 'bg-accent/15 text-accent border-accent font-semibold shadow-xs'
                            : 'bg-primary/50 hover:bg-tertiary border-border-subtle text-content-muted hover:text-content'
                        }`}
                        title="Prompts to confirm before leaving dirty workspace"
                      >
                        <span className="text-[11px] font-medium">Prompt</span>
                        <span className="text-[9px] text-content-muted font-mono">Confirm first</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavePolicy('manual')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition cursor-pointer ${
                          savePolicy === 'manual'
                            ? 'bg-accent/15 text-accent border-accent font-semibold shadow-xs'
                            : 'bg-primary/50 hover:bg-tertiary border-border-subtle text-content-muted hover:text-content'
                        }`}
                        title="Manual save only with unsaved dirty dots"
                      >
                        <span className="text-[11px] font-medium flex items-center gap-1">
                          <span>Manual</span>
                          <span className="text-amber-400 text-xs">●</span>
                        </span>
                        <span className="text-[9px] text-content-muted font-mono">Ctrl+S only</span>
                      </button>
                    </div>
                  </div>

                  {/* Navigation Style */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                      Navigation Style
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDisplayMode('top-bar')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                          displayMode === 'top-bar'
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-primary/50 hover:bg-tertiary border-border-subtle text-content-muted hover:text-content'
                        }`}
                      >
                        <span>Top Tab Bar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayMode('sidebar')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                          displayMode === 'sidebar'
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-primary/50 hover:bg-tertiary border-border-subtle text-content-muted hover:text-content'
                        }`}
                      >
                        <span>Sidebar Drawer</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Switcher & Project Actions */}
                  <div className="space-y-1.5 pt-1 border-t border-border-subtle/50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickSwitcherOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle text-content transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Layers size={13} className="text-accent" />
                        <span>Quick Project Switcher</span>
                      </span>
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary rounded border border-border-subtle">
                        ⌘K
                      </kbd>
                    </button>
                  </div>

                  {/* Backup / Export All Projects */}
                  <div className="space-y-1.5 pt-1 border-t border-border-subtle/50">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                      Backup & Restore Projects
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const jsonStr = exportWorkspacesAsJson(workspaces);
                          const blob = new Blob([jsonStr], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `vampio_all_workspaces_${new Date().toISOString().slice(0, 10)}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setStatusMessage(`Exported backup of ${workspaces.length} workspace projects.`);
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
                      >
                        <Download size={11} className="text-accent" />
                        <span>Export All</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => workspaceFileInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
                      >
                        <Upload size={11} className="text-accent" />
                        <span>Restore Backup</span>
                      </button>
                      <input
                        ref={workspaceFileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const text = event.target?.result as string;
                              const parsed = JSON.parse(text);
                              if (parsed.workspaces && Array.isArray(parsed.workspaces)) {
                                for (const ws of parsed.workspaces) {
                                  await createWorkspace({
                                    name: ws.name || 'Imported Workspace',
                                    tableName: ws.tableName,
                                    columns: ws.columns || [],
                                    format: ws.format || 'csv',
                                  });
                                }
                                setStatusMessage(`Restored ${parsed.workspaces.length} projects successfully.`);
                                setActiveMenu(null);
                              } else {
                                setStatusMessage('Error: Invalid workspaces backup file.');
                              }
                            } catch (err: any) {
                              setStatusMessage(`Error: Failed to import workspaces: ${err.message}`);
                            }
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </div>
                  </div>

                  {/* Done / Close Button */}
                  <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      title={t('header.done')}
                      className="px-3 py-1 bg-accent hover:bg-accent-hover text-white rounded text-[11px] font-medium transition cursor-pointer"
                    >
                      {t('header.done')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Advance & More Combined Menu Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveMenu(activeMenu === 'advance' ? null : 'advance')}
          className={`h-7 px-1.5 sm:px-2 md:px-2.5 rounded-md text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer ${
            activeMenu === 'advance'
              ? 'bg-accent text-white shadow-xs'
              : 'text-content hover:bg-tertiary/70 border border-transparent hover:border-border-subtle'
          }`}
          aria-expanded={activeMenu === 'advance'}
          title={t('header.advanceMenu')}
        >
          <Sparkles size={11} className={activeMenu === 'advance' ? 'text-white' : 'text-accent flex-shrink-0'} />
          <span className="hidden lg:inline truncate">{t('header.advanceMenu')}</span>
          <ChevronDown
            size={10}
            className={`transition-transform duration-150 flex-shrink-0 ${activeMenu === 'advance' ? 'rotate-180 text-white' : 'text-content-muted'}`}
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
              className="absolute left-0 top-full mt-1.5 w-84 min-w-[280px] sm:min-w-[330px] max-w-[calc(100vw-1rem)] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-md space-y-2.5 text-xs select-none max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-border-subtle/60">
                <span className="font-bold uppercase tracking-wider text-[11px] text-content flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  <span>{t('header.advanceEngine')}</span>
                </span>
              </div>

              {/* Section 1: Custom Column Type Architect & Presets */}
              <div className="space-y-1">
                <div className="px-1 pt-0.5 pb-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-content-muted/70">
                  Generators & Presets
                </div>

                {/* Custom Column Studio */}
                <button
                  type="button"
                  onClick={() => {
                    setCustomTypeInitialTab(customTypesList.length > 0 ? 'installed' : 'examples');
                    setIsCustomTypeModalOpen(true);
                    setActiveMenu(null);
                  }}
                  title={t('header.customColumnStudioDesc')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-tertiary text-content transition-all text-left group border border-transparent hover:border-border-subtle/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Layers size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate group-hover:text-accent transition-colors">
                        {t('header.customColumnStudio')}
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        {t('header.customColumnStudioDesc')}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const activeCount = customTypesList.filter(t => t.isActive !== false).length;
                    const totalCount = customTypesList.length;
                    return (
                      <span className="text-[9px] font-mono bg-secondary px-1.5 py-0.5 rounded text-content-muted border border-border-subtle shrink-0 ml-2">
                        {activeCount === totalCount ? `${totalCount} ${t('common.active')}` : `${activeCount}/${totalCount} ${t('common.active')}`}
                      </span>
                    );
                  })()}
                </button>

                {/* Schema Presets */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenPresets();
                    setActiveMenu(null);
                  }}
                  title={t('header.presetsDesc')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-tertiary text-content transition-all text-left group border border-transparent hover:border-border-subtle/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent border border-accent/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Sparkles size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate group-hover:text-accent transition-colors">
                        {t('header.presetsMenu')}
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        {t('header.presetsDesc')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-secondary px-1.5 py-0.5 rounded text-content-muted border border-border-subtle shrink-0 ml-2">
                    Templates
                  </span>
                </button>
              </div>

              {/* Section 2: Automation & Offline Extraction */}
              <div className="pt-2 border-t border-border-subtle/60 space-y-1">
                <div className="px-1 pt-0.5 pb-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-content-muted/70">
                  Offline Tools & Automation
                </div>

                {/* Target Folder Monitor */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenFolderMonitor();
                    setActiveMenu(null);
                  }}
                  title={t('header.folderMonitorDesc')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-tertiary text-content transition-all text-left group border border-transparent hover:border-border-subtle/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FolderLock size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate group-hover:text-accent transition-colors">
                        {t('header.folderMonitor')}
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        {t('header.folderMonitorDesc')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                    100% Offline
                  </span>
                </button>

                {/* Offline Schema Extractor */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenOfflineExtractor();
                    setActiveMenu(null);
                  }}
                  title={t('header.offlineExtractorDesc')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-tertiary text-content transition-all text-left group border border-transparent hover:border-border-subtle/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate group-hover:text-accent transition-colors">
                        {t('header.offlineExtractor')}
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        {t('header.offlineExtractorDesc')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                    CSV/XLSX
                  </span>
                </button>

                {/* Machine Profile Bundle */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenImportBundle) onOpenImportBundle();
                    setActiveMenu(null);
                  }}
                  title="Import .vampio.profile.json bundle exported by field operators or folder monitors"
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-tertiary text-content transition-all text-left group border border-transparent hover:border-border-subtle/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileCode size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate group-hover:text-accent transition-colors">
                        Import Machine Profile Bundle
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        Load machine profile & auto-configure schema
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                    .JSON
                  </span>
                </button>

                {/* Switch to Operator Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setRole('operator');
                    setActiveMenu(null);
                  }}
                  title="Switch to Simplified Field Operator Mode (Folder Monitor & Profile Exporter)"
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-tertiary text-content transition-all text-left group border border-transparent hover:border-border-subtle/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Activity size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-content truncate group-hover:text-accent transition-colors">
                        Switch to Operator Mode
                      </div>
                      <div className="text-[10px] text-content-muted truncate">
                        Minimalist 2-click interface for technicians
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                    Switch
                  </span>
                </button>
              </div>

              {/* Section 3: Reference & Guides (Consistent 3-card micro grid) */}
              <div className="pt-2 border-t border-border-subtle/60 space-y-1.5">
                <div className="px-1 pt-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-content-muted/70">
                  Documentation & References
                </div>
                <div className="grid grid-cols-3 gap-1.5 px-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormulasOpen(true);
                      setActiveMenu(null);
                    }}
                    title={t('header.formulaEngine')}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle/60 hover:border-border-subtle text-content transition-all text-center group cursor-pointer"
                  >
                    <HelpCircle size={15} className="text-content-muted group-hover:text-accent mb-1 transition-colors" />
                    <span className="text-[10px] font-medium leading-tight text-content-muted group-hover:text-content">
                      Formulas
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsShortcutsOpen(true);
                      setActiveMenu(null);
                    }}
                    title={t('header.shortcutsGuide')}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle/60 hover:border-border-subtle text-content transition-all text-center group cursor-pointer"
                  >
                    <Keyboard size={15} className="text-content-muted group-hover:text-accent mb-1 transition-colors" />
                    <span className="text-[10px] font-medium leading-tight text-content-muted group-hover:text-content">
                      Shortcuts
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAboutOpen(true);
                      setActiveMenu(null);
                    }}
                    title={t('header.aboutEngine')}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-primary/40 hover:bg-tertiary border border-border-subtle/60 hover:border-border-subtle text-content transition-all text-center group cursor-pointer"
                  >
                    <Info size={15} className="text-content-muted group-hover:text-accent mb-1 transition-colors" />
                    <span className="text-[10px] font-medium leading-tight text-content-muted group-hover:text-content">
                      About
                    </span>
                  </button>
                </div>
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
                  <span className="font-mono text-emerald-500 font-bold">Local In-Memory Engine</span>
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
