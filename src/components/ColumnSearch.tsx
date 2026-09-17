import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { ColumnType } from '../types';
import { TokenInput } from './TokenInput';

interface FilterOption {
  label: string;
  value: string;
  category: 'Type' | 'Property' | 'Column' | 'Logic';
}

const FILTER_OPTIONS: FilterOption[] = [
  { label: 'String', value: 'type:string', category: 'Type' },
  { label: 'Int', value: 'type:int', category: 'Type' },
  { label: 'Float', value: 'type:float', category: 'Type' },
  { label: 'Boolean', value: 'type:boolean', category: 'Type' },
  { label: 'UUID', value: 'type:uuid', category: 'Type' },
  { label: 'DateTime', value: 'type:datetime', category: 'Type' },
  { label: 'Set/Enum', value: 'type:set/enum', category: 'Type' },
  { label: 'Entity', value: 'type:entity', category: 'Type' },
  { label: 'Has Nulls (> 0%)', value: 'has:nulls', category: 'Property' },
  { label: 'Has Condition', value: 'has:condition', category: 'Property' },
  { label: 'Has Dependencies', value: 'has:dependencies', category: 'Property' },
  { label: 'AND Operator', value: 'AND', category: 'Logic' },
  { label: 'OR Operator', value: 'OR', category: 'Logic' },
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  columnNames: string[];
}

export const ColumnSearch: React.FC<Props> = ({ value, onChange, columnNames }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    // If it's a specific filter, append it or replace
    const parts = value.split(' ');
    parts.pop(); // remove current typing text
    const prefix = parts.length > 0 ? parts.join(' ') + ' ' : '';
    onChange(prefix + optionValue + ' ');
    setIsOpen(false);
  };

  const dynamicOptions = [
    ...FILTER_OPTIONS,
    ...columnNames.map(name => ({ label: name, value: `col:${name.toLowerCase()}`, category: 'Column' as const }))
  ];

  const lastWord = value.split(' ').pop()?.toLowerCase() || '';
  
  const filteredOptions = lastWord 
    ? dynamicOptions.filter(opt => 
        opt.label.toLowerCase().includes(lastWord) || 
        opt.value.toLowerCase().includes(lastWord)
      )
    : dynamicOptions;

  return (
    <div className="relative" ref={containerRef}>
      <TokenInput 
        value={value}
        onChange={(val) => {
          onChange(val);
          setIsOpen(true);
        }}
        placeholder="Filter columns... (e.g. type:String)"
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-primary border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col">
          <div className="px-3 py-2 border-b border-border-subtle bg-secondary/50 text-[10px] font-bold text-content-muted uppercase tracking-wider">
            Filters & Suggestions
          </div>
          <div className="overflow-y-auto p-1">
            {['Type', 'Property', 'Column', 'Logic'].map(category => {
              const categoryOptions = filteredOptions.filter(o => o.category === category);
              if (categoryOptions.length === 0) return null;
              
              return (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[10px] text-content-muted font-semibold">{category}</div>
                  {categoryOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className="w-full text-left px-2 py-1.5 text-xs text-content hover:bg-secondary rounded flex items-center justify-between group"
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] text-content-muted opacity-0 group-hover:opacity-100 font-mono">{opt.value}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="p-3 text-xs text-content-muted text-center italic">
                No filters found matching text
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
