import React, { useState } from 'react';
import { ColumnSpec, ColumnType, DependencyCase } from '../types';
import { RuleEditor } from './RuleEditor';
import { 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  GripVertical,
  AlertCircle, 
  Link2, 
  Sparkles, 
  Hash, 
  Calculator, 
  Clock, 
  Type, 
  ShieldCheck, 
  Binary, 
  Globe,
  Plus,
  GitBranch,
  X,
  HelpCircle
} from 'lucide-react';

const COL_TYPES: { type: ColumnType; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
  { type: 'Sequence', label: 'Sequence (ID)', icon: Hash },
  { type: 'Entity', label: 'Real-world Entity', icon: Globe },
  { type: 'Set/Enum', label: 'Set / Enum', icon: Sparkles },
  { type: 'Int', label: 'Integer Range', icon: Hash },
  { type: 'Float', label: 'Float / Currency', icon: Calculator },
  { type: 'DateTime', label: 'Date & Time', icon: Clock },
  { type: 'UUID', label: 'UUID v4', icon: ShieldCheck },
  { type: 'Calculation', label: 'Formula Calc', icon: Calculator },
  { type: 'Boolean', label: 'Boolean Flag', icon: Binary },
  { type: 'RegEx', label: 'RegEx Pattern', icon: Type },
  { type: 'String', label: 'Random String', icon: Type },
  { type: 'Blob/Hex', label: 'Hex / Hash', icon: Binary },
];

interface Props {
  col: ColumnSpec;
  index: number;
  totalColumns: number;
  columns: ColumnSpec[];
  onUpdate: (updated: ColumnSpec) => void;
  onRemove: (id: string) => void;
  onDuplicate: (col: ColumnSpec) => void;
  dragHandleProps?: any;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

export const ColumnCard: React.FC<Props> = ({
  col,
  index,
  totalColumns,
  columns,
  onUpdate,
  onRemove,
  onDuplicate,
  dragHandleProps,
  onContextMenu
}) => {
  const [showAdvanced, setShowAdvanced] = useState(Boolean(col.condition || (col.skip_pct && col.skip_pct > 0)));
  const otherColumns = columns.filter((c) => c.id !== col.id).map((c) => c.name);

  // Check duplicate name
  const isDuplicateName = columns.some(
    (c) => c.id !== col.id && c.name.trim() === col.name.trim() && col.name.trim() !== ''
  );

  const getDefaultRuleForType = (newType: ColumnType): string => {
    switch (newType) {
      case 'Sequence': return '1';
      case 'Int': return '1, 100';
      case 'Float': return '10.0, 100.0, 2';
      case 'Boolean': return '50';
      case 'Set/Enum': return 'Option A, Option B, Option C';
      case 'Calculation': return '';
      case 'Entity': return 'full_name';
      case 'DateTime': return 'YYYY-MM-DD HH:mm:ss';
      case 'RegEx': return '[A-Z]{3}-\\d{4}';
      case 'Blob/Hex': return '6';
      case 'String': return '12';
      case 'UUID': return '';
      default: return '';
    }
  };

  const currentTypeMeta = COL_TYPES.find((t) => t.type === col.type) || COL_TYPES[0];
  const TypeIcon = currentTypeMeta.icon;

  const handleAddCase = (
    operator: DependencyCase['operator'] = 'equals',
    value = '',
    action: DependencyCase['action'] = 'skip',
    actionValue = '',
    actionType?: ColumnType
  ) => {
    const newCase: DependencyCase = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      parentColumn: col.condition || otherColumns[0] || '',
      operator,
      value,
      action,
      actionValue,
      actionType: actionType || col.type,
    };
    const cases = col.dependencyCases ? [...col.dependencyCases, newCase] : [newCase];
    onUpdate({
      ...col,
      dependencyCases: cases,
      condition: col.condition || newCase.parentColumn || ''
    });
  };

  const handleUpdateCase = (id: string, updates: Partial<DependencyCase>) => {
    if (!col.dependencyCases) return;
    const cases = col.dependencyCases.map((c) => (c.id === id ? { ...c, ...updates } : c));
    onUpdate({ ...col, dependencyCases: cases });
  };

  const handleRemoveCase = (id: string) => {
    if (!col.dependencyCases) return;
    const cases = col.dependencyCases.filter((c) => c.id !== id);
    onUpdate({ ...col, dependencyCases: cases });
  };

  return (
    <div 
      className="group relative flex flex-col p-3 bg-secondary border border-border-subtle hover:border-accent/40 rounded-xl transition-all shadow-xs"
      onContextMenu={(e) => onContextMenu?.(e, col.id)}
    >
      {/* Primary Header Row: Index, Name, Type, Null %, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Reorder, Name & Type */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-[200px]">
          {/* Index & Drag Handle */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="text-[11px] font-mono font-bold text-content-muted w-4 sm:w-5 text-center">
              {index + 1}
            </span>
            <div
              {...dragHandleProps}
              className="p-1 text-content-muted hover:text-accent cursor-grab active:cursor-grabbing transition"
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </div>
          </div>

          {/* Field Name Input */}
          <div className="relative flex-1 min-w-[90px] max-w-[200px]">
            <input
              type="text"
              value={col.name}
              placeholder="field_name"
              onChange={(e) => onUpdate({ ...col, name: e.target.value.replace(/\s+/g, '_') })}
              className={`w-full px-2 py-1 text-xs font-mono font-bold bg-primary border rounded-md text-content focus:outline-none focus:ring-1 focus:ring-accent transition ${
                isDuplicateName ? 'border-rose-500/70' : 'border-border-subtle focus:border-accent'
              }`}
            />
            {isDuplicateName && (
              <span title="Duplicate field name exists in schema" className="absolute right-1.5 top-1.5 text-rose-400">
                <AlertCircle size={12} />
              </span>
            )}
          </div>

          {/* Type Selector Dropdown */}
          <div className="relative flex-shrink-0">
            <select
              value={col.type}
              onChange={(e) => {
                const newType = e.target.value as ColumnType;
                onUpdate({
                  ...col,
                  type: newType,
                  rule: getDefaultRuleForType(newType)
                });
              }}
              className="pl-2 pr-6 py-1 text-xs bg-primary border border-border-subtle rounded-md text-accent font-semibold focus:outline-none focus:border-accent cursor-pointer transition appearance-none max-w-[130px]"
            >
              {COL_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
          </div>
        </div>

        {/* Right: Modifiers & Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto sm:ml-0">
          {/* Null % pill */}
          <div 
            className="flex items-center gap-0.5 bg-primary px-1.5 py-0.5 rounded border border-border-subtle text-[11px]"
            title="Percentage of generated rows where this column will be null"
          >
            <span className="text-[10px] text-content-muted font-medium">Null:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={col.skip_pct || ''}
              placeholder="0"
              onChange={(e) => onUpdate({ ...col, skip_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-6 bg-transparent text-right font-mono font-bold text-content focus:outline-none"
            />
            <span className="text-[10px] text-content-muted font-mono">%</span>
          </div>

          {/* Toggle Dependency / Advanced Button */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-2 py-0.5 rounded text-[11px] transition flex items-center gap-1.5 border ${
              col.condition
                ? 'bg-accent/15 text-accent font-semibold border-accent/40 shadow-xs'
                : 'text-content-muted hover:text-content hover:bg-tertiary border-border-subtle'
            }`}
            title="Configure parent column dependency & conditional cases"
          >
            <Link2 size={12} className={col.condition ? 'text-accent' : 'text-content-muted'} />
            {col.condition ? (
              <span className="font-mono text-[10px] max-w-[80px] truncate">
                {col.condition}
                {col.dependencyCases && col.dependencyCases.length > 0
                  ? ` (${col.dependencyCases.length})`
                  : ''}
              </span>
            ) : (
              <span className="text-[10px]">Depend</span>
            )}
          </button>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={() => onDuplicate(col)}
            title="Duplicate Field"
            className="p-1 text-content-muted hover:text-accent hover:bg-tertiary rounded transition"
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(col.id)}
            title="Remove Field"
            className="p-1 text-content-muted hover:text-rose-400 hover:bg-tertiary rounded transition"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Conditional Dependency Deck if toggled */}
      {showAdvanced && (
        <div className="mt-2.5 p-3 rounded-xl bg-primary border border-border-subtle space-y-3 text-xs shadow-inner">
          {/* Header row: Parent selector & Quick Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <Link2 size={13} />
                Depends on Parent:
              </span>
              <select
                value={col.condition || ''}
                onChange={(e) => {
                  const newParent = e.target.value;
                  onUpdate({
                    ...col,
                    condition: newParent,
                    dependencyCases: (col.dependencyCases || []).map((c) => ({
                      ...c,
                      parentColumn: newParent
                    }))
                  });
                }}
                className="bg-secondary px-2.5 py-1 rounded-md border border-border-subtle text-xs text-content font-mono font-bold focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">None (Independent Field)</option>
                {otherColumns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick action buttons if parent selected */}
            {col.condition && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddCase('equals', '', 'skip')}
                  className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[10px] font-semibold text-content hover:text-rose-400 transition"
                  title="Skip (set NULL) if parent equals specific value"
                >
                  + Skip if = [value]
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCase('equals', '', 'type_override', '', 'Set/Enum')}
                  className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[10px] font-semibold text-content hover:text-accent transition"
                  title="Override type & rule if parent equals specific value"
                >
                  + Case: Type Override
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCase('is_null', '', 'skip')}
                  className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[10px] font-semibold text-content hover:text-amber-400 transition"
                  title="Skip (set NULL) if parent is null"
                >
                  + Skip if NULL
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCase('equals', '', 'set_value', 'N/A')}
                  className="px-2 py-0.5 rounded bg-secondary hover:bg-tertiary border border-border-subtle text-[10px] font-semibold text-content hover:text-emerald-400 transition"
                  title="Set fixed value (e.g. N/A or 0) if parent equals specific value"
                >
                  + Set Value
                </button>
              </div>
            )}
          </div>

          {/* If parent is selected: Show Conditional Cases */}
          {col.condition ? (
            <div className="space-y-2">
              {(!col.dependencyCases || col.dependencyCases.length === 0) ? (
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-dashed border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-content-muted">
                    Default rule: <strong>Skip (NULL)</strong> if <code>{col.condition}</code> is null.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddCase('equals', '', 'skip')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold shadow-xs transition"
                  >
                    <Plus size={11} />
                    <span>Add Case Rule</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {col.dependencyCases.map((depCase, cIdx) => (
                    <div
                      key={depCase.id}
                      className="p-2 rounded-lg bg-secondary border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-accent/40 transition"
                    >
                      {/* Condition Expression */}
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-mono font-bold">
                          CASE {cIdx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-content-muted">IF</span>
                        <span className="text-[11px] font-mono text-content font-bold truncate max-w-[120px]">
                          {col.condition}
                        </span>

                        {/* Operator Selector */}
                        <select
                          value={depCase.operator}
                          onChange={(e) =>
                            handleUpdateCase(depCase.id, {
                              operator: e.target.value as DependencyCase['operator']
                            })
                          }
                          className="bg-primary px-2 py-0.5 rounded border border-border-subtle text-[11px] font-semibold text-accent focus:outline-none cursor-pointer max-w-[130px]"
                        >
                          <option value="equals">= (equals)</option>
                          <option value="not_equals">≠ (not equals)</option>
                          <option value="is_null">is NULL / empty</option>
                          <option value="is_not_null">is NOT NULL</option>
                          <option value="contains">contains</option>
                          <option value="greater_than">&gt; (greater than)</option>
                          <option value="less_than">&lt; (less than)</option>
                        </select>

                        {/* Target Value Input (when not is_null or is_not_null) */}
                        {depCase.operator !== 'is_null' && depCase.operator !== 'is_not_null' && (
                          <input
                            type="text"
                            placeholder="value to match..."
                            value={depCase.value}
                            onChange={(e) => handleUpdateCase(depCase.id, { value: e.target.value })}
                            className="px-2 py-0.5 bg-primary border border-border-subtle rounded text-[11px] font-mono text-content w-24 sm:w-28 focus:w-36 focus:outline-none focus:border-accent transition"
                          />
                        )}

                        <span className="text-[11px] font-bold text-content-muted mx-0.5">THEN</span>

                        {/* Action Selector */}
                        <select
                          value={depCase.action}
                          onChange={(e) =>
                            handleUpdateCase(depCase.id, {
                              action: e.target.value as DependencyCase['action']
                            })
                          }
                          className="bg-primary px-2 py-0.5 rounded border border-border-subtle text-[11px] font-semibold text-content focus:outline-none cursor-pointer"
                        >
                          <option value="skip">Skip (NULL)</option>
                          <option value="type_override">Override Type &amp; Rule</option>
                          <option value="set_value">Set Fixed Value</option>
                        </select>

                        {/* Action Details: Set Fixed Value */}
                        {depCase.action === 'set_value' && (
                          <input
                            type="text"
                            placeholder="e.g. N/A, 0, or null"
                            value={depCase.actionValue || ''}
                            onChange={(e) =>
                              handleUpdateCase(depCase.id, { actionValue: e.target.value })
                            }
                            className="px-2 py-0.5 bg-primary border border-border-subtle rounded text-[11px] font-mono text-emerald-400 font-bold w-24 sm:w-28 focus:w-36 focus:outline-none focus:border-accent"
                          />
                        )}

                        {/* Action Details: Override Type & Rule */}
                        {depCase.action === 'type_override' && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <select
                              value={depCase.actionType || col.type}
                              onChange={(e) =>
                                handleUpdateCase(depCase.id, {
                                  actionType: e.target.value as ColumnType,
                                  actionValue: getDefaultRuleForType(e.target.value as ColumnType)
                                })
                              }
                              className="bg-primary px-1.5 py-0.5 rounded border border-border-subtle text-[10px] font-semibold text-accent focus:outline-none cursor-pointer"
                            >
                              {COL_TYPES.map((t) => (
                                <option key={t.type} value={t.type}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Override rule, e.g. CA, NY, TX"
                              value={depCase.actionValue ?? ''}
                              onChange={(e) =>
                                handleUpdateCase(depCase.id, { actionValue: e.target.value })
                              }
                              className="px-2 py-0.5 bg-primary border border-border-subtle rounded text-[11px] font-mono text-content w-28 sm:w-36 focus:w-44 focus:outline-none focus:border-accent"
                            />
                          </div>
                        )}
                      </div>

                      {/* Remove Case Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveCase(depCase.id)}
                        className="p-1 text-content-muted hover:text-rose-400 hover:bg-tertiary rounded self-end sm:self-center transition"
                        title="Delete this conditional case"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Add Case & Fallback Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border-subtle/50">
                    <button
                      type="button"
                      onClick={() => handleAddCase('equals', '', 'skip')}
                      className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                    >
                      <Plus size={12} />
                      <span>Add another case</span>
                    </button>

                    {/* Fallback Else */}
                    <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                      <span className="text-content-muted font-bold">ELSE:</span>
                      <select
                        value={col.fallbackAction || 'normal'}
                        onChange={(e) =>
                          onUpdate({
                            ...col,
                            fallbackAction: e.target.value as ColumnSpec['fallbackAction']
                          })
                        }
                        className="bg-secondary px-2 py-0.5 rounded border border-border-subtle text-[11px] text-content font-medium focus:outline-none cursor-pointer"
                      >
                        <option value="normal">Generate default field rule</option>
                        <option value="skip">Skip (NULL)</option>
                        <option value="set_value">Set fixed fallback value</option>
                      </select>
                      {col.fallbackAction === 'set_value' && (
                        <input
                          type="text"
                          placeholder="fallback value"
                          value={col.fallbackValue || ''}
                          onChange={(e) => onUpdate({ ...col, fallbackValue: e.target.value })}
                          className="px-2 py-0.5 bg-secondary border border-border-subtle rounded text-[11px] font-mono text-content w-24 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-content-muted italic">
              Select a parent column from the dropdown above to create conditions (e.g. skip if parent is null, or change generation type when parent equals a specific value).
            </p>
          )}
        </div>
      )}

      {/* Rule Editor Row */}
      <div className="mt-2 pt-2 border-t border-border-subtle/40 pl-1 sm:pl-5 pr-1">
        <RuleEditor
          col={col}
          onChange={(rule) => onUpdate({ ...col, rule })}
          availableColumns={otherColumns}
        />
      </div>
    </div>
  );
};
