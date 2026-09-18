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
  Sliders,
  Radio,
  RefreshCw,
  FileSpreadsheet,
  Sun,
  Moon
} from 'lucide-react';
import { ThemeId } from '../types';
import { VampireSquidLogo } from './VampireSquidLogo';

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
  onOpenPresets: () => void;
  onOpenOfflineExtractor: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isStreaming: boolean;
  isGeneratingBatch: boolean;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

export const Header: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  totalColumns,
  previewRowCount,
  tableName,
  onOpenPresets,
  onOpenOfflineExtractor,
  isSidebarOpen,
  onToggleSidebar,
  isStreaming,
  isGeneratingBatch,
  theme,
  setTheme,
}) => {
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
    <header className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-border-subtle bg-secondary z-30 flex-wrap gap-2 md:gap-3 shadow-xs">
      {/* Left: Brand Identity & Presets */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 order-1 md:order-none">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent/10 text-accent border border-accent/20 flex items-center justify-center p-1 shadow-xs transition hover:border-accent/40">
            <VampireSquidLogo className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-black tracking-tight text-content">
            VAMPIO
          </span>
        </div>

        {/* Active Schema Table Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary border border-border-subtle text-xs font-mono text-content-muted">
          <span className="text-[10px] uppercase font-bold text-accent">Table:</span>
          <span className="text-content font-semibold truncate max-w-[130px]">{tableName}</span>
        </div>

        {/* Presets Button */}
        <button
          type="button"
          onClick={onOpenPresets}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content transition-all shadow-xs"
          title="Browse domain schema blueprints"
        >
          <Layers size={13} className="text-accent" />
          <span>Presets</span>
        </button>

        {/* Offline Schema Extractor Button */}
        <button
          type="button"
          onClick={onOpenOfflineExtractor}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle hover:border-accent/40 text-xs font-semibold text-content transition-all shadow-xs"
          title="Import Excel / CSV offline to extract schema pattern architecture (No AI/APIs)"
        >
          <FileSpreadsheet size={13} className="text-emerald-400" />
          <span className="hidden md:inline">Extract Schema</span>
          <span className="md:hidden">Import</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            Offline
          </span>
        </button>
      </div>

      {/* Center: Toggleable Workspace Tab Navigation */}
      <div className="relative flex items-center bg-primary border border-border-subtle p-0.5 rounded-xl shadow-inner order-3 md:order-none w-full max-w-[340px] md:max-w-none md:w-auto justify-center mx-auto md:mx-0 shrink-0 mt-1 md:mt-0">
        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`relative flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 md:py-1 text-xs font-semibold rounded-lg transition-colors z-10 flex-1 md:flex-initial whitespace-nowrap ${
            activeTab === 'schema'
              ? 'text-white'
              : 'text-content-muted hover:text-content hover:bg-tertiary/20'
          }`}
        >
          {activeTab === 'schema' && (
            <motion.div
              layoutId="activeWorkspaceTabPill"
              className="absolute inset-0 bg-accent rounded-lg shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <Columns size={12} className="relative z-10 flex-shrink-0" />
          <span className="relative z-10">Schema</span>
          <span className={`relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors flex-shrink-0 ${
            activeTab === 'schema' ? 'bg-white/20 text-white' : 'bg-secondary text-content-muted'
          }`}>
            {totalColumns}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`relative flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 md:py-1 text-xs font-semibold rounded-lg transition-colors z-10 flex-1 md:flex-initial whitespace-nowrap ${
            activeTab === 'preview'
              ? 'text-white'
              : 'text-content-muted hover:text-content hover:bg-tertiary/20'
          }`}
        >
          {activeTab === 'preview' && (
            <motion.div
              layoutId="activeWorkspaceTabPill"
              className="absolute inset-0 bg-accent rounded-lg shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <Table size={12} className="relative z-10 flex-shrink-0" />
          <span className="relative z-10">Preview</span>
          {previewRowCount > 0 && (
            <span className={`relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors flex-shrink-0 ${
              activeTab === 'preview' ? 'bg-white/20 text-white' : 'bg-secondary text-content-muted'
            }`}>
              {previewRowCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('split')}
          className={`relative flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 md:py-1 text-xs font-semibold rounded-lg transition-colors z-10 flex-1 md:flex-initial whitespace-nowrap ${
            activeTab === 'split'
              ? 'text-white'
              : 'text-content-muted hover:text-content hover:bg-tertiary/20'
          }`}
          title="Split View (Side by Side or Stacked)"
        >
          {activeTab === 'split' && (
            <motion.div
              layoutId="activeWorkspaceTabPill"
              className="absolute inset-0 bg-accent rounded-lg shadow-xs -z-10"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <Split size={12} className="relative z-10 flex-shrink-0" />
          <span className="relative z-10">
            Split<span className="hidden sm:inline"> View</span>
          </span>
        </button>
      </div>

      {/* Right: Streaming Status, Theme Selector & Sidebar Toggle */}
      <div className="flex items-center gap-2 flex-shrink-0 order-2 md:order-none ml-auto md:ml-0">
        {/* Active streaming or batch generation badge */}
        {isStreaming && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold animate-pulse">
            <Radio size={12} />
            <span className="hidden sm:inline">Streaming Live</span>
          </div>
        )}
        {isGeneratingBatch && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold">
            <RefreshCw size={12} className="animate-spin" />
            <span className="hidden sm:inline">Synthesizing</span>
          </div>
        )}

        {/* Theme Dropdown */}
        <div className="relative" ref={themeDropdownRef}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all shadow-xs ${
              isThemeOpen
                ? 'bg-tertiary border-accent text-content ring-1 ring-accent/30'
                : 'bg-primary hover:bg-tertiary border-border-subtle text-content'
            }`}
            title={`Current Theme: ${currentThemeMeta.label} (${currentThemeMeta.isLight ? 'Light' : 'Dark'})`}
            aria-label="Theme menu"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentThemeMeta.isLight ? 'sun' : 'moon'}
                initial={{ rotate: -45, scale: 0.7, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 45, scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center flex-shrink-0"
              >
                {currentThemeMeta.isLight ? (
                  <Sun size={12} className="text-amber-500" />
                ) : (
                  <Moon size={12} className="text-accent" />
                )}
              </motion.div>
            </AnimatePresence>
            <motion.span
              key={currentThemeMeta.accent}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-xs flex-shrink-0"
              style={{ backgroundColor: currentThemeMeta.accent }}
            />
            <span className="hidden sm:inline font-semibold text-[11px] max-w-[85px] truncate">
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
                className="absolute right-0 top-full mt-1.5 w-64 bg-secondary border border-border-subtle rounded-xl shadow-2xl z-50 flex flex-col p-2 backdrop-blur-md max-h-[80vh] overflow-y-auto"
              >
                {/* Light Themes Section */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5 border-b border-border-subtle/50 mb-1">
                  <Sun size={11} className="text-amber-500" />
                  <span>Light Themes (6)</span>
                </div>
                <div className="space-y-0.5 mb-2">
                  {THEME_OPTIONS.filter((t) => t.isLight).map((t) => {
                    const isActive = theme === t.id;
                    return (
                      <motion.button
                        key={t.id}
                        type="button"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTheme(t.id);
                          setIsThemeOpen(false);
                        }}
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
                              style={{ backgroundColor: t.bg }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
                              style={{ backgroundColor: t.card }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
                              style={{ backgroundColor: t.accent }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs leading-tight truncate">{t.label}</div>
                            {t.description && (
                              <div className={`text-[10px] leading-tight truncate ${isActive ? 'text-white/80' : 'text-content-muted'}`}>
                                {t.description}
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
                  <span>Dark Themes (4)</span>
                </div>
                <div className="space-y-0.5">
                  {THEME_OPTIONS.filter((t) => !t.isLight).map((t) => {
                    const isActive = theme === t.id;
                    return (
                      <motion.button
                        key={t.id}
                        type="button"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTheme(t.id);
                          setIsThemeOpen(false);
                        }}
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
                              style={{ backgroundColor: t.bg }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: t.card }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: t.accent }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs leading-tight truncate">{t.label}</div>
                            {t.description && (
                              <div className={`text-[10px] leading-tight truncate ${isActive ? 'text-white/80' : 'text-content-muted'}`}>
                                {t.description}
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

        {/* Sidebar Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shadow-xs ${
            isSidebarOpen
              ? 'bg-accent text-white border-accent'
              : 'bg-primary hover:bg-tertiary border-border-subtle text-content'
          }`}
          title={isSidebarOpen ? 'Hide Generation Deck' : 'Show Generation Deck'}
        >
          <Sliders size={13} />
          <span className="hidden sm:inline">Deck</span>
        </button>
      </div>
    </header>
  );
};
