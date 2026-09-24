import React, { useState, useEffect } from 'react';
import {
  BaseEngineSubtype,
  BaseEngineConfig,
  IntAdvancedConfig,
  FloatAdvancedConfig,
  StringAdvancedConfig,
  BooleanAdvancedConfig,
  DateTimeAdvancedConfig,
  SequenceAdvancedConfig,
  SetEnumAdvancedConfig,
  RegExAdvancedConfig,
  BlobHexAdvancedConfig,
  UuidAdvancedConfig,
  EntityAdvancedConfig,
  CustomEntityDataset,
  getRegisteredCustomEntities,
  createDefaultBaseConfig,
  serializeBaseConfig
} from '../utils/customTypesManager';
import { CustomEntityModal } from './CustomEntityModal';
import {
  Hash,
  Sliders,
  ToggleLeft,
  Calendar,
  Layers,
  ListOrdered,
  Binary,
  Fingerprint,
  Users,
  Code2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Settings2,
  FileCode,
  Upload,
  Database,
  Dices,
  ExternalLink
} from 'lucide-react';

interface BaseEngineEditorProps {
  subtype: BaseEngineSubtype;
  onSubtypeChange: (subtype: BaseEngineSubtype) => void;
  config: BaseEngineConfig;
  onChangeConfig: (config: BaseEngineConfig) => void;
  rule: string;
  onRuleChange: (rule: string) => void;
}

export const BaseEngineEditor: React.FC<BaseEngineEditorProps> = ({
  subtype,
  onSubtypeChange,
  config,
  onChangeConfig,
  rule,
  onRuleChange
}) => {
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);

  // Subtype navigation items
  const SUBTYPE_TABS: { id: BaseEngineSubtype; label: string; icon: React.ReactNode; group: string; desc: string }[] = [
    { id: 'Int', label: 'Int Range', icon: <Hash size={13} />, group: 'Numbers', desc: 'Integers, padding & distribution' },
    { id: 'Float', label: 'Float Decimal', icon: <Sliders size={13} />, group: 'Numbers', desc: 'Precision decimals & rounding' },
    { id: 'Sequence', label: 'Sequence', icon: <ListOrdered size={13} />, group: 'Numbers', desc: 'Incremental step counters' },
    { id: 'String', label: 'String Text', icon: <Code2 size={13} />, group: 'Text', desc: 'Charsets, length & casings' },
    { id: 'RegEx', label: 'RegEx Pattern', icon: <Sparkles size={13} />, group: 'Text', desc: 'Synthesized regex patterns' },
    { id: 'Set/Enum', label: 'Enum Pool', icon: <Layers size={13} />, group: 'Text', desc: 'Weighted options & multi-select' },
    { id: 'Blob/Hex', label: 'Blob / Hex', icon: <Binary size={13} />, group: 'Text', desc: 'Raw bytes, 0x hex & Base64' },
    { id: 'Boolean', label: 'Boolean Flag', icon: <ToggleLeft size={13} />, group: 'Identity', desc: 'Probability & custom labels' },
    { id: 'DateTime', label: 'DateTime', icon: <Calendar size={13} />, group: 'Identity', desc: 'Horizons, ISO & business days' },
    { id: 'UUID', label: 'UUID / ID', icon: <Fingerprint size={13} />, group: 'Identity', desc: 'v4, v7 time-sortable & NanoID' },
    { id: 'Entity', label: 'Entity Mock', icon: <Users size={13} />, group: 'Identity', desc: 'People, contacts & companies' },
  ];

  const updateConfig = (newConfig: BaseEngineConfig) => {
    onChangeConfig(newConfig);
    onRuleChange(serializeBaseConfig(newConfig));
  };

  const handleSubtypeSelect = (newSubtype: BaseEngineSubtype) => {
    onSubtypeChange(newSubtype);
    const newConfig = createDefaultBaseConfig(newSubtype);
    updateConfig(newConfig);
  };

  // Helper for applying quick presets
  const applyPreset = (presetConfig: BaseEngineConfig) => {
    updateConfig(presetConfig);
  };

  return (
    <div className="space-y-3.5 p-3.5 rounded-xl bg-primary border border-border-subtle">
      {/* Subtype Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div>
          <label className="text-xs font-bold text-content flex items-center gap-1.5">
            <span className="p-1 rounded bg-sky-500/10 text-sky-400">
              <Hash size={13} />
            </span>
            <span>Base Data Type Engine</span>
          </label>
          <p className="text-[10px] text-content-muted mt-0.5">
            In-depth primitive configuration, probability distributions, formatting affixes, and validation rules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className={`px-2.5 py-1 text-[11px] rounded-lg border font-mono flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto ${
            showRawJson
              ? 'bg-accent/20 border-accent text-accent font-semibold'
              : 'bg-secondary border-border-subtle text-content-muted hover:text-content hover:bg-tertiary'
          }`}
        >
          <FileCode size={12} />
          <span>{showRawJson ? 'Visual Editor' : 'Inspect JSON'}</span>
        </button>
      </div>

      {/* Subtype Selector Tabs Grid */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">
          Primitive Base Subtype
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {SUBTYPE_TABS.map(tab => {
            const isSelected = subtype === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSubtypeSelect(tab.id)}
                className={`p-2 rounded-xl text-left border transition flex flex-col justify-between cursor-pointer select-none ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500 text-sky-400 shadow-xs ring-1 ring-sky-500/30'
                    : 'bg-secondary/70 border-border-subtle text-content-muted hover:text-content hover:bg-tertiary/70'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
                <div className="text-[9px] text-content-muted mt-1 truncate">
                  {tab.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showRawJson ? (
        /* Raw JSON Inspector / Direct Editor */
        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-content">Serialized Engine Config (JSON)</span>
            <span className="text-[10px] text-content-muted">Real-time state serialized into column rule</span>
          </div>
          <textarea
            rows={10}
            value={rule}
            onChange={(e) => {
              onRuleChange(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                if (parsed && parsed.type && parsed.config) {
                  onChangeConfig(parsed);
                  if (parsed.type !== subtype) {
                    onSubtypeChange(parsed.type);
                  }
                }
              } catch {}
            }}
            className="w-full px-3 py-2 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      ) : (
        /* Visual In-Depth Subtype Editor */
        <div className="space-y-3.5 pt-1">
          {/* INT RANGE EDITOR */}
          {config.type === 'Int' && (
            <IntSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Int', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* FLOAT DECIMAL EDITOR */}
          {config.type === 'Float' && (
            <FloatSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Float', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* SEQUENCE EDITOR */}
          {config.type === 'Sequence' && (
            <SequenceSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Sequence', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* STRING EDITOR */}
          {config.type === 'String' && (
            <StringSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'String', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* BOOLEAN EDITOR */}
          {config.type === 'Boolean' && (
            <BooleanSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Boolean', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* DATETIME EDITOR */}
          {config.type === 'DateTime' && (
            <DateTimeSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'DateTime', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* SET / ENUM POOL EDITOR */}
          {config.type === 'Set/Enum' && (
            <SetEnumSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Set/Enum', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* REGEX PATTERN EDITOR */}
          {config.type === 'RegEx' && (
            <RegExSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'RegEx', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* BLOB / HEX EDITOR */}
          {config.type === 'Blob/Hex' && (
            <BlobHexSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Blob/Hex', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* UUID / IDENTIFIER EDITOR */}
          {config.type === 'UUID' && (
            <UuidSubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'UUID', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}

          {/* ENTITY MOCK EDITOR */}
          {config.type === 'Entity' && (
            <EntitySubtypeEditor
              config={config.config}
              onChange={(cfg) => updateConfig({ type: 'Entity', config: cfg })}
              onApplyPreset={applyPreset}
            />
          )}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------
 * 1. INT SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const IntSubtypeEditor: React.FC<{
  config: IntAdvancedConfig;
  onChange: (cfg: IntAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange, onApplyPreset }) => {
  const [openAdv, setOpenAdv] = useState(true);

  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Order Qty (1 - 50)', cfg: { min: 1, max: 50, step: 1, padZeros: 0, thousandsSeparator: 'none' as const, signDisplay: 'default' as const, distribution: 'uniform' as const } },
          { label: 'Network Port (1024 - 65535)', cfg: { min: 1024, max: 65535, step: 1, padZeros: 0, thousandsSeparator: 'none' as const, signDisplay: 'default' as const, distribution: 'uniform' as const } },
          { label: 'HTTP Status (200 - 504)', cfg: { min: 200, max: 504, step: 1, padZeros: 0, thousandsSeparator: 'none' as const, signDisplay: 'default' as const, distribution: 'uniform' as const } },
          { label: 'Padded Account (00001 - 99999)', cfg: { min: 1, max: 99999, step: 1, padZeros: 5, thousandsSeparator: 'none' as const, signDisplay: 'default' as const, distribution: 'uniform' as const } },
          { label: 'Gaussian / Bell Score (0 - 100)', cfg: { min: 0, max: 100, step: 1, padZeros: 0, thousandsSeparator: 'none' as const, signDisplay: 'default' as const, distribution: 'normal' as const } }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p.cfg })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Core Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Minimum Value (Min)</label>
          <input
            type="number"
            value={config.min}
            onChange={(e) => onChange({ ...config, min: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Maximum Value (Max)</label>
          <input
            type="number"
            value={config.max}
            onChange={(e) => onChange({ ...config, max: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Step Multiplier</label>
          <input
            type="number"
            min={1}
            value={config.step || 1}
            onChange={(e) => onChange({ ...config, step: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Advanced Accordion */}
      <div className="border border-border-subtle rounded-xl bg-secondary/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenAdv(!openAdv)}
          className="w-full px-3 py-2 text-xs font-semibold text-content flex items-center justify-between hover:bg-secondary/60 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 size={13} className="text-accent" />
            <span>Advanced Integer Settings (Padding, Curve, Formatting, Affixes)</span>
          </span>
          {openAdv ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {openAdv && (
          <div className="p-3 border-t border-border-subtle space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Zero-Padding Width</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={config.padZeros || 0}
                  onChange={(e) => onChange({ ...config, padZeros: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  placeholder="e.g. 5 for 00042"
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Thousands Separator</label>
                <select
                  value={config.thousandsSeparator || 'none'}
                  onChange={(e) => onChange({ ...config, thousandsSeparator: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="none">None (100000)</option>
                  <option value="comma">Comma (100,000)</option>
                  <option value="dot">Dot (100.000)</option>
                  <option value="space">Space (100 000)</option>
                  <option value="underscore">Underscore (100_000)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Distribution Curve</label>
                <select
                  value={config.distribution || 'uniform'}
                  onChange={(e) => onChange({ ...config, distribution: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="uniform">Uniform (Flat random)</option>
                  <option value="normal">Normal / Gaussian (Bell Curve centered)</option>
                  <option value="min_heavy">Min-Heavy (Skewed towards lower bound)</option>
                  <option value="max_heavy">Max-Heavy (Skewed towards upper bound)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Sign Display</label>
                <select
                  value={config.signDisplay || 'default'}
                  onChange={(e) => onChange({ ...config, signDisplay: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="default">Default (- if negative)</option>
                  <option value="always">Always (+ or -)</option>
                  <option value="negative_only">Negative Only</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Prefix String</label>
                <input
                  type="text"
                  value={config.prefix || ''}
                  onChange={(e) => onChange({ ...config, prefix: e.target.value })}
                  placeholder="e.g. #, ID-, +"
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Suffix String</label>
                <input
                  type="text"
                  value={config.suffix || ''}
                  onChange={(e) => onChange({ ...config, suffix: e.target.value })}
                  placeholder="e.g.  units,  items, px"
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 2. FLOAT SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const FloatSubtypeEditor: React.FC<{
  config: FloatAdvancedConfig;
  onChange: (cfg: FloatAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  const [openAdv, setOpenAdv] = useState(true);

  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Retail Price ($0.99 - $199.99)', cfg: { min: 0.99, max: 199.99, decimals: 2, prefix: '$', suffix: '', padDecimals: true } },
          { label: 'Tax Rate % (0.00 - 25.00)', cfg: { min: 0.0, max: 25.0, decimals: 2, prefix: '', suffix: '%', padDecimals: true } },
          { label: 'GPS Latitude (-90.0 to 90.0)', cfg: { min: -90.0, max: 90.0, decimals: 6, prefix: '', suffix: '', padDecimals: false } },
          { label: 'GPS Longitude (-180.0 to 180.0)', cfg: { min: -180.0, max: 180.0, decimals: 6, prefix: '', suffix: '', padDecimals: false } },
          { label: 'Sensor Temperature (15.0 - 45.0 °C)', cfg: { min: 15.0, max: 45.0, decimals: 1, prefix: '', suffix: '°C', padDecimals: true } }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p.cfg })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Core Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Minimum Float (Min)</label>
          <input
            type="number"
            step="any"
            value={config.min}
            onChange={(e) => onChange({ ...config, min: parseFloat(e.target.value) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Maximum Float (Max)</label>
          <input
            type="number"
            step="any"
            value={config.max}
            onChange={(e) => onChange({ ...config, max: parseFloat(e.target.value) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Decimal Places (Precision)</label>
          <input
            type="number"
            min={0}
            max={10}
            value={config.decimals}
            onChange={(e) => onChange({ ...config, decimals: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Advanced Accordion */}
      <div className="border border-border-subtle rounded-xl bg-secondary/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenAdv(!openAdv)}
          className="w-full px-3 py-2 text-xs font-semibold text-content flex items-center justify-between hover:bg-secondary/60 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 size={13} className="text-accent" />
            <span>Advanced Float Settings (Rounding, Formatting Separators, Affixes)</span>
          </span>
          {openAdv ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {openAdv && (
          <div className="p-3 border-t border-border-subtle space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Rounding Mode</label>
                <select
                  value={config.rounding || 'round'}
                  onChange={(e) => onChange({ ...config, rounding: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="round">Half-Up Round (Default)</option>
                  <option value="floor">Floor (Round Down)</option>
                  <option value="ceil">Ceil (Round Up)</option>
                  <option value="truncate">Truncate</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Decimal Separator</label>
                <select
                  value={config.decimalSeparator || '.'}
                  onChange={(e) => onChange({ ...config, decimalSeparator: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value=".">Dot (.) e.g. 19.99</option>
                  <option value=",">Comma (,) e.g. 19,99</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Thousands Separator</label>
                <select
                  value={config.thousandsSeparator || 'none'}
                  onChange={(e) => onChange({ ...config, thousandsSeparator: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="none">None (1000.50)</option>
                  <option value="comma">Comma (1,000.50)</option>
                  <option value="dot">Dot (1.000,50)</option>
                  <option value="space">Space (1 000.50)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="floatPadDec"
                  checked={config.padDecimals ?? true}
                  onChange={(e) => onChange({ ...config, padDecimals: e.target.checked })}
                  className="rounded text-accent focus:ring-accent"
                />
                <label htmlFor="floatPadDec" className="text-xs text-content select-none cursor-pointer">
                  Pad trailing zeros (e.g. 45.20)
                </label>
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Prefix Affix</label>
                <input
                  type="text"
                  value={config.prefix || ''}
                  onChange={(e) => onChange({ ...config, prefix: e.target.value })}
                  placeholder="e.g. $, €"
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Suffix Affix</label>
                <input
                  type="text"
                  value={config.suffix || ''}
                  onChange={(e) => onChange({ ...config, suffix: e.target.value })}
                  placeholder="e.g. %,  kg,  USD"
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 3. SEQUENCE SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const SequenceSubtypeEditor: React.FC<{
  config: SequenceAdvancedConfig;
  onChange: (cfg: SequenceAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Auto-increment ID (1001, +1)', cfg: { start: 1001, step: 1, padZeros: 0, prefix: '', suffix: '', base: 'decimal' as const } },
          { label: 'Invoice Number (INV-000001)', cfg: { start: 1, step: 1, padZeros: 6, prefix: 'INV-', suffix: '', base: 'decimal' as const } },
          { label: 'Cycle 1-100 Modulo', cfg: { start: 1, step: 1, padZeros: 0, cycleAt: 100, prefix: '', suffix: '', base: 'decimal' as const } },
          { label: 'Alphabetical Column (A, B, C...)', cfg: { start: 1, step: 1, padZeros: 0, base: 'alpha' as const } },
          { label: 'Hex Memory Address (0x1000, +16)', cfg: { start: 4096, step: 16, padZeros: 4, prefix: '0x', base: 'hex' as const } }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p.cfg })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Starting Number (Offset)</label>
          <input
            type="number"
            value={config.start}
            onChange={(e) => onChange({ ...config, start: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Increment Step Size</label>
          <input
            type="number"
            value={config.step}
            onChange={(e) => onChange({ ...config, step: parseInt(e.target.value, 10) || 1 })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Zero-Padding Width</label>
          <input
            type="number"
            min={0}
            max={20}
            value={config.padZeros || 0}
            onChange={(e) => onChange({ ...config, padZeros: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder="e.g. 6 -> 000042"
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Numeral Base</label>
          <select
            value={config.base || 'decimal'}
            onChange={(e) => onChange({ ...config, base: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="decimal">Decimal (1, 2, 3)</option>
            <option value="hex">Hexadecimal (A, B, 1F)</option>
            <option value="alpha">Alpha Index (A, B... Z, AA)</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Cycle Limit (Modulo)</label>
          <input
            type="number"
            min={0}
            value={config.cycleAt || ''}
            onChange={(e) => onChange({ ...config, cycleAt: parseInt(e.target.value, 10) || undefined })}
            placeholder="e.g. 1000 (optional)"
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Prefix</label>
          <input
            type="text"
            value={config.prefix || ''}
            onChange={(e) => onChange({ ...config, prefix: e.target.value })}
            placeholder="e.g. SEQ-, INV-"
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Suffix</label>
          <input
            type="text"
            value={config.suffix || ''}
            onChange={(e) => onChange({ ...config, suffix: e.target.value })}
            placeholder="e.g. -2026"
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 4. STRING SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const StringSubtypeEditor: React.FC<{
  config: StringAdvancedConfig;
  onChange: (cfg: StringAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Alphanumeric Code (10 chars)', cfg: { lengthMode: 'fixed' as const, length: 10, charset: 'alphanumeric' as const, casing: 'original' as const } },
          { label: 'Numeric PIN (6 digits)', cfg: { lengthMode: 'fixed' as const, length: 6, charset: 'numeric' as const } },
          { label: 'Uppercase Token (12 chars)', cfg: { lengthMode: 'fixed' as const, length: 12, charset: 'alpha_upper' as const, casing: 'upper' as const } },
          { label: 'Random Slug (8-16 chars)', cfg: { lengthMode: 'range' as const, minLength: 8, maxLength: 16, charset: 'alpha_lower' as const } },
          { label: 'Secure Password Mock', cfg: { lengthMode: 'fixed' as const, length: 14, charset: 'symbols' as const } }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p.cfg })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Length Mode</label>
          <select
            value={config.lengthMode || 'fixed'}
            onChange={(e) => onChange({ ...config, lengthMode: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="fixed">Fixed Exact Length</option>
            <option value="range">Variable Min-Max Range</option>
          </select>
        </div>

        {config.lengthMode === 'range' ? (
          <>
            <div>
              <label className="text-[11px] font-semibold text-content block mb-1">Min Length</label>
              <input
                type="number"
                min={1}
                max={100}
                value={config.minLength || 6}
                onChange={(e) => onChange({ ...config, minLength: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-content block mb-1">Max Length</label>
              <input
                type="number"
                min={1}
                max={100}
                value={config.maxLength || 16}
                onChange={(e) => onChange({ ...config, maxLength: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
              />
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-content block mb-1">String Length: {config.length || 10} chars</label>
            <input
              type="range"
              min={1}
              max={64}
              value={config.length || 10}
              onChange={(e) => onChange({ ...config, length: parseInt(e.target.value, 10) })}
              className="w-full accent-accent cursor-pointer"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Character Set Pool</label>
          <select
            value={config.charset || 'alphanumeric'}
            onChange={(e) => onChange({ ...config, charset: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="alphanumeric">Alphanumeric (A-Z, a-z, 0-9)</option>
            <option value="alpha">Letters Only (A-Z, a-z)</option>
            <option value="alpha_upper">Uppercase Letters (A-Z)</option>
            <option value="alpha_lower">Lowercase Letters (a-z)</option>
            <option value="numeric">Digits Only (0-9)</option>
            <option value="hex">Hexadecimal (0-9, A-F)</option>
            <option value="symbols">Complex (Letters, Digits, Symbols)</option>
            <option value="custom">Custom Charset...</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Casing Transformation</label>
          <select
            value={config.casing || 'original'}
            onChange={(e) => onChange({ ...config, casing: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="original">Original</option>
            <option value="upper">UPPERCASE</option>
            <option value="lower">lowercase</option>
            <option value="capitalize">Capitalize (TitleCase)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-content block mb-1">Prefix / Affix</label>
          <input
            type="text"
            value={config.prefix || ''}
            onChange={(e) => onChange({ ...config, prefix: e.target.value })}
            placeholder="e.g. KEY_"
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {config.charset === 'custom' && (
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Custom Characters Pool</label>
          <input
            type="text"
            value={config.customCharset || ''}
            onChange={(e) => onChange({ ...config, customCharset: e.target.value })}
            placeholder="e.g. ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (Base32)"
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------
 * 5. BOOLEAN SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const BooleanSubtypeEditor: React.FC<{
  config: BooleanAdvancedConfig;
  onChange: (cfg: BooleanAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: '50% Binary True/False', truePct: 50, format: 'true_false' as const },
          { label: '80% High Probability Active', truePct: 80, format: 'active_inactive' as const },
          { label: '10% Low Rare Event', truePct: 10, format: 'yes_no' as const },
          { label: '1 / 0 Bit Flag', truePct: 50, format: '1_0' as const },
          { label: 'Enabled / Disabled', truePct: 75, format: 'enabled_disabled' as const }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, truePct: p.truePct, format: p.format })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="p-3 bg-secondary/40 border border-border-subtle rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-content">True Probability</span>
          <span className="font-mono font-bold text-accent">{config.truePct}% True / {100 - config.truePct}% False</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={config.truePct}
          onChange={(e) => onChange({ ...config, truePct: parseInt(e.target.value, 10) })}
          className="w-full accent-accent cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Output Representation Format</label>
          <select
            value={config.format}
            onChange={(e) => onChange({ ...config, format: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="true_false">true / false (native boolean)</option>
            <option value="True_False">True / False</option>
            <option value="TRUE_FALSE">TRUE / FALSE</option>
            <option value="1_0">1 / 0 (Binary integer)</option>
            <option value="yes_no">Yes / No</option>
            <option value="Y_N">Y / N</option>
            <option value="enabled_disabled">Enabled / Disabled</option>
            <option value="active_inactive">Active / Inactive</option>
            <option value="custom">Custom String Labels...</option>
          </select>
        </div>

        {config.format === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-content block mb-1">True Label</label>
              <input
                type="text"
                value={config.customTrue || ''}
                onChange={(e) => onChange({ ...config, customTrue: e.target.value })}
                placeholder="e.g. Verified"
                className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-content block mb-1">False Label</label>
              <input
                type="text"
                value={config.customFalse || ''}
                onChange={(e) => onChange({ ...config, customFalse: e.target.value })}
                placeholder="e.g. Unverified"
                className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 6. DATETIME SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const DateTimeSubtypeEditor: React.FC<{
  config: DateTimeAdvancedConfig;
  onChange: (cfg: DateTimeAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Recent 30 Days (ISO)', range: 'past_30d' as const, format: 'ISO' as const, businessOnly: false },
          { label: 'Past Year (YYYY-MM-DD)', range: 'past_year' as const, format: 'YYYY-MM-DD' as const, businessOnly: false },
          { label: 'Business Weekdays Only', range: 'past_90d' as const, format: 'YYYY-MM-DD HH:mm:ss' as const, businessOnly: true },
          { label: 'Future 30 Days', range: 'future_30d' as const, format: 'YYYY-MM-DD' as const, businessOnly: false },
          { label: 'Unix Timestamp (ms)', range: 'past_year' as const, format: 'timestamp_ms' as const, businessOnly: false }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Time Horizon Range</label>
          <select
            value={config.range}
            onChange={(e) => onChange({ ...config, range: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="past_30d">Past 30 Days</option>
            <option value="past_90d">Past 90 Days (Quarter)</option>
            <option value="past_year">Past 1 Year</option>
            <option value="past_5y">Past 5 Years</option>
            <option value="today">Today Only (Random hours)</option>
            <option value="future_30d">Future 30 Days</option>
            <option value="future_year">Future 1 Year</option>
            <option value="custom_range">Custom Date Interval...</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Date Format</label>
          <select
            value={config.format}
            onChange={(e) => onChange({ ...config, format: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss (Standard SQL)</option>
            <option value="ISO">ISO 8601 (2026-03-24T12:00:00Z)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (Date Only)</option>
            <option value="HH:mm:ss">HH:mm:ss (Time Only)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (EU Format)</option>
            <option value="timestamp_s">Epoch Seconds (Unix)</option>
            <option value="timestamp_ms">Epoch Milliseconds</option>
          </select>
        </div>
      </div>

      {config.range === 'custom_range' && (
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] font-medium text-content block mb-1">Start Date</label>
            <input
              type="date"
              value={config.startDate || ''}
              onChange={(e) => onChange({ ...config, startDate: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-content block mb-1">End Date</label>
            <input
              type="date"
              value={config.endDate || ''}
              onChange={(e) => onChange({ ...config, endDate: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="dtBizOnly"
          checked={config.businessOnly ?? false}
          onChange={(e) => onChange({ ...config, businessOnly: e.target.checked })}
          className="rounded text-accent focus:ring-accent"
        />
        <label htmlFor="dtBizOnly" className="text-xs text-content select-none cursor-pointer">
          Business days and working hours only (Mon-Fri, 09:00 - 18:00)
        </label>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 7. SET / ENUM SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const SetEnumSubtypeEditor: React.FC<{
  config: SetEnumAdvancedConfig;
  onChange: (cfg: SetEnumAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemWeight, setNewItemWeight] = useState(20);
  const [openAdv, setOpenAdv] = useState(false);

  const totalWeight = (config.items || []).reduce((acc, it) => acc + (it.weight || 1), 0);

  const addItem = () => {
    if (!newItemValue.trim()) return;
    onChange({
      ...config,
      items: [...config.items, { value: newItemValue.trim(), weight: Number(newItemWeight) || 10 }]
    });
    setNewItemValue('');
  };

  const removeItem = (index: number) => {
    const next = [...config.items];
    next.splice(index, 1);
    onChange({ ...config, items: next });
  };

  const updateItemWeight = (index: number, weight: number) => {
    const next = [...config.items];
    next[index] = { ...next[index], weight: Math.max(1, weight) };
    onChange({ ...config, items: next });
  };

  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          {
            label: 'Order Status',
            items: [
              { value: 'Completed', weight: 65 },
              { value: 'Processing', weight: 20 },
              { value: 'Cancelled', weight: 10 },
              { value: 'Refunded', weight: 5 }
            ]
          },
          {
            label: 'Priority Tier',
            items: [
              { value: 'Low', weight: 50 },
              { value: 'Medium', weight: 35 },
              { value: 'High', weight: 12 },
              { value: 'Critical', weight: 3 }
            ]
          },
          {
            label: 'Multi-select Tags',
            items: [
              { value: 'Tech', weight: 10 },
              { value: 'Design', weight: 10 },
              { value: 'Remote', weight: 10 },
              { value: 'Finance', weight: 10 },
              { value: 'Product', weight: 10 }
            ],
            selectionMode: 'multi' as const,
            multiMin: 1,
            multiMax: 3
          }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, items: p.items, selectionMode: p.selectionMode || 'single', multiMin: p.multiMin, multiMax: p.multiMax })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Items List with Weights */}
      <div className="space-y-1.5 border border-border-subtle rounded-xl p-2.5 bg-secondary/30">
        <div className="flex items-center justify-between text-[11px] font-semibold text-content px-1">
          <span>Options Pool & Relative Weights</span>
          <span className="text-[10px] text-content-muted">{config.items.length} choices (total weight: {totalWeight})</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {config.items.map((it, idx) => {
            const pct = totalWeight > 0 ? Math.round((it.weight / totalWeight) * 100) : 0;
            return (
              <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary border border-border-subtle text-xs">
                <span className="font-semibold text-content flex-1 truncate">{it.value}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-content-muted w-10 text-right">{pct}%</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={it.weight}
                    onChange={(e) => updateItemWeight(idx, parseInt(e.target.value, 10) || 1)}
                    className="w-14 px-1.5 py-0.5 text-[11px] font-mono bg-primary border border-border-subtle rounded text-content text-right focus:outline-none focus:border-accent"
                    title="Weight ratio"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1 text-content-muted hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Option Form */}
        <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
          <input
            type="text"
            value={newItemValue}
            onChange={(e) => setNewItemValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
            placeholder="Add new option (e.g. Shipped)..."
            className="flex-1 px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
          <input
            type="number"
            min={1}
            value={newItemWeight}
            onChange={(e) => setNewItemWeight(parseInt(e.target.value, 10) || 10)}
            className="w-14 px-2 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content text-right focus:outline-none focus:border-accent"
            title="Weight"
          />
          <button
            type="button"
            onClick={addItem}
            className="px-2.5 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-accent-hover transition cursor-pointer"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Advanced Enum Settings */}
      <div className="border border-border-subtle rounded-xl bg-secondary/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenAdv(!openAdv)}
          className="w-full px-3 py-2 text-xs font-semibold text-content flex items-center justify-between hover:bg-secondary/60 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 size={13} className="text-accent" />
            <span>Advanced Enum Pool Settings (Multi-Select, Strategies, Quotes)</span>
          </span>
          {openAdv ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {openAdv && (
          <div className="p-3 border-t border-border-subtle space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Selection Mode</label>
                <select
                  value={config.selectionMode || 'single'}
                  onChange={(e) => onChange({ ...config, selectionMode: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="single">Single Choice</option>
                  <option value="multi">Multi-Select Array / Tags</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Pick Strategy</label>
                <select
                  value={config.strategy || 'weighted'}
                  onChange={(e) => onChange({ ...config, strategy: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="weighted">Weighted Probability (Weights above)</option>
                  <option value="uniform">Uniform Unbiased (Equal 1/N odds)</option>
                  <option value="round_robin">Round-Robin Sequential (Row index)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-content block mb-1">Quoting Style</label>
                <select
                  value={config.quote || 'none'}
                  onChange={(e) => onChange({ ...config, quote: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                >
                  <option value="none">Plain (No quotes)</option>
                  <option value="single">Single Quotes ('Option')</option>
                  <option value="double">Double Quotes ("Option")</option>
                </select>
              </div>
            </div>

            {config.selectionMode === 'multi' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-content block mb-1">Min Items Picked</label>
                  <input
                    type="number"
                    min={1}
                    value={config.multiMin || 1}
                    onChange={(e) => onChange({ ...config, multiMin: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-content block mb-1">Max Items Picked</label>
                  <input
                    type="number"
                    min={1}
                    value={config.multiMax || 2}
                    onChange={(e) => onChange({ ...config, multiMax: parseInt(e.target.value, 10) || 2 })}
                    className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-content block mb-1">Item Delimiter</label>
                  <input
                    type="text"
                    value={config.multiDelimiter || ', '}
                    onChange={(e) => onChange({ ...config, multiDelimiter: e.target.value })}
                    placeholder="e.g. ,  or | or ;"
                    className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 8. REGEX SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const RegExSubtypeEditor: React.FC<{
  config: RegExAdvancedConfig;
  onChange: (cfg: RegExAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'License Plate ([A-Z]{3}-\\d{4})', pattern: '[A-Z]{3}-\\d{4}' },
          { label: 'Thai National ID (Checksum)', pattern: 'thai_id_checksum' },
          { label: 'MAC Address', pattern: '[0-9A-F]{2}(:[0-9A-F]{2}){5}' },
          { label: 'US Phone #', pattern: '\\(\\d{3}\\) \\d{3}-\\d{4}' },
          { label: 'Crypto Wallet 0x40', pattern: '0x[a-f0-9]{40}' }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, pattern: p.pattern })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-[11px] font-semibold text-content block mb-1">
          Regular Expression Pattern
        </label>
        <input
          type="text"
          value={config.pattern}
          onChange={(e) => onChange({ ...config, pattern: e.target.value })}
          placeholder="e.g. [A-Z]{3}-\\d{4} or thai_id_checksum"
          className="w-full px-3 py-2 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
        />
        <p className="text-[10px] text-content-muted mt-1">
          Supports character classes `[A-Z]`, quantifiers `{'{3}'}`, groups `(A|B)`, word boundaries, and custom checksum token `thai_id_checksum`.
        </p>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 9. BLOB / HEX SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const BlobHexSubtypeEditor: React.FC<{
  config: BlobHexAdvancedConfig;
  onChange: (cfg: BlobHexAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: '0x-Hex Hash (20 bytes / 40 chars)', bytes: 20, encoding: 'hex_0x' as const },
          { label: 'MAC Address (6 bytes colon)', bytes: 6, encoding: 'hex_delimited' as const, delimiter: ':' as const, casing: 'upper' as const },
          { label: 'Base64 Token (16 bytes)', bytes: 16, encoding: 'base64' as const },
          { label: 'Binary Bitstring (4 bytes)', bytes: 4, encoding: 'binary' as const }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Byte Count (1 to 256)</label>
          <input
            type="number"
            min={1}
            max={256}
            value={config.bytes}
            onChange={(e) => onChange({ ...config, bytes: Math.min(256, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Encoding Format</label>
          <select
            value={config.encoding}
            onChange={(e) => onChange({ ...config, encoding: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="hex_delimited">Hex with Delimiter (AA-BB-CC)</option>
            <option value="hex_continuous">Continuous Hex (AABBCC)</option>
            <option value="hex_0x">0x-Prefixed Hex (0xaabbcc)</option>
            <option value="base64">Base64 Encoded</option>
            <option value="binary">Binary Bits (01010101)</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Hex Casing</label>
          <select
            value={config.casing || 'upper'}
            onChange={(e) => onChange({ ...config, casing: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="upper">UPPERCASE (e.g. 4F, FF)</option>
            <option value="lower">lowercase (e.g. 4f, ff)</option>
          </select>
        </div>
      </div>

      {config.encoding === 'hex_delimited' && (
        <div className="w-1/3">
          <label className="text-[11px] font-medium text-content block mb-1">Byte Delimiter</label>
          <select
            value={config.delimiter || '-'}
            onChange={(e) => onChange({ ...config, delimiter: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="-">Hyphen (-)</option>
            <option value=":">Colon (:)</option>
            <option value=" ">Space ( )</option>
            <option value="">None</option>
          </select>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------
 * 10. UUID SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const UuidSubtypeEditor: React.FC<{
  config: UuidAdvancedConfig;
  onChange: (cfg: UuidAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Standard UUID v4', version: 'v4' as const, hyphens: true, casing: 'lower' as const },
          { label: 'Time-sortable UUID v7', version: 'v7' as const, hyphens: true, casing: 'lower' as const },
          { label: 'URL-Safe NanoID (21 chars)', version: 'nanoid' as const },
          { label: 'Short 8-char Key', version: 'short' as const, casing: 'upper' as const }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...config, ...p })}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Algorithm / Version</label>
          <select
            value={config.version}
            onChange={(e) => onChange({ ...config, version: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="v4">UUID v4 (Random Crypto)</option>
            <option value="v7">UUID v7 (Time-Sortable Epoch)</option>
            <option value="nanoid">NanoID (URL-Safe Compact)</option>
            <option value="short">Short Alpha-Numeric Key</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-content block mb-1">Casing</label>
          <select
            value={config.casing || 'lower'}
            onChange={(e) => onChange({ ...config, casing: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
          >
            <option value="lower">lowercase (standard)</option>
            <option value="upper">UPPERCASE</option>
          </select>
        </div>

        <div className="space-y-1.5 pt-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="uuidHyphens"
              checked={config.hyphens ?? true}
              onChange={(e) => onChange({ ...config, hyphens: e.target.checked })}
              className="rounded text-accent focus:ring-accent"
            />
            <label htmlFor="uuidHyphens" className="text-xs text-content select-none cursor-pointer">
              Include hyphens
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="uuidUrn"
              checked={config.urnPrefix ?? false}
              onChange={(e) => onChange({ ...config, urnPrefix: e.target.checked })}
              className="rounded text-accent focus:ring-accent"
            />
            <label htmlFor="uuidUrn" className="text-xs text-content select-none cursor-pointer">
              Add urn:uuid: prefix
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
 * 11. ENTITY SUBTYPE EDITOR
 * ------------------------------------------------------------- */
const EntitySubtypeEditor: React.FC<{
  config: EntityAdvancedConfig;
  onChange: (cfg: EntityAdvancedConfig) => void;
  onApplyPreset: (cfg: BaseEngineConfig) => void;
}> = ({ config, onChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customDatasets, setCustomDatasets] = useState<CustomEntityDataset[]>([]);

  const refreshCustomList = () => {
    setCustomDatasets(getRegisteredCustomEntities());
  };

  useEffect(() => {
    refreshCustomList();
  }, [isModalOpen]);

  const selectedCustom = customDatasets.find(
    (d) =>
      d.id === config.customEntityId ||
      d.id === config.subtype ||
      d.name.toLowerCase() === (config.customEntityName || config.subtype).toLowerCase()
  );

  const handleSelectCustomEntity = (entity: CustomEntityDataset) => {
    onChange({
      ...config,
      subtype: entity.id,
      customEntityId: entity.id,
      customEntityName: entity.name,
      customItems: entity.items
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-content-muted mr-1">Presets:</span>
        {[
          { label: 'Full Person Name', subtype: 'full_name' as const },
          { label: 'Corporate Email', subtype: 'email' as const, emailDomain: 'enterprise.io' },
          { label: 'US Phone', subtype: 'phone' as const, phoneFormat: 'us' as const },
          { label: 'Company / Startup', subtype: 'company' as const },
          { label: 'Job Role / Title', subtype: 'job_title' as const },
          { label: 'IPv4 Address', subtype: 'ip_address' as const }
        ].map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const { customItems, customEntityId, customEntityName, ...rest } = config;
              onChange({ ...rest, ...p });
            }}
            className="px-2 py-0.5 text-[10px] bg-secondary hover:bg-tertiary text-content-muted hover:text-content rounded border border-border-subtle transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}

        {/* Quick Custom Dataset Presets */}
        {customDatasets.slice(0, 3).map((cd) => (
          <button
            key={cd.id}
            type="button"
            onClick={() => handleSelectCustomEntity(cd)}
            className="px-2 py-0.5 text-[10px] bg-accent/10 hover:bg-accent/20 text-accent font-medium rounded border border-accent/25 transition cursor-pointer flex items-center gap-1"
          >
            <span>{cd.name}</span>
            <span className="opacity-70 text-[9px]">({cd.items.length})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-content">Entity Category / Dataset</label>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-[11px] text-accent hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Upload size={12} />
              <span>Upload .txt / .json</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCustom ? selectedCustom.id : config.subtype}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__upload_new__') {
                  setIsModalOpen(true);
                  return;
                }
                const found = customDatasets.find((d) => d.id === val);
                if (found) {
                  handleSelectCustomEntity(found);
                } else {
                  const { customItems, customEntityId, customEntityName, ...rest } = config;
                  onChange({ ...rest, subtype: val });
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent font-medium"
            >
              <optgroup label="Standard Built-in Entities">
                <option value="full_name">Full Name (First & Last)</option>
                <option value="first_name">First Name</option>
                <option value="last_name">Last Name</option>
                <option value="email">Email Address</option>
                <option value="phone">Phone Number</option>
                <option value="company">Company Name</option>
                <option value="job_title">Job Title / Role</option>
                <option value="country">Country</option>
                <option value="city">City</option>
                <option value="ip_address">IPv4 Address</option>
                <option value="user_agent">Browser User-Agent</option>
                <option value="url">Company Website URL</option>
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

              <option value="__upload_new__">➕ Upload New Entity (.txt / .json)...</option>
            </select>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              title="Upload txt/json or manage custom entities"
              className="px-2.5 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/30 text-xs font-bold hover:bg-accent/25 transition shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>

        {config.subtype === 'email' && (
          <div>
            <label className="text-[11px] font-semibold text-content block mb-1">Email Domain Override</label>
            <input
              type="text"
              value={config.emailDomain || ''}
              onChange={(e) => onChange({ ...config, emailDomain: e.target.value })}
              placeholder="e.g. corp.internal or leave blank"
              className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {config.subtype === 'phone' && (
          <div>
            <label className="text-[11px] font-semibold text-content block mb-1">Phone Format</label>
            <select
              value={config.phoneFormat || 'international'}
              onChange={(e) => onChange({ ...config, phoneFormat: e.target.value as any })}
              className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
            >
              <option value="us">(555) 123-4567 (US)</option>
              <option value="international">+1-555-123-4567 (Intl)</option>
              <option value="local">02-123-4567 (Local)</option>
            </select>
          </div>
        )}
      </div>

      {/* Active Custom Dataset Card */}
      {selectedCustom && (
        <div className="bg-primary/50 border border-accent/30 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <h4 className="text-xs font-bold text-content">{selectedCustom.name}</h4>
              <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 text-[10px] font-mono font-bold">
                {selectedCustom.items.length} custom records
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-[10px] text-accent hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage / Upload Datasets</span>
              <ExternalLink size={10} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {selectedCustom.items.slice(0, 15).map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-secondary text-content-muted border border-border-subtle text-[11px] font-mono"
              >
                {item}
              </span>
            ))}
            {selectedCustom.items.length > 15 && (
              <span className="px-2 py-0.5 rounded-md bg-secondary text-accent border border-border-subtle text-[11px] font-mono font-bold">
                +{selectedCustom.items.length - 15} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Reusable Upload & Management Modal */}
      <CustomEntityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectEntity={handleSelectCustomEntity}
        initialSelectedId={selectedCustom?.id}
      />
    </div>
  );
};
