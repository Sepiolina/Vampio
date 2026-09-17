import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onFocus?: () => void;
}

export const TokenInput: React.FC<Props> = ({ value, onChange, placeholder, onFocus }) => {
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
      className="flex items-center flex-wrap gap-1.5 px-2 py-1 min-h-[30px] bg-primary border border-border-subtle rounded-md text-xs cursor-text transition-colors focus-within:border-accent w-64 sm:w-80 lg:w-96"
      onClick={() => inputRef.current?.focus()}
    >
      <Search size={11} className="text-content-muted ml-0.5" />
      
      {tokens.map((token, i) => (
        <span 
          key={i} 
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isLogic(token) ? 'bg-accent/20 text-accent font-bold' : 'bg-secondary text-content-muted'}`}
        >
          {token}
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); removeToken(i); }}
            className="hover:text-content text-content-muted/70"
          >
            <X size={10} />
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
        className="flex-1 min-w-[60px] bg-transparent outline-none text-content font-mono"
      />
      
      {value && (
        <button 
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="text-content-muted hover:text-content ml-auto mr-1"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
};
