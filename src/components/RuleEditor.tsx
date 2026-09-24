import React, { useState } from 'react';
import { ColumnSpec, EntitySubtype } from '../types';
import { Sparkles, Hash, Calculator, Clock, Code2, Tag, Sliders, RefreshCw, Layers, X, Check, Code, Terminal, AlertCircle, Upload, Database, Globe, Play } from 'lucide-react';
import { getCustomColumnTypes, getExamplePresetTypes, generateCustomTypeValue, CustomColumnType, getRegisteredCustomEntities, CustomEntityDataset } from '../utils/customTypesManager';
import { CustomEntityModal } from './CustomEntityModal';
import { RestApiConfigModal } from './RestApiConfigModal';
import { parseRestApiConfig, serializeRestApiConfig } from '../utils/restApiManager';
import { useI18n } from '../i18n';

interface Props {
  col: ColumnSpec;
  onChange: (rule: string) => void;
  availableColumns: string[];
}

const ENTITY_SUBTYPE_IDS: EntitySubtype[] = [
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'company',
  'job_title',
  'country',
  'city',
  'ip_address',
  'user_agent',
  'url'
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
  const { t } = useI18n();
  const [livePreviewVal, setLivePreviewVal] = useState<string | null>(null);
  const [isScriptEditorOpen, setIsScriptEditorOpen] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [isRestApiModalOpen, setIsRestApiModalOpen] = useState(false);
  const [scriptDraft, setScriptDraft] = useState('');
  const [modalTestResult, setModalTestResult] = useState<{ value: string; error: boolean } | null>(null);

  const getEntitySubtypeLabel = (id: EntitySubtype): string => {
    switch (id) {
      case 'full_name': return t('ruleEditor.entityFullName');
      case 'first_name': return t('ruleEditor.entityFirstName');
      case 'last_name': return t('ruleEditor.entityLastName');
      case 'email': return t('ruleEditor.entityEmail');
      case 'phone': return t('ruleEditor.entityPhone');
      case 'company': return t('ruleEditor.entityCompany');
      case 'job_title': return t('ruleEditor.entityJobTitle');
      case 'country': return t('ruleEditor.entityCountry');
      case 'city': return t('ruleEditor.entityCity');
      case 'ip_address': return t('ruleEditor.entityIpAddress');
      case 'user_agent': return t('ruleEditor.entityUserAgent');
      case 'url': return t('ruleEditor.entityUrl');
      default: return id;
    }
  };

  const customTypes = getCustomColumnTypes();
  const examplePresets = getExamplePresetTypes();
  const customType = col.type?.startsWith('custom:') || col.type?.startsWith('example:') || col.customTypeId
    ? customTypes.find(t => t.id === col.type || t.id === col.customTypeId)
      || examplePresets.find(t => t.id === col.type || t.id === col.customTypeId)
    : null;

  if (customType) {
    const isScript = customType.baseMode === 'Script' || customType.baseMode === 'Lua';

    const handleRollPreview = () => {
      try {
        const val = generateCustomTypeValue(customType, col.rule, {
          rowIndex: 0,
          row: { quantity: 5, price: 19.99, status: 'Active' }
        });
        setLivePreviewVal(String(val));
      } catch {
        setLivePreviewVal('Error');
      }
    };

    const handleOpenScriptEditor = () => {
      setScriptDraft(col.rule || customType.defaultRule);
      setModalTestResult(null);
      setIsScriptEditorOpen(true);
    };

    const handleTestScriptDraft = () => {
      try {
        const val = generateCustomTypeValue(customType, scriptDraft, {
          rowIndex: 0,
          row: { quantity: 5, price: 19.99, status: 'Active' }
        });
        const str = String(val);
        const hasErr = str.startsWith('[JS Error:') || str.startsWith('[Lua Error:');
        setModalTestResult({ value: str, error: hasErr });
      } catch (err: any) {
        setModalTestResult({ value: err?.message || String(err), error: true });
      }
    };

    const handleApplyScript = () => {
      onChange(scriptDraft);
      setIsScriptEditorOpen(false);
    };

    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full text-xs">
        {isScript ? (
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-primary border border-border-subtle rounded-md px-2.5 py-1">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                customType.baseMode === 'Lua'
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {customType.baseMode}
            </span>

            <span className="truncate flex-1 font-mono text-[11px] text-content-muted" title={col.rule || customType.defaultRule}>
              {(col.rule || customType.defaultRule).split('\n').find(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('--')) || 'Custom Script'}
            </span>

            <button
              type="button"
              onClick={handleOpenScriptEditor}
              className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-accent text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              {customType.baseMode === 'Lua' ? <Terminal size={11} /> : <Code size={11} />}
              <span>{t('ruleEditor.editCode')}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px] bg-primary border border-border-subtle rounded-md px-2.5 py-1">
            <span className="text-[10px] text-accent font-bold uppercase tracking-wider font-mono">
              {customType.baseMode === 'Base' ? (customType.baseSubtype || 'Base') : customType.baseMode}:
            </span>
            {(col.rule || customType.defaultRule).trim().startsWith('{') ? (
              <span className="w-full text-xs text-content font-mono truncate" title={col.rule || customType.defaultRule}>
                {(() => {
                  try {
                    const parsed = JSON.parse(col.rule || customType.defaultRule);
                    if (parsed.type === 'Int' && parsed.config) return `Int: ${parsed.config.min}..${parsed.config.max}${parsed.config.padZeros ? ` (pad ${parsed.config.padZeros})` : ''}${parsed.config.distribution && parsed.config.distribution !== 'uniform' ? ` [${parsed.config.distribution}]` : ''}`;
                    if (parsed.type === 'Float' && parsed.config) return `Float: ${parsed.config.min}..${parsed.config.max} (${parsed.config.decimals} dec)`;
                    if (parsed.type === 'Boolean' && parsed.config) return `Bool: ${parsed.config.truePct}% True (${parsed.config.format})`;
                    if (parsed.type === 'DateTime' && parsed.config) return `DateTime: ${parsed.config.range} (${parsed.config.format})`;
                    if (parsed.type === 'Set/Enum' && parsed.config) return `Enum: ${(parsed.config.items || []).map((it: any) => it.value).slice(0, 3).join(', ')}`;
                    if (parsed.type === 'Sequence' && parsed.config) return `Seq: Start ${parsed.config.start} (+${parsed.config.step})`;
                    if (parsed.type === 'RegEx' && parsed.config) return `RegEx: ${parsed.config.pattern}`;
                    if (parsed.type === 'UUID' && parsed.config) return `UUID: ${parsed.config.version}`;
                    if (parsed.type === 'Entity' && parsed.config) {
                      if (parsed.config.customEntityName) return `Entity: ${parsed.config.customEntityName} (${(parsed.config.customItems || []).length} items)`;
                      return `Entity: ${parsed.config.subtype}`;
                    }
                    if (parsed.type === 'Blob/Hex' && parsed.config) return `Blob: ${parsed.config.bytes} bytes (${parsed.config.encoding})`;
                    if (parsed.type === 'REST_API' && parsed.config) return `REST API: ${parsed.config.method || 'GET'} ${parsed.config.url} (${parsed.config.jsonPath || 'root'})`;
                    if (parsed.type === 'String' && parsed.config) return `String: ${parsed.config.length || parsed.config.maxLength} chars (${parsed.config.charset})`;
                  } catch {}
                  return col.rule || customType.defaultRule;
                })()}
              </span>
            ) : (
              <input
                type="text"
                value={col.rule}
                onChange={(e) => onChange(e.target.value)}
                placeholder={customType.defaultRule}
                className="w-full text-xs bg-transparent text-content font-mono focus:outline-none"
                title="Custom generator pattern / rule"
              />
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleRollPreview}
            className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[11px] font-medium text-content transition cursor-pointer"
            title="Test generate a sample output for this custom type"
          >
            <RefreshCw size={11} className="text-accent" />
            <span>{t('ruleEditor.testSample')}</span>
          </button>

          {livePreviewVal !== null && (
            <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-mono text-[11px] border border-accent/20 truncate max-w-[150px]">
              {livePreviewVal}
            </span>
          )}
        </div>

        {/* Modal for In-Schema Script Editing */}
        {isScriptEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-secondary border border-border-subtle w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-primary/50">
                <div className="flex items-center gap-2">
                  {customType.baseMode === 'Lua' ? (
                    <Terminal size={16} className="text-indigo-400" />
                  ) : (
                    <Code size={16} className="text-amber-400" />
                  )}
                  <div>
                    <h3 className="text-xs font-bold text-content">
                      {t('ruleEditor.editColumnScript')} <span className="text-accent font-mono">{col.name}</span>
                    </h3>
                    <p className="text-[10px] text-content-muted">
                      {customType.baseMode === 'Lua' ? 'Lua 5.3 engine' : 'JavaScript engine'} • {t('ruleEditor.returnsValueForColumn')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsScriptEditorOpen(false)}
                  className="p-1 rounded text-content-muted hover:text-content hover:bg-tertiary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div className="rounded-lg border border-border-subtle bg-primary/70 overflow-hidden focus-within:border-accent">
                  <div className="px-3 py-1 bg-primary border-b border-border-subtle text-[10px] font-mono text-content-muted flex justify-between">
                    <span>{customType.baseMode === 'Lua' ? '-- Lua 5.3' : '// JavaScript ES6'}</span>
                    <span>{t('ruleEditor.tabIndents')}</span>
                  </div>
                  <textarea
                    rows={12}
                    value={scriptDraft}
                    onChange={(e) => setScriptDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        target.value = target.value.substring(0, start) + '  ' + target.value.substring(end);
                        target.selectionStart = target.selectionEnd = start + 2;
                        setScriptDraft(target.value);
                      }
                    }}
                    className="w-full p-3 font-mono text-xs bg-transparent text-content focus:outline-none resize-y leading-relaxed"
                    spellCheck={false}
                  />
                </div>

                {modalTestResult && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                      modalTestResult.error
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {modalTestResult.error ? <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> : <Check size={14} className="mt-0.5 flex-shrink-0" />}
                    <div className="break-all font-semibold">{modalTestResult.value}</div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border-subtle bg-primary/40 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestScriptDraft}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} className="text-accent" />
                  <span>{t('ruleEditor.runTest')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScriptEditorOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-content-muted hover:text-content cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyScript}
                    className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={13} />
                    <span>{t('ruleEditor.applyToColumn')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  switch (col.type) {
    case 'Int': {
      const parts = col.rule.split(',');
      const min = parts[0]?.trim() || '';
      const max = parts[1]?.trim() || '';
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.min')}</span>
            <input
              type="number"
              value={min}
              placeholder="1"
              onChange={(e) => onChange(`${e.target.value || '0'}, ${max || '100'}`)}
              className="w-14 sm:w-16 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <span className="text-content-muted text-xs">{t('ruleEditor.to')}</span>
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.max')}</span>
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
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.min')}</span>
            <input
              type="number"
              step="any"
              value={min}
              placeholder="0.0"
              onChange={(e) => onChange(`${e.target.value || '0'}, ${max || '100'}, ${dec}`)}
              className="w-12 sm:w-14 text-xs bg-transparent text-content font-mono focus:outline-none"
            />
          </div>
          <span className="text-content-muted text-xs">{t('ruleEditor.to')}</span>
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.max')}</span>
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
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.dec')}</span>
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
            <span className="text-xs font-mono text-accent whitespace-nowrap">{pct}{t('ruleEditor.pctTrue')}</span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange('50')}
              className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary hover:bg-tertiary hover:opacity-80 text-content-muted cursor-pointer"
            >
              {t('ruleEditor.fiftyFifty')}
            </button>
            <button
              type="button"
              onClick={() => onChange('80')}
              className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary hover:bg-tertiary hover:opacity-80 text-content-muted cursor-pointer"
            >
              {t('ruleEditor.eightyPctTrue')}
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
              placeholder={t('ruleEditor.optionsPlaceholder')}
              value={col.rule}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-w-0 px-2.5 py-1.5 text-xs bg-primary border border-border-subtle rounded-md text-content font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-muted">{t('ruleEditor.presets')}</span>
            {ENUM_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.value)}
                className="text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content px-1.5 py-0.5 rounded border border-border-subtle transition cursor-pointer"
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
              placeholder={t('ruleEditor.calcPlaceholder')}
              value={col.rule}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-w-0 pl-7 pr-2.5 py-1.5 text-xs font-mono bg-primary border border-border-subtle rounded-md text-accent focus:outline-none focus:border-emerald-500"
            />
            <Calculator size={13} className="absolute left-2 top-2.5 text-accent" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-muted">{t('ruleEditor.insertColumn')}</span>
            {availableColumns.length === 0 ? (
              <span className="text-[10px] text-content-muted italic">{t('ruleEditor.noOtherColumns')}</span>
            ) : (
              availableColumns.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    const separator = col.rule && !col.rule.endsWith(' ') ? ' ' : '';
                    onChange(`${col.rule}${separator}{${name}}`);
                  }}
                  className="text-[10px] bg-accent/10 hover:bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/20 transition font-mono cursor-pointer"
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
                  className="text-[10px] bg-tertiary hover:bg-tertiary hover:opacity-80 text-content px-1.5 py-0.5 rounded font-mono cursor-pointer"
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
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.startFrom')}</span>
            <input
              type="number"
              value={col.rule || '1'}
              placeholder="1"
              onChange={(e) => onChange(e.target.value)}
              className="w-20 text-xs bg-transparent text-accent font-mono focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-content-muted">{t('ruleEditor.autoIncrements')}</span>
        </div>
      );
    }

    case 'Blob/Hex': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2.5 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.bytes')}</span>
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
            {parseInt(col.rule, 10) === 6 ? t('ruleEditor.macAddressSize') : t('ruleEditor.hexStream')}
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
            className="px-2.5 py-1 text-xs bg-primary border border-border-subtle rounded-md text-content font-mono focus:outline-none focus:border-accent max-w-full cursor-pointer"
          >
            <option value="YYYY-MM-DD HH:mm:ss">{t('ruleEditor.dateStandard')}</option>
            <option value="ISO">{t('ruleEditor.dateIso')}</option>
            <option value="date">{t('ruleEditor.dateOnly')}</option>
            <option value="time">{t('ruleEditor.timeOnly')}</option>
            <option value="timestamp">{t('ruleEditor.dateTimestamp')}</option>
            <option value="future">{t('ruleEditor.dateFuture')}</option>
            <option value="today">{t('ruleEditor.dateToday')}</option>
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
              placeholder={t('ruleEditor.regexPlaceholder')}
              value={col.rule}
              onChange={(e) => onChange(e.target.value)}
              className="w-full min-w-0 pl-7 pr-2.5 py-1.5 text-xs font-mono bg-primary border border-border-subtle rounded-md text-accent focus:outline-none focus:border-amber-500"
            />
            <Code2 size={13} className="absolute left-2 top-2.5 text-accent" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-content-muted">{t('ruleEditor.quickPatterns')}</span>
            {REGEX_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.pattern)}
                className="text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content px-1.5 py-0.5 rounded border border-border-subtle transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'Entity': {
      const customDatasets = getRegisteredCustomEntities();
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={col.rule || 'full_name'}
            onChange={(e) => {
              if (e.target.value === '__upload__') {
                setIsEntityModalOpen(true);
                return;
              }
              onChange(e.target.value);
            }}
            className="px-2.5 py-1 text-xs bg-primary border border-border-subtle rounded-md text-accent font-medium focus:outline-none focus:border-accent max-w-full cursor-pointer"
          >
            <optgroup label="Standard Built-in Types">
              {ENTITY_SUBTYPE_IDS.map((subId) => (
                <option key={subId} value={subId}>
                  {getEntitySubtypeLabel(subId)}
                </option>
              ))}
            </optgroup>

            {customDatasets.length > 0 && (
              <optgroup label="Custom Mock Datasets (.txt / .json)">
                {customDatasets.map((cd) => (
                  <option key={cd.id} value={cd.id}>
                    📁 {cd.name} ({cd.items.length} items)
                  </option>
                ))}
              </optgroup>
            )}

            <option value="__upload__">➕ Upload New Entity (.txt / .json)...</option>
          </select>

          <button
            type="button"
            onClick={() => setIsEntityModalOpen(true)}
            title="Upload custom entity .txt or .json dataset"
            className="px-2 py-1 text-[11px] bg-secondary hover:bg-tertiary text-accent font-semibold border border-border-subtle rounded-md transition flex items-center gap-1 cursor-pointer"
          >
            <Upload size={12} />
            <span>Upload .txt / .json</span>
          </button>

          <CustomEntityModal
            isOpen={isEntityModalOpen}
            onClose={() => setIsEntityModalOpen(false)}
            onSelectEntity={(entity) => {
              onChange(entity.id);
            }}
            initialSelectedId={col.rule}
          />
        </div>
      );
    }

    case 'REST_API': {
      const apiConfig = parseRestApiConfig(col.rule || '');
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-primary border border-border-subtle rounded-md px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
              {apiConfig.method || 'GET'}
            </span>
            <span
              className="text-xs font-mono text-content max-w-[200px] truncate"
              title={apiConfig.url}
            >
              {apiConfig.url}
            </span>
            {apiConfig.jsonPath && (
              <span className="text-[10px] font-mono text-content-muted bg-secondary px-1.5 py-0.5 rounded border border-border-subtle truncate max-w-[120px]">
                {apiConfig.jsonPath}
              </span>
            )}
            <span className="text-[9px] uppercase font-bold text-accent px-1 rounded bg-secondary">
              {apiConfig.retrievalMode === 'per_row' ? 'Row' : 'Pool'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsRestApiModalOpen(true)}
            className="px-2.5 py-1 text-xs bg-secondary hover:bg-tertiary text-accent font-semibold border border-border-subtle rounded-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Globe size={13} />
            <span>Configure REST API</span>
          </button>

          <RestApiConfigModal
            isOpen={isRestApiModalOpen}
            onClose={() => setIsRestApiModalOpen(false)}
            currentConfig={apiConfig}
            onSaveColumnConfig={(newCfg) => {
              onChange(serializeRestApiConfig(newCfg));
            }}
            columnName={col.name}
            initialTab="column"
          />
        </div>
      );
    }

    case 'String': {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-primary border border-border-subtle rounded-md px-2 py-1">
            <span className="text-[10px] text-content-muted mr-1.5 font-mono">{t('ruleEditor.length')}</span>
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
          <span className="text-[11px] text-content-muted">{t('ruleEditor.randomAlphanumeric')}</span>
        </div>
      );
    }

    case 'UUID': {
      return (
        <div className="flex items-center gap-2 text-xs text-content-muted font-mono bg-primary px-2.5 py-1 rounded-md border border-border-subtle flex-wrap">
          <Sparkles size={12} className="text-accent" />
          <span>{t('ruleEditor.uuidStandard')}</span>
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
