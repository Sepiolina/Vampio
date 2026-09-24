import React, { useRef, useEffect, useState, useMemo } from 'react';

interface HighlightedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'javascript' | 'lua';
  placeholder?: string;
  minHeight?: string;
  rows?: number;
}

export const HighlightedCodeEditor: React.FC<HighlightedCodeEditorProps> = ({
  value,
  onChange,
  language,
  placeholder,
  minHeight = '240px',
  rows = 10,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState(1);

  // High-fidelity syntax highlighter for JS and Lua
  const highlightedCode = useMemo(() => {
    return highlightCode(value || '', language);
  }, [value, language]);

  // Compute line count for gutter
  const lineCount = useMemo(() => {
    const lines = (value || '').split('\n').length;
    return Math.max(lines, rows);
  }, [value, rows]);

  // Synchronize scrolling between textarea, highlighted <pre>, and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = target.scrollTop;
      preRef.current.scrollLeft = target.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop;
    }
  };

  // Track active line
  const updateActiveLine = (target: HTMLTextAreaElement) => {
    const cursorPos = target.selectionStart || 0;
    const textBeforeCursor = target.value.substring(0, cursorPos);
    const lineIndex = textBeforeCursor.split('\n').length;
    setActiveLine(lineIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;

    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          updateActiveLine(textareaRef.current);
        }
      });
      return;
    }

    // Enter key auto-indents to match previous line
    if (e.key === 'Enter') {
      const start = target.selectionStart;
      const val = target.value;
      const currentLineText = val.substring(0, start).split('\n').pop() || '';
      const indentMatch = currentLineText.match(/^([ \t]+)/);
      if (indentMatch) {
        e.preventDefault();
        const indent = indentMatch[1];
        const end = target.selectionEnd;
        const newVal = val.substring(0, start) + '\n' + indent + val.substring(end);
        onChange(newVal);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const nextPos = start + 1 + indent.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = nextPos;
            updateActiveLine(textareaRef.current);
          }
        });
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      updateActiveLine(textareaRef.current);
    }
  }, [value]);

  const sharedStyle: React.CSSProperties = {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '22px',
    tabSize: 2,
    letterSpacing: '0px',
    boxSizing: 'border-box',
    margin: 0,
    padding: '12px',
    whiteSpace: 'pre',
    wordBreak: 'normal',
    wordWrap: 'normal',
  };

  return (
    <div className="relative flex rounded-xl border border-border-subtle bg-secondary font-mono text-xs overflow-hidden focus-within:border-accent transition-colors shadow-inner">
      {/* Line Numbers Gutter */}
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="w-11 select-none py-3 pr-2.5 pl-2 text-right font-mono text-[11px] leading-[22px] text-content-muted/50 bg-primary/60 border-r border-border-subtle/80 overflow-hidden shrink-0 pointer-events-none"
      >
        {Array.from({ length: lineCount }).map((_, i) => {
          const lineNum = i + 1;
          const isCurrent = lineNum === activeLine;
          return (
            <div
              key={lineNum}
              className={`h-[22px] transition-colors ${
                isCurrent ? 'text-accent font-bold' : ''
              }`}
            >
              {lineNum}
            </div>
          );
        })}
      </div>

      {/* Code Container with Overlayed Pre (Syntax Highlight) and Textarea (Input) */}
      <div className="relative flex-1 min-w-0" style={{ minHeight }}>
        {/* Highlighted Render Layer */}
        <pre
          ref={preRef}
          aria-hidden="true"
          className="code-syntax-highlight pointer-events-none absolute inset-0 overflow-hidden bg-transparent text-content select-none"
          style={sharedStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedCode + (value.endsWith('\n') ? ' ' : ''),
          }}
        />

        {/* Interactive Textarea Layer */}
        <textarea
          ref={textareaRef}
          rows={rows}
          required
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateActiveLine(e.target);
          }}
          onSelect={(e) => updateActiveLine(e.currentTarget)}
          onClick={(e) => updateActiveLine(e.currentTarget)}
          onKeyUp={(e) => updateActiveLine(e.currentTarget)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="relative z-10 block w-full h-full bg-transparent text-transparent caret-accent focus:outline-none resize-y selection:bg-accent/30 selection:text-transparent overflow-auto"
          style={{ ...sharedStyle, minHeight }}
        />
      </div>
    </div>
  );
};

/**
 * Universal, robust syntax highlighter for JavaScript and Lua.
 * Does not depend on external CDN scripts and guarantees clean, vibrant tokenization.
 */
function highlightCode(code: string, language: 'javascript' | 'lua'): string {
  if (!code) return '';

  // Token definition regexes
  const jsKeywords = new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'try', 'catch',
    'finally', 'throw', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of',
    'async', 'await', 'yield', 'class', 'extends', 'super', 'import', 'export',
    'from', 'as', 'null', 'undefined', 'true', 'false', 'NaN', 'Infinity'
  ]);

  const luaKeywords = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
    'true', 'until', 'while'
  ]);

  const jsBuiltins = new Set([
    'ctx', 'row', 'index', 'random', 'utils', 'Math', 'Date', 'String', 'Number',
    'Array', 'Object', 'JSON', 'console', 'RegExp', 'Boolean', 'parseInt', 'parseFloat'
  ]);

  const luaBuiltins = new Set([
    'ctx', 'row', 'index', 'random', 'utils', 'math', 'string', 'table', 'io', 'os',
    'ipairs', 'pairs', 'tostring', 'tonumber', 'type', 'print', 'select', 'pcall'
  ]);

  const keywords = language === 'lua' ? luaKeywords : jsKeywords;
  const builtins = language === 'lua' ? luaBuiltins : jsBuiltins;

  // Regex pattern matching strings, comments, numbers, identifiers, operators, punctuation
  const tokenRegex = language === 'lua'
    ? /(--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[a-zA-Z_]\w*|==|~=|<=|>=|\.\.|[+\-*/%^#=<>~]|\S)/g
    : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[a-zA-Z_$][\w$]*|===|!==|==|!=|<=|>=|=>|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||[+\-*/%^!=<>?:&|~]|\S)/g;

  let lastIndex = 0;
  let html = '';
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    // Append any text before the match (spaces, newlines, etc.)
    if (match.index > lastIndex) {
      html += escapeHtml(code.slice(lastIndex, match.index));
    }

    const token = match[0];
    lastIndex = match.index + token.length;

    // 1. Comments
    if (token.startsWith('//') || token.startsWith('/*') || token.startsWith('--')) {
      html += `<span class="token comment">${escapeHtml(token)}</span>`;
      continue;
    }

    // 2. Strings
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      html += `<span class="token string">${escapeHtml(token)}</span>`;
      continue;
    }

    // 3. Numbers
    if (/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(token)) {
      html += `<span class="token number">${escapeHtml(token)}</span>`;
      continue;
    }

    // 4. Keywords
    if (keywords.has(token)) {
      html += `<span class="token keyword">${escapeHtml(token)}</span>`;
      continue;
    }

    // 5. Builtins (ctx, random, utils, math, etc.)
    if (builtins.has(token)) {
      html += `<span class="token builtin">${escapeHtml(token)}</span>`;
      continue;
    }

    // 6. Function calls (followed by `(` in remainder of code)
    if (/^[a-zA-Z_$][\w$]*$/.test(token)) {
      const remaining = code.slice(lastIndex).trimStart();
      if (remaining.startsWith('(')) {
        html += `<span class="token function">${escapeHtml(token)}</span>`;
        continue;
      }
      // General identifier / property
      html += `<span class="token identifier">${escapeHtml(token)}</span>`;
      continue;
    }

    // 7. Operators
    if (/^(?:===|!==|==|!=|<=|>=|=>|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||[+\-*/%^!=<>?:&|~#]|\.\.)$/.test(token)) {
      html += `<span class="token operator">${escapeHtml(token)}</span>`;
      continue;
    }

    // 8. Punctuation / everything else
    html += `<span class="token punctuation">${escapeHtml(token)}</span>`;
  }

  if (lastIndex < code.length) {
    html += escapeHtml(code.slice(lastIndex));
  }

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
