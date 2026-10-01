import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Hash, 
  Globe, 
  Sparkles, 
  Calculator, 
  Clock, 
  ShieldCheck, 
  Binary, 
  Type, 
  Search, 
  X, 
  ChevronDown, 
  Check, 
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  Zap,
  ListOrdered
} from 'lucide-react';
import { ColumnType } from '../types';
import { useI18n } from '../i18n';
import { getCustomColumnTypes, getExamplePresetTypes, CustomColumnType } from '../utils/customTypesManager';
import { serializeRestApiConfig } from '../utils/restApiManager';

export type TypeCategory = 'all' | 'standard' | 'custom' | 'api' | 'advanced';

export interface TypeOptionItem {
  id: string;
  name: string;
  category: 'standard' | 'custom' | 'api' | 'advanced';
  icon: React.ComponentType<{ size: number; className?: string }>;
  description: string;
  previewExample?: string;
  tags?: string[];
  isCustom?: boolean;
  isActive?: boolean;
  colorClass: string;
  defaultRule?: string;
}

interface Props {
  value: ColumnType;
  onChange: (newType: ColumnType, defaultRule?: string) => void;
  customTypeId?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  onOpenCustomTypeModal?: () => void;
}

export const ColumnTypeSelect: React.FC<Props> = ({
  value,
  onChange,
  customTypeId,
  disabled = false,
  className = '',
  compact = false,
  onOpenCustomTypeModal
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TypeCategory>('all');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
      // Autofocus search on open
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 30);
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Load custom types
  const customTypes = useMemo(() => getCustomColumnTypes(), [isOpen]);
  const examplePresets = useMemo(() => getExamplePresetTypes(), [isOpen]);

  // Default rules helper
  const getDefaultRuleForType = (typeId: string): string => {
    if (typeId.startsWith('custom:') || typeId.startsWith('example:')) {
      const custom = customTypes.find((t) => t.id === typeId) || examplePresets.find((t) => t.id === typeId);
      if (custom) return custom.defaultRule;
    }
    switch (typeId) {
      case 'Sequence': return '1';
      case 'Int': return '1, 100';
      case 'Float': return '10.0, 100.0, 2';
      case 'Boolean': return '50';
      case 'Set/Enum': return 'Option A, Option B, Option C';
      case 'Calculation': return '';
      case 'Entity': return 'full_name';
      case 'REST_API':
        return serializeRestApiConfig({
          url: 'https://dummyjson.com/users?limit=50',
          method: 'GET',
          jsonPath: 'users[].email',
          retrievalMode: 'pool',
          sampleStrategy: 'sequential',
          fallbackValue: 'api_unavailable'
        });
      case 'DateTime': return 'YYYY-MM-DD HH:mm:ss';
      case 'RegEx': return '[A-Z]{3}-\\d{4}';
      case 'Blob/Hex': return '6';
      case 'String': return '12';
      case 'UUID': return '';
      default: return '';
    }
  };

  // Build the complete list of types
  const allTypeOptions: TypeOptionItem[] = useMemo(() => {
    const list: TypeOptionItem[] = [
      // Standard Category
      {
        id: 'Sequence',
        name: t('schema.typeSequence'),
        category: 'standard',
        icon: ListOrdered,
        description: 'Sequential incrementing counter (1, 2, 3...)',
        previewExample: '1, 2, 3, 4',
        tags: ['id', 'counter', 'number', 'auto_increment', 'serial', 'pk'],
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        defaultRule: '1'
      },
      {
        id: 'Int',
        name: t('schema.typeInt'),
        category: 'standard',
        icon: Hash,
        description: 'Random integer within range, normal or uniform distributions',
        previewExample: '42, 108, 999',
        tags: ['number', 'integer', 'range', 'count', 'age', 'quantity'],
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        defaultRule: '1, 100'
      },
      {
        id: 'Float',
        name: t('schema.typeFloat'),
        category: 'standard',
        icon: Calculator,
        description: 'Decimal numbers with precision, currencies, and percentages',
        previewExample: '49.99, 12.50',
        tags: ['decimal', 'currency', 'price', 'rate', 'double'],
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        defaultRule: '10.0, 100.0, 2'
      },
      {
        id: 'String',
        name: t('schema.typeString'),
        category: 'standard',
        icon: Type,
        description: 'Random alphanumeric characters or custom length text',
        previewExample: 'a8F9qK10zL2m',
        tags: ['text', 'random', 'alpha', 'chars', 'token'],
        colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        defaultRule: '12'
      },
      {
        id: 'Boolean',
        name: t('schema.typeBoolean'),
        category: 'standard',
        icon: Binary,
        description: 'True / False boolean flag with configurable true percentage',
        previewExample: 'true / false',
        tags: ['flag', 'binary', 'active', 'enabled', 'is_verified'],
        colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        defaultRule: '50'
      },
      {
        id: 'DateTime',
        name: t('schema.typeDateTime'),
        category: 'standard',
        icon: Clock,
        description: 'Formatted dates, timestamps, ISO 8601, and time offsets',
        previewExample: '2026-09-26 14:30:00',
        tags: ['timestamp', 'calendar', 'time', 'created_at', 'iso'],
        colorClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        defaultRule: 'YYYY-MM-DD HH:mm:ss'
      },
      {
        id: 'Set/Enum',
        name: t('schema.typeSetEnum'),
        category: 'standard',
        icon: Sparkles,
        description: 'Select from custom options list with weighted frequency',
        previewExample: 'Pending, Active, Closed',
        tags: ['enum', 'list', 'choices', 'status', 'category'],
        colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        defaultRule: 'Option A, Option B, Option C'
      },

      // API Category
      {
        id: 'REST_API',
        name: t('schema.typeRestApi'),
        category: 'api',
        icon: Globe,
        description: 'Live remote fetch from REST endpoint, JSONPath, & pooling',
        previewExample: 'Remote JSON endpoint',
        tags: ['http', 'endpoint', 'fetch', 'url', 'json', 'remote', 'service'],
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        defaultRule: serializeRestApiConfig({
          url: 'https://dummyjson.com/users?limit=50',
          method: 'GET',
          jsonPath: 'users[].email',
          retrievalMode: 'pool',
          sampleStrategy: 'sequential',
          fallbackValue: 'api_unavailable'
        })
      },

      // Advanced Category
      {
        id: 'Entity',
        name: t('schema.typeEntity'),
        category: 'advanced',
        icon: Globe,
        description: 'Realistic mock identities: names, emails, phones, addresses, cities',
        previewExample: 'John Doe, john@example.com',
        tags: ['person', 'name', 'email', 'phone', 'address', 'city', 'country', 'company', 'faker'],
        colorClass: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
        defaultRule: 'full_name'
      },
      {
        id: 'Calculation',
        name: t('schema.typeCalculation'),
        category: 'advanced',
        icon: Calculator,
        description: 'Dynamic formula referencing other columns (e.g. price * qty)',
        previewExample: 'col1 * col2 + 10',
        tags: ['formula', 'math', 'computed', 'derived', 'expression'],
        colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        defaultRule: ''
      },
      {
        id: 'UUID',
        name: t('schema.typeUUID'),
        category: 'advanced',
        icon: ShieldCheck,
        description: 'RFC 4122 v4 Universally Unique Identifier string',
        previewExample: 'c4a760a8-dbcf-4355-901d-93',
        tags: ['guid', 'unique', 'hash', 'identifier', 'v4'],
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        defaultRule: ''
      },
      {
        id: 'RegEx',
        name: t('schema.typeRegEx'),
        category: 'advanced',
        icon: Code2,
        description: 'Synthetic strings strictly matching regular expression syntax',
        previewExample: '[A-Z]{3}-\\d{4}',
        tags: ['pattern', 'expression', 'mask', 'license_plate', 'code'],
        colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        defaultRule: '[A-Z]{3}-\\d{4}'
      },
      {
        id: 'Blob/Hex',
        name: t('schema.typeBlobHex'),
        category: 'advanced',
        icon: Binary,
        description: 'Hexadecimal raw byte sequences, checksums, or binary data',
        previewExample: '0x3F8A019C',
        tags: ['binary', 'byte', 'checksum', 'md5', 'raw'],
        colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        defaultRule: '6'
      }
    ];

    // Append custom types: show only enabled ones (plus current selection if deactivated)
    const enabledCustomTypes = customTypes.filter(
      (ct) => ct.isActive !== false || ct.id === value || ct.id === customTypeId
    );

    const customItems: TypeOptionItem[] = enabledCustomTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      category: 'custom' as const,
      icon: Sparkles,
      description: ct.description || `Custom generator (${ct.baseMode || 'Base'})`,
      previewExample: ct.defaultRule ? (ct.defaultRule.length > 25 ? ct.defaultRule.slice(0, 25) + '...' : ct.defaultRule) : undefined,
      tags: ['custom', 'plugin', 'user', ct.baseMode?.toLowerCase() || ''],
      isCustom: true,
      isActive: ct.isActive !== false,
      colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      defaultRule: ct.defaultRule
    }));

    // If current column is using an example preset, keep it visible
    const matchedPreset = examplePresets.find((ep) => ep.id === value || ep.id === customTypeId);
    if (matchedPreset && !customItems.some((ci) => ci.id === matchedPreset.id)) {
      customItems.push({
        id: matchedPreset.id,
        name: matchedPreset.name,
        category: 'custom' as const,
        icon: Zap,
        description: matchedPreset.description || `Preset generator (${matchedPreset.baseMode || 'Base'})`,
        previewExample: matchedPreset.defaultRule,
        tags: ['preset', 'example', matchedPreset.baseMode?.toLowerCase() || ''],
        isCustom: true,
        isActive: true,
        colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
        defaultRule: matchedPreset.defaultRule
      });
    }

    return [...list, ...customItems];
  }, [t, customTypes, examplePresets, value, customTypeId]);

  // Current active item lookup
  const currentItem = useMemo(() => {
    return allTypeOptions.find((o) => o.id === value || o.id === customTypeId) || {
      id: value,
      name: value,
      category: 'standard' as const,
      icon: Sparkles,
      description: '',
      colorClass: 'text-accent bg-accent/10 border-accent/20',
      defaultRule: ''
    };
  }, [allTypeOptions, value, customTypeId]);

  // Filtered items based on Search query & Category tab
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTypeOptions.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (!q) return true;
      const matchName = item.name.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchTags = item.tags ? item.tags.some((tag) => tag.toLowerCase().includes(q)) : false;
      const matchPreview = item.previewExample ? item.previewExample.toLowerCase().includes(q) : false;
      return matchName || matchId || matchDesc || matchTags || matchPreview;
    });
  }, [allTypeOptions, search, selectedCategory]);

  // Grouped options for UI rendering
  const groupedFilteredOptions = useMemo(() => {
    const groups: { category: TypeCategory; label: string; items: TypeOptionItem[] }[] = [
      { category: 'standard', label: t('schema.standardTypes') || 'Standard Types', items: [] },
      { category: 'custom', label: t('schema.customTypesAdvance') || 'Custom Types', items: [] },
      { category: 'api', label: 'REST API & Remote', items: [] },
      { category: 'advanced', label: 'Advanced & Logic', items: [] }
    ];

    filteredOptions.forEach((opt) => {
      const g = groups.find((grp) => grp.category === opt.category);
      if (g) {
        g.items.push(opt);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [filteredOptions, t]);

  // Total count for tabs
  const categoryCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchesSearch = (item: TypeOptionItem) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
      );
    };

    const counts: Record<TypeCategory, number> = {
      all: 0,
      standard: 0,
      custom: 0,
      api: 0,
      advanced: 0
    };

    allTypeOptions.forEach((item) => {
      if (matchesSearch(item)) {
        counts.all++;
        counts[item.category]++;
      }
    });

    return counts;
  }, [allTypeOptions, search]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, selectedCategory]);

  // Handle keyboard navigation inside popup
  const handleKeyDownInMenu = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelectItem(filteredOptions[highlightedIndex]);
      }
    }
  };

  const handleSelectItem = (item: TypeOptionItem) => {
    const rule = item.defaultRule !== undefined ? item.defaultRule : getDefaultRuleForType(item.id);
    onChange(item.id, rule);
    setIsOpen(false);
    setSearch('');
  };

  const CurrentIcon = currentItem.icon;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Badge / Pill Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center justify-between gap-1.5 rounded-md font-medium transition cursor-pointer select-none border text-left ${
          compact
            ? 'px-1.5 py-0.5 text-[10px] min-h-[22px]'
            : 'px-2 py-1 text-xs min-h-[26px] max-w-[150px] sm:max-w-[165px]'
        } ${
          isOpen
            ? 'bg-secondary border-accent text-accent ring-1 ring-accent/30 shadow-xs'
            : 'bg-primary hover:bg-secondary text-content border-border-subtle hover:border-accent/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={`Type: ${currentItem.name} (Click to change)`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 truncate">
          <div className={`p-0.5 rounded ${currentItem.colorClass} shrink-0`}>
            <CurrentIcon size={compact ? 10 : 12} />
          </div>
          <span className="truncate font-semibold text-content group-hover:text-accent transition-colors">
            {currentItem.name}
          </span>
        </div>
        <ChevronDown
          size={11}
          className={`text-content-muted shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-accent' : 'group-hover:text-content'
          }`}
        />
      </button>

      {/* Searchable Categorized Popover Menu */}
      {isOpen && (
        <div 
          onKeyDown={handleKeyDownInMenu}
          className="absolute left-0 top-full mt-1.5 w-[310px] sm:w-[340px] max-h-[460px] flex flex-col bg-secondary border border-border-subtle/80 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
          role="listbox"
        >
          {/* Header Search Bar */}
          <div className="p-2 border-b border-border-subtle bg-primary/40">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-content-muted/70 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search type (e.g. number, uuid, api)..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-card border border-border-subtle rounded-md text-content placeholder:text-content-muted/50 focus:outline-hidden focus:border-accent font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-content-muted hover:text-content p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto no-scrollbar pb-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'standard', label: 'Standard' },
                  { id: 'custom', label: 'Custom' },
                  { id: 'api', label: 'API' },
                  { id: 'advanced', label: 'Advanced' }
                ] as const
              ).map((cat) => {
                const count = categoryCounts[cat.id];
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-accent/15 text-accent border-accent/40 font-semibold shadow-2xs'
                        : 'bg-card/40 text-content-muted hover:text-content hover:bg-card border-border-subtle/60'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[9px] font-mono px-1 rounded-full ${isSelected ? 'bg-accent/20 text-accent' : 'bg-primary text-content-muted/70'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Items List */}
          <div ref={listRef} className="flex-1 overflow-y-auto max-h-[300px] p-1.5 space-y-2">
            {filteredOptions.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Search size={22} className="mx-auto text-content-muted/40 mb-2" />
                <p className="text-xs text-content-muted font-medium">
                  {selectedCategory === 'custom'
                    ? 'No enabled custom types'
                    : 'No matching column types found'}
                </p>
                <p className="text-[11px] text-content-muted/60 mt-1">
                  {selectedCategory === 'custom'
                    ? 'Enable custom types in Custom Types Manager'
                    : 'Try another keyword or create a custom type'}
                </p>
                {selectedCategory === 'custom' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (onOpenCustomTypeModal) {
                        onOpenCustomTypeModal();
                      } else {
                        window.dispatchEvent(new CustomEvent('vampio-open-custom-types'));
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-primary hover:bg-card border border-border-subtle rounded-md text-accent cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Open Custom Types Manager</span>
                  </button>
                ) : search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSelectedCategory('all');
                    }}
                    className="mt-3 px-2.5 py-1 text-xs bg-primary hover:bg-card border border-border-subtle rounded-md text-accent cursor-pointer"
                  >
                    Clear Filter
                  </button>
                ) : null}
              </div>
            ) : (
              groupedFilteredOptions.map((group) => (
                <div key={group.category} className="space-y-0.5">
                  {/* Category Header (when in 'all' view or multiple categories) */}
                  {selectedCategory === 'all' && (
                    <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-content-muted/70 flex items-center justify-between">
                      <span>{group.label}</span>
                      <span className="text-[9px] font-normal">{group.items.length}</span>
                    </div>
                  )}

                  {/* Options inside group */}
                  {group.items.map((opt) => {
                    const isSelected = value === opt.id || customTypeId === opt.id;
                    const flatIndex = filteredOptions.findIndex((o) => o.id === opt.id);
                    const isHighlighted = flatIndex === highlightedIndex;
                    const ItemIcon = opt.icon;

                    return (
                      <div
                        key={opt.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectItem(opt)}
                        onMouseEnter={() => setHighlightedIndex(flatIndex)}
                        className={`group/item flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-accent/15 border border-accent/30 text-accent font-medium'
                            : isHighlighted
                            ? 'bg-tertiary text-content'
                            : 'hover:bg-tertiary/60 text-content'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1 rounded-md shrink-0 border ${opt.colorClass}`}>
                            <ItemIcon size={13} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate text-content group-hover/item:text-accent transition-colors">
                                {opt.name}
                              </span>
                              {opt.isCustom && (
                                <span className="text-[9px] px-1 py-0 rounded bg-violet-500/20 text-violet-300 font-mono font-medium">
                                  Custom
                                </span>
                              )}
                              {opt.isActive === false && (
                                <span className="text-[9px] px-1 py-0 rounded bg-rose-500/20 text-rose-300 font-mono">
                                  Off
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-content-muted truncate max-w-[220px]">
                              {opt.description}
                            </p>
                          </div>
                        </div>

                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-accent text-primary flex items-center justify-center shrink-0">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer Action: Manage Custom Types */}
          <div className="px-2.5 py-1.5 border-t border-border-subtle bg-primary/30 flex items-center justify-between text-[11px]">
            <span className="text-[10px] text-content-muted">
              {filteredOptions.length} available types
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onOpenCustomTypeModal) {
                  onOpenCustomTypeModal();
                } else {
                  window.dispatchEvent(new CustomEvent('vampio-open-custom-types'));
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              <Sparkles size={11} />
              <span>Custom Types Manager</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
