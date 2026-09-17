import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { ColumnSpec } from '../types';
import { TokenInput } from './TokenInput';

interface Props {
  value: string;
  onChange: (val: string) => void;
  columns: ColumnSpec[];
}

export const DataSearch: React.FC<Props> = ({ value, onChange, columns }) => {
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
    // Determine prefix (all tokens before the last word)
    const parts = value.split(' ');
    parts.pop(); // remove current typing
    
    // If the option ends with ':', don't add a space after it so user can type value
    const appendSpace = !optionValue.endsWith(':');
    
    const prefix = parts.length > 0 ? parts.join(' ') + ' ' : '';
    const newValue = prefix + optionValue + (appendSpace ? ' ' : '');
    onChange(newValue);
    
    if (appendSpace) {
      setIsOpen(false);
    } else {
      const input = containerRef.current?.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  };

  const lastWord = value.split(' ').pop()?.toLowerCase() || '';
  const isTypingColumnFilter = lastWord.includes(':');

  // Build dynamic options
  let options: { label: string; value: string; category: string }[] = [];

  if (isTypingColumnFilter) {
    const [colName, valQuery] = lastWord.split(':');
    const matchedCol = columns.find(c => c.name.toLowerCase() === colName);
    
    if (matchedCol) {
      if (valQuery) {
        options.push({ label: `equals "${valQuery}"`, value: `${matchedCol.name.toLowerCase()}:${valQuery}`, category: 'Value' });
      }
      options.push({ label: `is null`, value: `${matchedCol.name.toLowerCase()}:null`, category: 'Value' });
      options.push({ label: `is not null`, value: `${matchedCol.name.toLowerCase()}:!null`, category: 'Value' });
      
      if (matchedCol.type === 'Boolean') {
        options.push({ label: `is true`, value: `${matchedCol.name.toLowerCase()}:true`, category: 'Value' });
        options.push({ label: `is false`, value: `${matchedCol.name.toLowerCase()}:false`, category: 'Value' });
      }
    }
  } else {
    options = columns.map(c => ({
      label: `Filter by ${c.name}`,
      value: `${c.name.toLowerCase()}:`,
      category: 'Columns'
    }));
    options.push(
      { label: 'AND Operator', value: 'AND', category: 'Logic' },
      { label: 'OR Operator', value: 'OR', category: 'Logic' }
    );
  }

  const filteredOptions = lastWord && !isTypingColumnFilter
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(lastWord) || 
        opt.value.toLowerCase().includes(lastWord)
      )
    : options;

  return (
    <div className="relative" ref={containerRef}>
      <TokenInput 
        value={value}
        onChange={(val) => {
          onChange(val);
          setIsOpen(true);
        }}
        placeholder="Filter data... (e.g. col:val OR col2:val)"
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-primary border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col">
          <div className="px-3 py-2 border-b border-border-subtle bg-secondary/50 text-[10px] font-bold text-content-muted uppercase tracking-wider">
            Filters & Suggestions
          </div>
          <div className="overflow-y-auto p-1">
            {['Columns', 'Value', 'Logic'].map(category => {
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
          </div>
        </div>
      )}
    </div>
  );
};

