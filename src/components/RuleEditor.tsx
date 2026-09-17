import React from 'react';
import { ColumnSpec, EntitySubtype } from '../types';
import { Sparkles, Hash, Calculator, Clock, Code2, Tag, Sliders } from 'lucide-react';

interface Props {
  col: ColumnSpec;
  onChange: (rule: string) => void;
  availableColumns: string[];
}

const ENTITY_SUBTYPES: { id: EntitySubtype; label: string }[] = [
  { id: 'full_name', label: 'Full Name' },
  { id: 'first_name', label: 'First Name' },
  { id: 'last_name', label: 'Last Name' },
  { id: 'email', label: 'Work / Personal Email' },
  { id: 'phone', label: 'Phone Number' },
  { id: 'company', label: 'Company Name' },
  { id: 'job_title', label: 'Job Title' },
  { id: 'country', label: 'Country' },
  { id: 'city', label: 'City' },
  { id: 'ip_address', label: 'IPv4 Address' },
  { id: 'user_agent', label: 'Browser User Agent' },
  { id: 'url', label: 'Web URL' }
];

const REGEX_PRESETS = [
  { label: 'License / Code', pattern: '[A-Z]{3}-\\d{4}' },
  { label: 'Phone', pattern: '\\d{3}-\\d{3}-\\d{4}' },
  { label: 'Hex Hash', pattern: '[a-f0-9]{8}' },
  { label: 'SKU Item', pattern: 'SKU-[A-Z]{2}\\d{4}' }
];

const ENUM_PRESETS = [
  { label: 'HTTP Verbs', value: 'GET:60, POST:25, PUT:10, DELETE:5' },
  { label: 'Status', value: 'Active:75, Pending:15, Suspended:10' },
  { label: 'Priority', value: 'Low:50, Medium:35, High:15' },
  { label: 'Billing Plan', value: 'Free:70, Pro:25, Enterprise:5' }
];

export const RuleEditor: React.FC<Props> = ({ col, onChange, availableColumns }) => {
  switch (col.type) {
    case 'Int': {
      const parts = col.rule.split(',');
      const min = parts[0]?.trim() || '';
      const max = parts[1]?.trim() || '';
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Min</span>
            <input
              type="number"
              value={min}
              placeholder="1"
              onChange={(e) => onChange(`${e.target.value || '0'}, ${max || '100'}`)}
              className="w-14 sm:w-16 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <span className="text-content-muted text-xs">to</span>
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Max</span>
            <input
              type="number"
              value={max}
              placeholder="100"
              onChange={(e) => onChange(`${min || '1'}, ${e.target.value || '100'}`)}
              className="w-14 sm:w-16 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
        </div>
      );
    }

    case 'Float': {
      const parts = col.rule.split(',');
      const min = parts[0]?.trim() || '';
      const max = parts[1]?.trim() || '';
      const dec = parts[2]?.trim() || '2';
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Min</span>
            <input
              type="number"
              step="any"
              value={min}
              placeholder="0.0"
              onChange={(e) => onChange(`${e.target.value || '0'}, ${max || '100'}, ${dec}`)}
              className="w-12 sm:w-14 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <span className="text-content-muted text-xs">to</span>
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Max</span>
            <input
              type="number"
              step="any"
              value={max}
              placeholder="100.0"
              onChange={(e) => onChange(`${min || '0'}, ${e.target.value || '100'}, ${dec}`)}
              className="w-12 sm:w-14 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Dec</span>
            <input
              type="number"
              min="0"
              max="6"
              value={dec}
              placeholder="2"
              onChange={(e) => onChange(`${min || '0'}, ${max || '100'}, ${e.target.value || '2'}`)}
              className="w-8 text-xs bg-transparent text-accent font-mono focus:outline-none"
            />
          </div>
        </div>
      );
    }

    case 'Boolean': {
      const pct = parseFloat(col.rule) || 50;
      return (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={pct}
              onChange={(e) => onChange(e.target.value)}
              className="w-24 sm:w-28 accent-indigo-500 cursor-pointer h-1.5 bg-tertiary rounded-lg"
            />
            <span className="text-xs font-mono text-accent whitespace-nowrap">{pct}% true</span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange('50')}
              className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary hover:bg-tertiary hover:opacity-80 text-content-muted"
            >
              50/50
            </button>
            <button
              type="button"
              onClick={() => onChange('80')}
              className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary hover:bg-tertiary hover:opacity-80 text-content-muted"
            >
              80% True
            </button>
          </div>
        </div>
      );
    }

    case 'Set/Enum': {
      return (
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Options or weights (e.g. GET:60, POST:30, DELETE:10)"
              value={col.rule}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-w-0 px-2.5 py-1.5 text-xs bg-primary border border-border-subtle rounded-md text-content font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-muted">Presets:</span>
            {ENUM_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.value)}
                className="text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content px-1.5 py-0.5 rounded border border-border-subtle transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'Calculation': {
      return (
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="e.g. {Net_Weight} + {Tare_Weight} or {Qty} * {Price} * 1.1"
              value={col.rule}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-w-0 pl-7 pr-2.5 py-1.5 text-xs font-mono bg-primary border border-border-subtle rounded-md text-accent focus:outline-none focus:border-emerald-500"
            />
            <Calculator size={13} className="absolute left-2 top-2.5 text-accent" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-muted">Insert Column:</span>
            {availableColumns.length === 0 ? (
              <span className="text-[10px] text-content-muted italic">No other columns available</span>
            ) : (
              availableColumns.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    const separator = col.rule && !col.rule.endsWith(' ') ? ' ' : '';
                    onChange(`${col.rule}${separator}{${name}}`);
                  }}
                  className="text-[10px] bg-accent/10 hover:bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/20 transition font-mono"
                >
                  +{name}
                </button>
              ))
            )}
            <div className="flex gap-1 flex-wrap">
              {['+', '-', '*', '/', 'Math.round()'].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => {
                    const separator = col.rule && !col.rule.endsWith(' ') ? ' ' : '';
                    onChange(`${col.rule}${separator}${op} `);
                  }}
                  className="text-[10px] bg-tertiary hover:bg-tertiary hover:opacity-80 text-content px-1.5 py-0.5 rounded font-mono"
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'Sequence': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2.5 py-1">
            <Hash size={13} className="text-content-muted mr-1.5" />
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Start From:</span>
            <input
              type="number"
              value={col.rule || '1'}
              placeholder="1"
              onChange={(e) => onChange(e.target.value)}
              className="w-20 text-xs bg-transparent text-accent font-mono focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-content-muted">Auto-increments +1 per row</span>
        </div>
      );
    }

    case 'Blob/Hex': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2.5 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Bytes:</span>
            <input
              type="number"
              min="1"
              max="32"
              value={col.rule || '6'}
              placeholder="6"
              onChange={(e) => onChange(e.target.value)}
              className="w-14 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-content-muted">
            {parseInt(col.rule, 10) === 6 ? 'MAC Address size (6 bytes)' : 'Dash-separated hex stream'}
          </span>
        </div>
      );
    }

    case 'DateTime': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={col.rule || 'YYYY-MM-DD HH:mm:ss'}
            onChange={(e) => onChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-primary border border-border-subtle rounded-md text-content font-mono focus:outline-none focus:border-accent max-w-full"
          >
            <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss (Standard)</option>
            <option value="ISO">ISO 8601 (2026-09-16T12:00:00Z)</option>
            <option value="date">Date Only (YYYY-MM-DD)</option>
            <option value="time">Time Only (HH:mm:ss)</option>
            <option value="timestamp">Unix Timestamp (Epoch seconds)</option>
            <option value="future">Future Dates (Next 30 days)</option>
            <option value="today">Today / Current Time</option>
          </select>
        </div>
      );
    }

    case 'RegEx': {
      return (
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="e.g. [A-Z]{3}-\\d{4}"
              value={col.rule}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-w-0 pl-7 pr-2.5 py-1.5 text-xs font-mono bg-primary border border-border-subtle rounded-md text-accent focus:outline-none focus:border-amber-500"
            />
            <Code2 size={13} className="absolute left-2 top-2.5 text-accent" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-muted">Quick Patterns:</span>
            {REGEX_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.pattern)}
                className="text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content px-1.5 py-0.5 rounded border border-border-subtle transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'Entity': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={col.rule || 'full_name'}
            onChange={(e) => onChange(e.target.value)}
            className="px-2.5 py-1 text-xs bg-primary border border-border-subtle rounded-md text-accent font-medium focus:outline-none focus:border-accent max-w-full"
          >
            {ENTITY_SUBTYPES.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-content-muted">Realistic mock values</span>
        </div>
      );
    }

    case 'String': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">Length:</span>
            <input
              type="number"
              min="1"
              max="128"
              value={col.rule || '10'}
              placeholder="10"
              onChange={(e) => onChange(e.target.value)}
              className="w-14 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-content-muted">Random alphanumeric characters</span>
        </div>
      );
    }

    case 'UUID': {
      return (
        <div className="flex items-center gap-2 text-xs text-content-muted font-mono bg-primary px-2.5 py-1 rounded-md border border-border-subtle flex-wrap">
          <Sparkles size={12} className="text-accent" />
          <span>Standard RFC 4122 v4 UUID (36 chars)</span>
        </div>
      );
    }

    default:
      return (
        <input
          type="text"
          value={col.rule}
          placeholder="Rule or argument"
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1 text-xs bg-primary border border-border-subtle rounded text-content font-mono"
        />
      );
  }
};
