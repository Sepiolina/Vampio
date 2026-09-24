import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ColumnSpec, ColumnType } from '../types';
import { TokenInput } from './TokenInput';
import { FilterSuggestionPopover, SuggestionItem } from './FilterSuggestionPopover';
import { useI18n } from '../i18n';

interface Props {
  value: string;
  onChange: (val: string) => void;
  columns?: ColumnSpec[];
  columnNames?: string[];
  compact?: boolean;
}

export const ColumnSearch: React.FC<Props> = ({ 
  value, 
  onChange, 
  columns = [], 
  columnNames = [], 
  compact = false 
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ALL_TYPES = useMemo(() => [
    { type: 'String', detail: t('schema.typeDescString') },
    { type: 'Int', detail: t('schema.typeDescInt') },
    { type: 'Float', detail: t('schema.typeDescFloat') },
    { type: 'Boolean', detail: t('schema.typeDescBoolean') },
    { type: 'DateTime', detail: t('schema.typeDescDateTime') },
    { type: 'UUID', detail: t('schema.typeDescUUID') },
    { type: 'Set/Enum', detail: t('schema.typeDescSetEnum') },
    { type: 'Entity', detail: t('schema.typeDescEntity') },
    { type: 'Calculation', detail: t('schema.typeDescCalculation') },
    { type: 'Sequence', detail: t('schema.typeDescSequence') },
    { type: 'Pattern', detail: t('schema.typeDescPattern') },
  ], [t]);

  const ALL_PROPERTIES = useMemo(() => [
    { prop: 'has:nulls', label: 'has:nulls', detail: t('schema.hasNullsDesc') },
    { prop: 'has:condition', label: 'has:condition', detail: t('schema.hasConditionDesc') },
    { prop: 'has:dependencies', label: 'has:dependencies', detail: t('schema.hasDependenciesDesc') },
  ], [t]);

  // Derive column list
  const effectiveColumns = useMemo(() => {
    if (columns.length > 0) return columns;
    return columnNames.map(name => ({ name, type: 'String' as ColumnType }));
  }, [columns, columnNames]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute active typing context
  const parts = value.split(' ');
  const lastWord = parts[parts.length - 1] || '';
  const trimmedTokens = parts.filter(Boolean);
  const hasExistingTokens = trimmedTokens.length > (lastWord ? 1 : 0);

  // Dynamic Suggestion Generator
  const suggestions: SuggestionItem[] = useMemo(() => {
    const query = lastWord.toLowerCase().trim();
    const isPrefixed = query.includes(':');
    const [prefix, subQuery = ''] = isPrefixed ? query.split(':') : ['', ''];

    const items: SuggestionItem[] = [];

    // Case 1: Typing 'col:' prefix specifically
    if (prefix === 'col') {
      effectiveColumns.forEach(c => {
        if (!subQuery || c.name.toLowerCase().includes(subQuery)) {
          items.push({
            id: `col-${c.name}`,
            label: c.name,
            value: `col:${c.name.toLowerCase()}`,
            category: 'Column',
            detail: t('schema.columnFieldDesc', { type: c.type }),
            badge: c.type,
            appendSpace: true,
          });
        }
      });
      return items;
    }

    // Case 2: Typing 'type:' prefix specifically
    if (prefix === 'type') {
      ALL_TYPES.forEach(tItem => {
        if (!subQuery || tItem.type.toLowerCase().includes(subQuery)) {
          items.push({
            id: `type-${tItem.type}`,
            label: tItem.type,
            value: `type:${tItem.type.toLowerCase()}`,
            category: 'Type',
            detail: tItem.detail,
            badge: 'Type',
            appendSpace: true,
          });
        }
      });
      return items;
    }

    // Case 3: Typing 'has:' prefix specifically
    if (prefix === 'has') {
      ALL_PROPERTIES.forEach(p => {
        if (!subQuery || p.prop.toLowerCase().includes(subQuery)) {
          items.push({
            id: p.prop,
            label: p.label,
            value: p.prop,
            category: 'Property',
            detail: p.detail,
            badge: 'Property',
            appendSpace: true,
          });
        }
      });
      return items;
    }

    // Case 4: No colon prefix (or initial state)
    // If empty: show helpful starter suggestions
    if (!query) {
      // Direct Column filters
      effectiveColumns.slice(0, 4).forEach(c => {
        items.push({
          id: `col-${c.name}`,
          label: c.name,
          value: `col:${c.name.toLowerCase()}`,
          category: 'Column',
          detail: t('schema.columnFieldDesc', { type: c.type }),
          badge: c.type,
          appendSpace: true,
        });
      });

      // Types
      ALL_TYPES.slice(0, 3).forEach(tItem => {
        items.push({
          id: `type-${tItem.type}`,
          label: tItem.type,
          value: `type:${tItem.type.toLowerCase()}`,
          category: 'Type',
          detail: tItem.detail,
          badge: 'Type',
          appendSpace: true,
        });
      });

      // Properties
      items.push({
        id: 'has-nulls',
        label: 'has:nulls',
        value: 'has:nulls',
        category: 'Property',
        detail: t('schema.hasNullsDesc'),
        badge: 'Property',
        appendSpace: true,
      });

      // Logic operators if existing tokens are present
      if (hasExistingTokens) {
        items.unshift(
          {
            id: 'logic-and',
            label: 'AND',
            value: 'AND',
            category: 'Logic',
            detail: t('schema.andDesc'),
            badge: t('schema.operatorBadge'),
            appendSpace: true,
          },
          {
            id: 'logic-or',
            label: 'OR',
            value: 'OR',
            category: 'Logic',
            detail: t('schema.orDesc'),
            badge: t('schema.operatorBadge'),
            appendSpace: true,
          }
        );
      }

      return items;
    }

    // Keyword filtering across all categories
    // 1. Column Matches
    effectiveColumns.forEach(c => {
      if (c.name.toLowerCase().includes(query) || `col:${c.name.toLowerCase()}`.includes(query)) {
        items.push({
          id: `col-${c.name}`,
          label: c.name,
          value: `col:${c.name.toLowerCase()}`,
          category: 'Column',
          detail: t('schema.columnFieldDesc', { type: c.type }),
          badge: c.type,
          appendSpace: true,
        });
      }
    });

    // 2. Type Matches
    ALL_TYPES.forEach(tItem => {
      if (tItem.type.toLowerCase().includes(query) || `type:${tItem.type.toLowerCase()}`.includes(query)) {
        items.push({
          id: `type-${tItem.type}`,
          label: tItem.type,
          value: `type:${tItem.type.toLowerCase()}`,
          category: 'Type',
          detail: tItem.detail,
          badge: 'Type',
          appendSpace: true,
        });
      }
    });

    // 3. Property Matches
    ALL_PROPERTIES.forEach(p => {
      if (p.prop.toLowerCase().includes(query) || p.detail.toLowerCase().includes(query)) {
        items.push({
          id: p.prop,
          label: p.label,
          value: p.prop,
          category: 'Property',
          detail: p.detail,
          badge: 'Property',
          appendSpace: true,
        });
      }
    });

    // 4. Logic Operators
    if (query === 'and' || query === 'or') {
      items.unshift({
        id: `logic-${query}`,
        label: query.toUpperCase(),
        value: query.toUpperCase(),
        category: 'Logic',
        detail: query === 'and' ? t('schema.andDesc') : t('schema.orDesc'),
        badge: t('schema.operatorBadge'),
        appendSpace: true,
      });
    }

    return items;
  }, [lastWord, effectiveColumns, hasExistingTokens, t, ALL_TYPES, ALL_PROPERTIES]);

  // Keep selected index in bounds when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions.length, lastWord]);

  const handleApply = (item: SuggestionItem) => {
    const currentParts = value.split(' ');
    currentParts.pop(); // Remove currently typing word
    const prefix = currentParts.length > 0 ? currentParts.join(' ') + ' ' : '';
    const nextValue = prefix + item.value + (item.appendSpace !== false ? ' ' : '');
    onChange(nextValue);

    if (item.appendSpace !== false) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  // IDE Keyboard Handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): boolean | void => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        return true;
      }
      return false;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      return true;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions[selectedIndex]) {
        e.preventDefault();
        handleApply(suggestions[selectedIndex]);
        return true;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return true;
    }

    return false;
  };

  return (
    <div className="relative min-w-0 flex-shrink w-full" ref={containerRef}>
      <TokenInput 
        value={value}
        onChange={(val) => {
          onChange(val);
          setIsOpen(true);
        }}
        placeholder={compact ? t('common.search') : t('schema.searchColumns')}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      <FilterSuggestionPopover
        isOpen={isOpen}
        suggestions={suggestions}
        selectedIndex={selectedIndex}
        onSelect={handleApply}
        onHoverIndex={setSelectedIndex}
        query={lastWord}
        title={t('schema.searchIntelliSense')}
      />
    </div>
  );
};
