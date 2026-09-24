import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Columns, 
  Code, 
  SlidersHorizontal, 
  Tag, 
  GitFork, 
  Sparkles,
  CornerDownLeft
} from 'lucide-react';
import { useI18n } from '../i18n';

export type SuggestionCategory = 'Column' | 'Type' | 'Property' | 'Value' | 'Logic';

export interface SuggestionItem {
  id: string;
  label: string;
  value: string;
  category: SuggestionCategory;
  detail?: string;
  badge?: string;
  appendSpace?: boolean; // false for 'col:', true for full tokens
}

interface Props {
  isOpen: boolean;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  onSelect: (item: SuggestionItem) => void;
  onHoverIndex: (index: number) => void;
  query: string;
  title?: string;
}

export const FilterSuggestionPopover: React.FC<Props> = ({
  isOpen,
  suggestions,
  selectedIndex,
  onSelect,
  onHoverIndex,
  query,
  title
}) => {
  const { t } = useI18n();
  const displayTitle = title || t('schema.searchIntelliSense');
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll the selected item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const renderCategoryIcon = (category: SuggestionCategory) => {
    switch (category) {
      case 'Column':
        return <Columns size={12} className="text-sky-400 flex-shrink-0" />;
      case 'Type':
        return <Code size={12} className="text-amber-400 flex-shrink-0" />;
      case 'Property':
        return <SlidersHorizontal size={12} className="text-emerald-400 flex-shrink-0" />;
      case 'Value':
        return <Tag size={12} className="text-purple-400 flex-shrink-0" />;
      case 'Logic':
        return <GitFork size={12} className="text-rose-400 flex-shrink-0" />;
      default:
        return <Sparkles size={12} className="text-accent flex-shrink-0" />;
    }
  };

  const getCategoryBadgeClass = (category: SuggestionCategory) => {
    switch (category) {
      case 'Column':
        return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case 'Type':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Property':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Value':
        return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Logic':
        return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      default:
        return 'text-accent bg-accent/10 border-accent/20';
    }
  };

  const highlightMatch = (text: string, rawQuery: string) => {
    if (!rawQuery) return text;
    // Extract search query segment after colon if query has colon
    const searchPart = rawQuery.includes(':') ? rawQuery.split(':').pop() || rawQuery : rawQuery;
    if (!searchPart) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = searchPart.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="text-accent font-bold underline decoration-accent/60 decoration-1 underline-offset-2">
          {text.substring(index, index + searchPart.length)}
        </span>
        {text.substring(index + searchPart.length)}
      </>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="absolute top-full right-0 mt-1.5 w-72 sm:w-84 max-w-[calc(100vw-24px)] bg-primary border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col font-sans select-none"
      >
        {/* Header Bar */}
        <div className="px-3 py-1.5 border-b border-border-subtle bg-secondary/70 flex items-center justify-between text-[10px] font-semibold text-content-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="uppercase tracking-wider font-bold">{displayTitle}</span>
          </div>
          <span className="font-mono text-[9px] bg-tertiary px-1.5 py-0.5 rounded border border-border-subtle/60">
            {t('schema.searchOptionsCount', { count: suggestions.length })}
          </span>
        </div>

        {/* Suggestion Items List */}
        <div ref={listRef} className="overflow-y-auto max-h-56 p-1 scrollbar-none divide-y divide-border-subtle/20">
          {suggestions.length === 0 ? (
            <div className="py-4 px-3 text-center text-xs text-content-muted">
              {t('schema.searchNoMatches')}
            </div>
          ) : (
            suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  ref={isSelected ? activeItemRef : null}
                  type="button"
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => onHoverIndex(idx)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                    isSelected 
                      ? 'bg-accent/15 text-content shadow-2xs ring-1 ring-accent/30' 
                      : 'text-content-muted hover:bg-secondary hover:text-content'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {renderCategoryIcon(item.category)}
                    
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-mono truncate ${isSelected ? 'text-content font-bold' : 'text-content'}`}>
                          {highlightMatch(item.label, query)}
                        </span>
                        
                        <span className={`text-[9px] px-1 py-0.2 rounded border font-mono uppercase tracking-wider flex-shrink-0 ${getCategoryBadgeClass(item.category)}`}>
                          {item.badge || item.category}
                        </span>
                      </div>

                      {item.detail && (
                        <span className="text-[10px] text-content-muted truncate mt-0.5">
                          {item.detail}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] font-mono text-content-muted opacity-60 group-hover:opacity-100 transition-opacity">
                      {item.value}
                    </span>
                    {isSelected && (
                      <CornerDownLeft size={10} className="text-accent flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* IDE-style Keyboard Shortcuts Footer */}
        <div className="px-3 py-1.5 border-t border-border-subtle bg-secondary/50 text-[10px] text-content-muted flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span><kbd className="px-1 py-0.5 rounded bg-tertiary border border-border-subtle text-[9px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-tertiary border border-border-subtle text-[9px]">↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-tertiary border border-border-subtle text-[9px]">↵</kbd> / <kbd className="px-1 py-0.5 rounded bg-tertiary border border-border-subtle text-[9px]">Tab</kbd> select</span>
          </div>
          <span><kbd className="px-1 py-0.5 rounded bg-tertiary border border-border-subtle text-[9px]">esc</kbd></span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
