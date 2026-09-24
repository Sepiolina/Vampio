import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ColumnSpec } from '../types';
import { TokenInput } from './TokenInput';
import { FilterSuggestionPopover, SuggestionItem } from './FilterSuggestionPopover';

interface Props {
  value: string;
  onChange: (val: string) => void;
  columns: ColumnSpec[];
  data?: Record<string, unknown>[];
  compact?: boolean;
}

export const DataSearch: React.FC<Props> = ({ 
  value, 
  onChange, 
  columns, 
  data = [], 
  compact = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parts = value.split(' ');
  const lastWord = parts[parts.length - 1] || '';
  const trimmedTokens = parts.filter(Boolean);
  const hasExistingTokens = trimmedTokens.length > (lastWord ? 1 : 0);

  // Dynamic Suggestion Engine
  const suggestions: SuggestionItem[] = useMemo(() => {
    const query = lastWord.trim();
    const hasColon = query.includes(':');

    const items: SuggestionItem[] = [];

    // Case 1: Typing column value filter: colName:valueQuery
    if (hasColon) {
      const colonIdx = query.indexOf(':');
      const colName = query.substring(0, colonIdx).toLowerCase();
      const valQuery = query.substring(colonIdx + 1).toLowerCase();

      const matchedCol = columns.find(c => c.name.toLowerCase() === colName);

      if (matchedCol) {
        // 1. Dynamic Unique Sample Values from actual data
        if (data.length > 0) {
          const valueCounts = new Map<string, number>();
          data.forEach(row => {
            const rawVal = row[matchedCol.name];
            if (rawVal !== null && rawVal !== undefined) {
              const strVal = String(rawVal).trim();
              if (strVal) {
                valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);
              }
            }
          });

          // Sort by frequency
          const sortedValues = Array.from(valueCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([val, count]) => ({ val, count }));

          const matchedValues = valQuery
            ? sortedValues.filter(item => item.val.toLowerCase().includes(valQuery))
            : sortedValues;

          matchedValues.slice(0, 6).forEach(({ val, count }) => {
            items.push({
              id: `val-${matchedCol.name}-${val}`,
              label: `"${val}"`,
              value: `${matchedCol.name.toLowerCase()}:${val.includes(' ') ? `"${val}"` : val}`,
              category: 'Value',
              detail: `${count} matching ${count === 1 ? 'record' : 'records'} in preview`,
              badge: 'Value',
              appendSpace: true,
            });
          });
        }

        // 2. Custom value filter if user typed something specific not in sample
        if (valQuery && !items.some(it => it.value.toLowerCase().endsWith(`:${valQuery}`))) {
          items.push({
            id: `custom-val-${valQuery}`,
            label: `equals "${valQuery}"`,
            value: `${matchedCol.name.toLowerCase()}:${valQuery}`,
            category: 'Value',
            detail: `Filter rows where ${matchedCol.name} contains "${valQuery}"`,
            badge: 'Match',
            appendSpace: true,
          });

          // Negation filter
          items.push({
            id: `negate-val-${valQuery}`,
            label: `not "${valQuery}"`,
            value: `${matchedCol.name.toLowerCase()}:!${valQuery}`,
            category: 'Value',
            detail: `Exclude rows containing "${valQuery}"`,
            badge: 'Negate',
            appendSpace: true,
          });
        }

        // 3. Null checks
        if (!valQuery || 'null'.includes(valQuery)) {
          items.push({
            id: `null-${matchedCol.name}`,
            label: 'is null',
            value: `${matchedCol.name.toLowerCase()}:null`,
            category: 'Value',
            detail: `Rows where ${matchedCol.name} is empty or null`,
            badge: 'Null',
            appendSpace: true,
          });
        }

        if (!valQuery || '!null'.includes(valQuery)) {
          items.push({
            id: `not-null-${matchedCol.name}`,
            label: 'is not null',
            value: `${matchedCol.name.toLowerCase()}:!null`,
            category: 'Value',
            detail: `Rows where ${matchedCol.name} has a valid value`,
            badge: 'Not Null',
            appendSpace: true,
          });
        }

        // 4. Boolean checks
        if (matchedCol.type === 'Boolean') {
          items.push(
            {
              id: `bool-true-${matchedCol.name}`,
              label: 'is true',
              value: `${matchedCol.name.toLowerCase()}:true`,
              category: 'Value',
              detail: `${matchedCol.name} === true`,
              badge: 'Boolean',
              appendSpace: true,
            },
            {
              id: `bool-false-${matchedCol.name}`,
              label: 'is false',
              value: `${matchedCol.name.toLowerCase()}:false`,
              category: 'Value',
              detail: `${matchedCol.name} === false`,
              badge: 'Boolean',
              appendSpace: true,
            }
          );
        }

        return items;
      }
    }

    // Case 2: No colon typed yet (suggesting column filters or logic operators)
    const lowerQuery = query.toLowerCase();

    // 1. Column selectors
    columns.forEach(c => {
      const colPrefix = `${c.name.toLowerCase()}:`;
      if (!lowerQuery || c.name.toLowerCase().includes(lowerQuery) || colPrefix.includes(lowerQuery)) {
        items.push({
          id: `col-${c.name}`,
          label: c.name,
          value: colPrefix,
          category: 'Column',
          detail: `Filter data by ${c.type} column`,
          badge: c.type,
          appendSpace: false, // Keep cursor ready for value
        });
      }
    });

    // 2. Logic Operators if user already has prior conditions
    if (hasExistingTokens) {
      if (!lowerQuery || 'and'.includes(lowerQuery)) {
        items.unshift({
          id: 'logic-and',
          label: 'AND',
          value: 'AND',
          category: 'Logic',
          detail: 'Both conditions must match',
          badge: 'Operator',
          appendSpace: true,
        });
      }

      if (!lowerQuery || 'or'.includes(lowerQuery)) {
        items.unshift({
          id: 'logic-or',
          label: 'OR',
          value: 'OR',
          category: 'Logic',
          detail: 'Either condition can match',
          badge: 'Operator',
          appendSpace: true,
        });
      }
    }

    return items;
  }, [lastWord, columns, data, hasExistingTokens]);

  // Reset index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions.length, lastWord]);

  const handleApply = (item: SuggestionItem) => {
    const currentParts = value.split(' ');
    currentParts.pop();
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
        placeholder={compact ? "Filter data..." : "Filter data... (e.g. col:val)"}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        compact={compact}
      />

      <FilterSuggestionPopover
        isOpen={isOpen}
        suggestions={suggestions}
        selectedIndex={selectedIndex}
        onSelect={handleApply}
        onHoverIndex={setSelectedIndex}
        query={lastWord}
        title="Data Filters"
      />
    </div>
  );
};
