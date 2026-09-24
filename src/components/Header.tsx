import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Layers, 
  ChevronDown, 
  Check, 
  Columns, 
  Table, 
  Split, 
  Radio,
  RefreshCw,
  FileSpreadsheet,
  Sun,
  Moon
} from 'lucide-react';
import { ThemeId, ColumnSpec, ExportFormat } from '../types';
import { VampireSquidLogo } from './VampireSquidLogo';
import { HeaderMenus } from './HeaderMenus';
import { AnimatedTabs } from './AnimatedTabs';
import { useI18n, LanguageSelectDropdown } from '../i18n';

export type WorkspaceTab = 'schema' | 'preview' | 'split';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  bg: string;
  card: string;
  accent: string;
  isLight: boolean;
  description?: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  // Light Themes
  { id: 'theme-nordic', label: 'Nordic Snow', bg: '#f8fafc', card: '#ffffff', accent: '#2563eb', isLight: true, description: 'Crisp minimal slate & royal cobalt' },
  { id: 'theme-cream', label: 'Cream Warm', bg: '#fbfbf9', card: '#f4f4ee', accent: '#ea580c', isLight: true, description: 'Warm editorial paper & citrus amber' },
  { id: 'theme-sage', label: 'Sage Botanical', bg: '#f6f8f5', card: '#ffffff', accent: '#15803d', isLight: true, description: 'Calming eucalyptus & forest emerald' },
  { id: 'theme-lavender', label: 'Lavender Mist', bg: '#f9f8fc', card: '#ffffff', accent: '#7c3aed', isLight: true, description: 'Soft studio lilac & royal violet' },
  { id: 'theme-sandstone', label: 'Sandstone Warm', bg: '#faf6f0', card: '#ffffff', accent: '#b45309', isLight: true, description: 'Warm desert clay & rich bronze' },
  { id: 'theme-rose', label: 'Rose Quartz', bg: '#fff8f9', card: '#ffffff', accent: '#e11d48', isLight: true, description: 'Gentle blush & crimson rose' },
  // Dark Themes
  { id: 'theme-slate', label: 'Slate Dark', bg: '#090d16', card: '#111827', accent: '#6366f1', isLight: false, description: 'Deep obsidian & electric indigo' },
  { id: 'theme-strawberry', label: 'Strawberry Dark', bg: '#18060c', card: '#270a14', accent: '#f43f5e', isLight: false, description: 'Midnight berry & crimson glow' },
  { id: 'theme-kiwi', label: 'Kiwi Forest Dark', bg: '#05140b', card: '#0c2014', accent: '#84cc16', isLight: false, description: 'Deep evergreen & lime punch' },
  { id: 'theme-neon', label: 'Neon Cyber Dark', bg: '#030712', card: '#0b1324', accent: '#06b6d4', isLight: false, description: 'High-contrast cyan cyber' },
];

interface Props {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  totalColumns: number;
  previewRowCount: number;
  tableName: string;
  setTableName: (name: string) => void;
  columns: ColumnSpec[];
  setColumns: (cols: ColumnSpec[]) => void;
  format: ExportFormat;
  setFormat: (fmt: ExportFormat) => void;
  count: number;
  setCount: (c: number) => void;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  selectedFolderName: string | null;
  onSelectFolder: () => void;
  onClearFolder: () => void;
  onImportSchema: (cols: ColumnSpec[], tableName?: string) => void;
  onOpenPresets: () => void;
  onOpenOfflineExtractor: () => void;
  onOpenFolderMonitor: () => void;
  onOpenRestApiModal?: () => void;
  isStreaming: boolean;
  isGeneratingBatch: boolean;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  setStatusMessage: (msg: string) => void;
}

export const Header: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  totalColumns,
  previewRowCount,
  tableName,
  setTableName,
  columns,
  setColumns,
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
  onOpenRestApiModal,
  isStreaming,
  isGeneratingBatch,
  theme,
  setTheme,
  setStatusMessage
}) => {
  const { t } = useI18n();
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsThemeOpen(false);
      }
    };

    if (isThemeOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeOpen]);

  const currentThemeMeta = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <header className="relative flex items-center justify-between px-3 sm:px-4 h-11 min-h-[44px] max-h-[44px] border-b border-border-subtle bg-secondary z-40 select-none gap-2 md:gap-3 shadow-2xs">
      {/* Left: Brand Identity & Menus (Files, Settings, Other) */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <div className="group flex items-center cursor-default py-0.5" title="VAMPIO">
          <div className="h-6 w-6 rounded-md bg-accent/10 text-accent border border-accent/20 flex items-center justify-center p-0.5 transition-colors group-hover:border-accent/40">
            <VampireSquidLogo className="w-full h-full object-contain" />
          </div>
          <span className="max-w-0 opacity-0 overflow-hidden group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-200 ease-out text-xs font-bold tracking-wider text-content uppercase font-mono whitespace-nowrap">
            VAMPIO
          </span>
        </div>

        <div className="h-3.5 w-px bg-border-subtle/80 mx-0.5 hidden sm:block" />

        {/* Pro Menu Bar: Files | Settings | Other */}
        <HeaderMenus
          columns={columns}
          setColumns={setColumns}
          tableName={tableName}
          setTableName={setTableName}
          format={format}
          setFormat={setFormat}
          count={count}
          setCount={setCount}
          intervalMs={intervalMs}
          setIntervalMs={setIntervalMs}
          selectedFolderName={selectedFolderName}
          onSelectFolder={onSelectFolder}
          onClearFolder={onClearFolder}
          onImportSchema={onImportSchema}
          onOpenPresets={onOpenPresets}
          onOpenOfflineExtractor={onOpenOfflineExtractor}
          onOpenFolderMonitor={onOpenFolderMonitor}
          onOpenRestApi={onOpenRestApiModal}
          setStatusMessage={setStatusMessage}
        />
      </div>

      {/* Center: Toggleable Workspace Tab Navigation */}
      <AnimatedTabs
        tabs={[
          {
            id: 'schema',
            label: t('header.schemaBuilder'),
            icon: <Columns size={12} />,
            badge: totalColumns,
            title: `${t('header.schemaBuilder')} (${totalColumns} ${t('common.columns')})`,
          },
          {
            id: 'preview',
            label: t('header.livePreview'),
            icon: <Table size={12} />,
            badge: previewRowCount > 0 ? previewRowCount : undefined,
            title: `${t('header.livePreview')} (${previewRowCount} ${t('common.rows')})`,
          },
          {
            id: 'split',
            label: t('header.splitWorkspace'),
            icon: <Split size={12} />,
            title: `${t('header.splitWorkspace')} (Side by side / Stacked)`,
          },
        ]}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as WorkspaceTab)}
        layoutId="workspace-main-tabs"
        variant="pill"
        size="xs"
        className="mx-1 sm:mx-2"
      />

      {/* Right: Status Indicators, Language & Theme */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Active streaming or batch generation badge */}
        {isStreaming && (
          <div
            title={t('header.streamingActive')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-mono font-medium animate-pulse cursor-help"
          >
            <Radio size={11} />
            <span className="hidden sm:inline">Streaming</span>
          </div>
        )}
        {isGeneratingBatch && (
          <div
            title={t('header.batchSynthesizing')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-mono font-medium cursor-help"
          >
            <RefreshCw size={11} className="animate-spin" />
            <span className="hidden sm:inline">Synthesizing</span>
          </div>
        )}

        {/* Language Switcher */}
        <LanguageSelectDropdown compact />

        {/* Theme Dropdown */}
        <div className="relative" ref={themeDropdownRef}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className={`h-7 flex items-center gap-1.5 px-2 rounded-md border text-xs font-medium transition-colors ${
              isThemeOpen
                ? 'bg-tertiary border-accent text-content ring-1 ring-accent/30'
                : 'bg-primary/70 hover:bg-tertiary border-border-subtle text-content'
            }`}
            title={`Current Theme: ${currentThemeMeta.label} (${currentThemeMeta.isLight ? t('header.lightMode') : t('header.darkMode')})`}
            aria-label="Theme menu"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentThemeMeta.isLight ? 'sun' : 'moon'}
                initial={{ rotate: -45, scale: 0.7, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 45, scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center flex-shrink-0"
              >
                {currentThemeMeta.isLight ? (
                  <Sun size={12} className="text-amber-500" />
                ) : (
                  <Moon size={12} className="text-accent" />
                )}
              </motion.div>
            </AnimatePresence>
            <span
              className="w-2 h-2 rounded-full border border-black/20 flex-shrink-0"
              style={{ backgroundColor: currentThemeMeta.accent }}
            />
            <span className="hidden sm:inline text-[11px] max-w-[75px] truncate text-content-muted">
              {currentThemeMeta.label}
            </span>
            <ChevronDown size={11} className={`text-content-muted transition-transform duration-200 ${isThemeOpen ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {isThemeOpen && (
              <motion.div
                key="theme-dropdown-popup"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute right-0 top-full mt-1.5 w-64 min-w-[256px] bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 flex flex-col p-2 backdrop-blur-md max-h-[80vh] overflow-y-auto"
              >
                {/* Light Themes Section */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5 border-b border-border-subtle/50 mb-1">
                  <Sun size={11} className="text-amber-500" />
                  <span>{t('header.lightThemes')}</span>
                </div>
                <div className="space-y-0.5 mb-2">
                  {THEME_OPTIONS.filter((t) => t.isLight).map((themeItem) => {
                    const isActive = theme === themeItem.id;
                    return (
                      <motion.button
                        key={themeItem.id}
                        type="button"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTheme(themeItem.id);
                          setIsThemeOpen(false);
                        }}
                        title={`Switch to ${themeItem.label} theme`}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all text-left ${
                          isActive
                            ? 'bg-accent text-white font-bold shadow-xs'
                            : 'text-content hover:bg-tertiary font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center -space-x-1 flex-shrink-0">
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
                              style={{ backgroundColor: themeItem.bg }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
                              style={{ backgroundColor: themeItem.card }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
                              style={{ backgroundColor: themeItem.accent }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs leading-tight truncate">{themeItem.label}</div>
                            {themeItem.description && (
                              <div className={`text-[10px] leading-tight truncate ${isActive ? 'text-white/80' : 'text-content-muted'}`}>
                                {themeItem.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {isActive && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <Check size={13} className="flex-shrink-0 ml-1.5" />
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Dark Themes Section */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5 border-b border-border-subtle/50 mb-1 pt-1 border-t">
                  <Moon size={11} className="text-accent" />
                  <span>{t('header.darkThemes')}</span>
                </div>
                <div className="space-y-0.5">
                  {THEME_OPTIONS.filter((t) => !t.isLight).map((themeItem) => {
                    const isActive = theme === themeItem.id;
                    return (
                      <motion.button
                        key={themeItem.id}
                        type="button"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTheme(themeItem.id);
                          setIsThemeOpen(false);
                        }}
                        title={`Switch to ${themeItem.label} theme`}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-all text-left ${
                          isActive
                            ? 'bg-accent text-white font-bold shadow-xs'
                            : 'text-content hover:bg-tertiary font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center -space-x-1 flex-shrink-0">
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: themeItem.bg }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: themeItem.card }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: themeItem.accent }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs leading-tight truncate">{themeItem.label}</div>
                            {themeItem.description && (
                              <div className={`text-[10px] leading-tight truncate ${isActive ? 'text-white/80' : 'text-content-muted'}`}>
                                {themeItem.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {isActive && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <Check size={13} className="flex-shrink-0 ml-1.5" />
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
