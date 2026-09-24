import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => boolean | void;
  compact?: boolean;
  className?: string;
}

export const TokenInput: React.FC<Props> = ({ value, onChange, placeholder, onFocus, onKeyDown, compact = false, className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Split value into tokens, but preserve the trailing text as the "current input"
  const parts = value.split(' ');
  const tokens = parts.slice(0, -1).filter(Boolean);
  const currentText = parts[parts.length - 1];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    const prefix = tokens.length > 0 ? tokens.join(' ') + ' ' : '';
    onChange(prefix + newText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown && onKeyDown(e)) {
      return;
    }

    if (e.key === 'Backspace' && currentText === '' && tokens.length > 0) {
      e.preventDefault();
      const newTokens = [...tokens];
      newTokens.pop();
      onChange(newTokens.join(' ') + (newTokens.length > 0 ? ' ' : ''));
    } else if (e.key === 'Enter' && currentText.trim()) {
      e.preventDefault();
      onChange(value + ' ');
    }
  };

  const removeToken = (idx: number) => {
    const newTokens = [...tokens];
    newTokens.splice(idx, 1);
    const prefix = newTokens.length > 0 ? newTokens.join(' ') + ' ' : '';
    onChange(prefix + currentText);
    inputRef.current?.focus();
  };
  
  const isLogic = (t: string) => ['AND', 'OR', '&&', '||'].includes(t.toUpperCase());

  return (
    <div 
      className={`flex items-center gap-1.5 px-2 bg-primary border border-border-subtle rounded-md cursor-text transition-colors focus-within:border-accent w-full flex-1 min-w-0 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden ${
        compact 
          ? 'py-0 min-h-[24px] h-6 text-[10px] max-w-[130px] sm:max-w-[160px] lg:max-w-[200px]' 
          : 'py-0.5 min-h-[28px] h-7 text-[11px] max-w-[140px] sm:max-w-[180px] lg:max-w-[220px]'
      } ${className}`}
      onClick={() => {
        inputRef.current?.focus();
        onFocus?.();
      }}
    >
      <Search size={compact ? 10 : 11} className="text-content-muted ml-0.5 flex-shrink-0" />
      
      {tokens.map((token, i) => (
        <span 
          key={i} 
          className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] flex-shrink-0 whitespace-nowrap ${isLogic(token) ? 'bg-accent/20 text-accent font-bold' : 'bg-secondary text-content-muted'}`}
        >
          {token}
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); removeToken(i); }}
            className="hover:text-content text-content-muted/70 cursor-pointer"
          >
            <X size={9} />
          </button>
        </span>
      ))}
      
      <input
        ref={inputRef}
        type="text"
        placeholder={tokens.length === 0 ? placeholder : ''}
        value={currentText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        className={`flex-1 min-w-[28px] bg-transparent outline-none text-content font-mono ${compact ? 'text-[10px]' : 'text-[11px]'}`}
      />
      
      {value && (
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="text-content-muted hover:text-content ml-auto mr-0.5 flex-shrink-0 cursor-pointer"
          title="Clear"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
};
