import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Download,
  Upload,
  Sparkles,
  Search,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  Layers,
  FileCode,
  Tag,
  Copy,
  ExternalLink,
  Info,
  HelpCircle,
  Play,
  BookmarkPlus,
  CheckCircle2,
  SlidersHorizontal,
  FolderDown,
  FileSpreadsheet,
  Code,
  Terminal,
  Cpu,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
  Database
} from 'lucide-react';
import { AnimatedTabs, TabItem } from './AnimatedTabs';
import { HighlightedCodeEditor } from './HighlightedCodeEditor';
import { BaseEngineEditor } from './BaseEngineEditor';
import {
  CustomColumnType,
  CustomTypeBaseMode,
  BaseEngineSubtype,
  BaseEngineConfig,
  createDefaultBaseConfig,
  serializeBaseConfig,
  parseBaseConfigFromRule,
  detectBaseSubtype,
  getCustomColumnTypes,
  getExamplePresetTypes,
  saveCustomColumnType,
  deleteCustomColumnType,
  exportCustomColumnTypesJSON,
  importCustomColumnTypes,
  generateCustomTypeValue,
  getCustomTypeSamples,
  installExamplePreset,
  clearAllCustomTypes
} from '../utils/customTypesManager';
import { ColumnSpec } from '../types';

export type CustomTypeModalTab = 'examples' | 'import' | 'create' | 'installed' | 'library';

interface CustomTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddColumnToSchema: (col: Partial<ColumnSpec>) => void;
  setStatusMessage: (msg: string) => void;
  initialTab?: CustomTypeModalTab;
}

const JS_SNIPPETS = [
  {
    label: 'Banking Txn + Luhn',
    desc: 'ISO transaction code with Luhn check digit',
    code: `// ISO Banking Transaction ID with Luhn check digit
const dept = ctx.random.choice(['PAY', 'WIRE', 'ACH', 'REF', 'SETTLE']);
const seq = ctx.utils.pad(ctx.index, 6);
const rawDigits = String(ctx.index) + String(ctx.random.int(1000, 9999));
const check = ctx.utils.luhnChecksum(rawDigits);
return \`\${dept}-\${seq}-\${ctx.random.hex(4).toUpperCase()}-\${check}\`;`
  },
  {
    label: 'Row Context Dependent',
    desc: 'Calculate subtotal from other columns (e.g. qty, price)',
    code: `// Calculates dynamic subtotal based on other columns in this row
const qty = typeof ctx.row.quantity === 'number' ? ctx.row.quantity : ctx.random.int(1, 10);
const unitPrice = typeof ctx.row.price === 'number' ? ctx.row.price : ctx.random.float(15, 299, 2);
const discount = ctx.random.choice([0, 0, 0.05, 0.10, 0.15]);
const subtotal = Number((qty * unitPrice * (1 - discount)).toFixed(2));
return subtotal;`
  },
  {
    label: 'Weighted Distribution',
    desc: 'Select tier or status with custom weights',
    code: `// Select tier with custom weighted probability
const tier = ctx.random.weighted([
  { value: 'Basic', weight: 60 },
  { value: 'Professional', weight: 25 },
  { value: 'Enterprise', weight: 15 }
]);
return tier;`
  },
  {
    label: 'Thai National ID (Mod-11)',
    desc: 'Real 13-digit Thai citizen ID with Modulo 11 check digit',
    code: `// 13-Digit Thai Citizen ID with Modulo-11 Checksum
const first12 = '1' + ctx.random.numeric(11);
const check = ctx.utils.thaiIdChecksum(first12);
return first12 + check;`
  },
  {
    label: 'Security Token Hash',
    desc: 'Cryptographic identity token with FNV hash check',
    code: `// Security audit token with hash check
const role = ctx.random.choice(['ADM', 'DEV', 'AUD', 'SVC']);
const raw = \`\${role}_\${ctx.index}_\${Date.now()}\`;
const hash = ctx.utils.hash(raw).slice(0, 6).toUpperCase();
return \`TOK_\${role}_\${ctx.utils.pad(ctx.index, 4)}_\${hash}\`;`
  }
];

const LUA_SNIPPETS = [
  {
    label: 'Banking Txn + Luhn',
    desc: 'Transaction code with Luhn check digit in Lua 5.3',
    code: `-- Banking Transaction ID in Lua 5.3
local dept = random.choice({"PAY", "WIRE", "ACH", "REF"})
local seq = utils.pad(ctx.index, 6)
local rawDigits = string.format("%d%04d", ctx.index, random.int(1000, 9999))
local check = utils.luhn(rawDigits)
return string.format("%s-%s-%s-%d", dept, seq, random.hex(4):upper(), check)`
  },
  {
    label: 'Thai ID Modulo 11',
    desc: 'Full 13-digit Thai ID algorithm in Lua',
    code: `-- Thai Citizen ID with Modulo-11 in Lua 5.3
local digits = {1}
for i = 2, 12 do
  digits[i] = random.int(0, 9)
end
local sum = 0
for i = 1, 12 do
  sum = sum + digits[i] * (14 - i)
end
local check = (11 - (sum % 11)) % 10
digits[13] = check
return table.concat(digits)`
  },
  {
    label: 'Row Context Logic',
    desc: 'Read other row columns and compute total in Lua',
    code: `-- Access other columns in rowContext via ctx.row
local qty = ctx.row.quantity or random.int(1, 10)
local price = ctx.row.price or random.float(10.0, 150.0, 2)
local taxRate = 0.07
local total = math.floor((qty * price * (1 + taxRate)) * 100 + 0.5) / 100
return total`
  },
  {
    label: 'Hex Color & Contrast',
    desc: 'Calculate luminance and tone in Lua',
    code: `-- Hex Color with Luminance Classification in Lua
local r = random.int(0, 255)
local g = random.int(0, 255)
local b = random.int(0, 255)
local hex = string.format("#%02X%02X%02X", r, g, b)
local lum = 0.299 * r + 0.587 * g + 0.114 * b
local tone = lum > 128 and "LIGHT" or "DARK"
return string.format("%s (%s)", hex, tone)`
  },
  {
    label: 'Formatted Serial',
    desc: 'Multi-segment serial with UUID in Lua',
    code: `-- Formatted Serial with UUID in Lua
local env = random.choice({"PROD", "STG", "DEV"})
local id = string.sub(random.uuid(), 1, 8):upper()
return string.format("%s-%05d-%s", env, ctx.index, id)`
  }
];

export const CustomTypeModal: React.FC<CustomTypeModalProps> = ({
  isOpen,
  onClose,
  onAddColumnToSchema,
  setStatusMessage,
  initialTab = 'examples'
}) => {
  const [activeTab, setActiveTab] = useState<'examples' | 'import' | 'create' | 'installed'>('examples');
  const [types, setTypes] = useState<CustomColumnType[]>([]);
  const [examplePresets, setExamplePresets] = useState<CustomColumnType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Example preview sample state
  const [exampleSampleMap, setExampleSampleMap] = useState<Record<string, string[]>>({});

  // Create/Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeCategory, setTypeCategory] = useState<CustomColumnType['category']>('Custom');
  const [typeBaseMode, setTypeBaseMode] = useState<CustomTypeBaseMode>('Base');
  const [typeBaseSubtype, setTypeBaseSubtype] = useState<BaseEngineSubtype>('Int');
  const [typeBaseConfig, setTypeBaseConfig] = useState<BaseEngineConfig>(() => createDefaultBaseConfig('Int'));
  const [typeRule, setTypeRule] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [liveTestSamples, setLiveTestSamples] = useState<string[]>([]);
  const [benchmarkResult, setBenchmarkResult] = useState<{ timeMs: number; error: string | null }>({
    timeMs: 0,
    error: null
  });
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);

  // Import state
  const [importJsonText, setImportJsonText] = useState('');
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = () => {
    const installed = getCustomColumnTypes();
    setTypes(installed);
    const examples = getExamplePresetTypes();
    setExamplePresets(examples);
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      // Map initialTab to supported tab
      if (initialTab === 'library') {
        const installed = getCustomColumnTypes();
        setActiveTab(installed.length > 0 ? 'installed' : 'examples');
      } else if (initialTab === 'import' || initialTab === 'create' || initialTab === 'installed' || initialTab === 'examples') {
        setActiveTab(initialTab);
      } else {
        setActiveTab('examples');
      }
      setImportNotice(null);
    }
  }, [isOpen, initialTab]);

  // Roll sample for an individual example
  const handleRollExampleSample = (example: CustomColumnType) => {
    const samples = getCustomTypeSamples(example, 2);
    setExampleSampleMap(prev => ({ ...prev, [example.id]: samples }));
  };

  // Update live test samples when form changes with simulated row context
  const runLiveTest = (
    mode = typeBaseMode,
    rule = typeRule,
    subtype = typeBaseSubtype,
    baseConfig = typeBaseConfig
  ) => {
    const tempType: CustomColumnType = {
      id: 'temp',
      name: typeName || 'Test Type',
      category: typeCategory,
      baseMode: mode,
      baseSubtype: mode === 'Base' ? subtype : undefined,
      baseConfig: mode === 'Base' ? baseConfig : undefined,
      defaultRule: rule,
      description: '',
      createdAt: Date.now()
    };
    const t0 = performance.now();
    let errorMsg: string | null = null;
    try {
      const samples: string[] = [];
      for (let i = 0; i < 4; i++) {
        // Provide mock row context for testing dependent columns
        const mockRow: Record<string, unknown> = {
          id: i + 1,
          quantity: (i + 1) * 2,
          price: 24.5 * (i + 1),
          status: i % 2 === 0 ? 'Active' : 'Pending',
          category: ['Electronics', 'Books', 'Home', 'Apparel'][i]
        };
        const val = generateCustomTypeValue(tempType, rule, { rowIndex: i, row: mockRow });
        const valStr = val === null || val === undefined ? '' : String(val);
        if (valStr.startsWith('[JS Error:') || valStr.startsWith('[Lua Error:')) {
          errorMsg = valStr;
        }
        samples.push(valStr);
      }
      const t1 = performance.now();
      setBenchmarkResult({ timeMs: Number((t1 - t0).toFixed(2)), error: errorMsg });
      setLiveTestSamples(samples);
    } catch (err: any) {
      setBenchmarkResult({ timeMs: 0, error: err?.message || String(err) });
      setLiveTestSamples(['[Evaluation error]']);
    }
  };

  useEffect(() => {
    if (activeTab === 'create' && (typeRule || typeBaseMode === 'Base')) {
      runLiveTest(typeBaseMode, typeRule, typeBaseSubtype, typeBaseConfig);
    }
  }, [typeRule, typeBaseMode, typeBaseSubtype, typeBaseConfig, activeTab]);

  const handleStartCreate = (defaultMode: CustomTypeBaseMode = 'Base') => {
    setEditingId(null);
    setTypeName('');
    setTypeCategory('Custom');
    const isLegacy = defaultMode === 'RegEx' || defaultMode === 'Set/Enum' || defaultMode === 'Int' || defaultMode === 'Float' || defaultMode === 'Sequence';
    const effectiveMode = isLegacy ? 'Base' : defaultMode;
    setTypeBaseMode(effectiveMode);

    let initialSubtype: BaseEngineSubtype = 'Int';
    let initialCfg: BaseEngineConfig = createDefaultBaseConfig('Int');
    let initialRule = '';

    if (effectiveMode === 'Base') {
      initialSubtype = isLegacy ? (defaultMode as BaseEngineSubtype) : 'Int';
      initialCfg = createDefaultBaseConfig(initialSubtype);
      setTypeBaseSubtype(initialSubtype);
      setTypeBaseConfig(initialCfg);
      initialRule = serializeBaseConfig(initialCfg);
    } else if (effectiveMode === 'Template') {
      initialRule = 'SKU-{SET:ELEC,APPAREL,HOME}-{NUM:4}';
    } else if (effectiveMode === 'Script') {
      initialRule = `// JavaScript Generator Script
// Available: ctx.index, ctx.row, ctx.random, ctx.utils
const dept = ctx.random.choice(['PAY', 'WIRE', 'ACH', 'REF']);
const seq = ctx.utils.pad(ctx.index, 6);
const check = ctx.utils.luhnChecksum(seq);
return \`\${dept}-\${seq}-\${check}\`;`;
    } else if (effectiveMode === 'Lua') {
      initialRule = `-- Lua 5.3 Generator Script
-- Available: ctx.index, ctx.row, random, utils, math, string, table
local prefix = random.choice({"SYS", "USR", "AUDIT"})
local code = string.format("%s_%05d_%s", prefix, ctx.index, random.hex(4):upper())
return code`;
    }

    setTypeRule(initialRule);
    setTypeDescription('');
    runLiveTest(effectiveMode, initialRule, initialSubtype, initialCfg);
    setActiveTab('create');
  };

  const handleStartEdit = (t: CustomColumnType) => {
    setEditingId(t.id);
    setTypeName(t.name);
    setTypeCategory(t.category);
    const isLegacy = t.baseMode === 'RegEx' || t.baseMode === 'Set/Enum' || t.baseMode === 'Int' || t.baseMode === 'Float' || t.baseMode === 'Sequence';
    const effectiveMode = isLegacy ? 'Base' : t.baseMode;
    const effectiveSubtype: BaseEngineSubtype = t.baseSubtype || (isLegacy ? (t.baseMode as BaseEngineSubtype) : detectBaseSubtype(t.defaultRule));
    const effectiveConfig = t.baseConfig || parseBaseConfigFromRule(t.defaultRule, effectiveSubtype);

    setTypeBaseMode(effectiveMode);
    setTypeBaseSubtype(effectiveSubtype);
    setTypeBaseConfig(effectiveConfig);
    setTypeRule(t.defaultRule);
    setTypeDescription(t.description);
    runLiveTest(effectiveMode, t.defaultRule, effectiveSubtype, effectiveConfig);
    setActiveTab('create');
  };

  const handleSaveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) {
      alert('Please enter a type name.');
      return;
    }

    const id = editingId || `custom:${typeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;

    const testType: CustomColumnType = {
      id,
      name: typeName.trim(),
      category: typeCategory,
      baseMode: typeBaseMode,
      baseSubtype: typeBaseMode === 'Base' ? typeBaseSubtype : undefined,
      baseConfig: typeBaseMode === 'Base' ? typeBaseConfig : undefined,
      defaultRule: typeRule.trim(),
      description: typeDescription.trim(),
      createdAt: Date.now()
    };
    const sampleOutputs = getCustomTypeSamples(testType, 3);

    const fullType: CustomColumnType = {
      ...testType,
      sampleOutputs
    };

    saveCustomColumnType(fullType);
    refreshList();
    setStatusMessage(`Saved column type "${fullType.name}" to registry`);
    setActiveTab('installed');
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove column type "${name}" from your custom types?`)) {
      deleteCustomColumnType(id);
      refreshList();
      setStatusMessage(`Deleted custom type "${name}"`);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all installed custom types? Your active schema will not be lost.')) {
      clearAllCustomTypes();
      refreshList();
      setStatusMessage('Cleared all installed custom types');
    }
  };

  const handleInstallExample = (example: CustomColumnType) => {
    installExamplePreset(example);
    refreshList();
    setStatusMessage(`Added "${example.name}" to your custom types`);
  };

  const handleAddColumnDirectly = (t: CustomColumnType) => {
    if (t.id.startsWith('example:')) {
      installExamplePreset(t);
      refreshList();
    }

    const colName = t.name
      .toLowerCase()
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    onAddColumnToSchema({
      name: colName || 'custom_field',
      type: t.id,
      rule: t.defaultRule,
      customTypeId: t.id,
      notes: `${t.name} (${t.category})`
    });

    setStatusMessage(`Added field "${colName}" of type "${t.name}" to schema`);
    onClose();
  };

  const handleExportAll = () => {
    const jsonStr = exportCustomColumnTypesJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vampio_column_types_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Exported custom column types as JSON');
  };

  const handleImportText = () => {
    if (!importJsonText.trim()) return;
    const result = importCustomColumnTypes(importJsonText);
    if (result.errors.length > 0 && result.imported === 0 && result.updated === 0) {
      setImportNotice({ type: 'error', message: result.errors.join('. ') });
    } else {
      setImportNotice({
        type: 'success',
        message: `Successfully imported ${result.imported} new types and updated ${result.updated} existing types!`
      });
      refreshList();
      setStatusMessage(`Imported ${result.imported + result.updated} column types`);
      setImportJsonText('');
      setActiveTab('installed');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = importCustomColumnTypes(content);
      if (result.errors.length > 0 && result.imported === 0 && result.updated === 0) {
        setImportNotice({ type: 'error', message: result.errors.join('. ') });
      } else {
        setImportNotice({
          type: 'success',
          message: `Loaded ${file.name}: ${result.imported} new types imported, ${result.updated} updated!`
        });
        refreshList();
        setStatusMessage(`Imported column types from "${file.name}"`);
        setActiveTab('installed');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopySampleJson = () => {
    const sample = JSON.stringify(
      [
        {
          name: "Customer Loyalty Tier",
          category: "Commerce",
          baseMode: "Set/Enum",
          defaultRule: "Bronze, Silver, Gold, Platinum, Diamond",
          description: "Customer tier status rank"
        },
        {
          name: "Order Tracking Code",
          category: "Commerce",
          baseMode: "Template",
          defaultRule: "TRK-#{SET:TH,US,SG}#-#{INT:100000,999999}#",
          description: "Shipping tracking barcode code"
        }
      ],
      null,
      2
    );
    navigator.clipboard.writeText(sample);
    setStatusMessage('Copied sample JSON schema format to clipboard');
  };

  const categories = ['All', 'Scripting', 'Identity', 'Finance', 'Telecom', 'Commerce', 'Security', 'Network', 'Custom'];

  const isInstalled = (id: string, name: string) => {
    return types.some(
      (t) => t.id === id || t.id.replace('custom:', '') === id.replace('example:', '') || t.name === name
    );
  };

  const filteredExamples = examplePresets.filter((t) => {
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.defaultRule.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.baseMode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredInstalled = types.filter((t) => {
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.defaultRule.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.baseMode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getModeBadgeClass = (mode: string) => {
    if (mode === 'Lua') return 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
    if (mode === 'Script') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    if (mode === 'Template') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
  };

  const getModeLabel = (item: CustomColumnType) => {
    if (item.baseMode === 'Base') {
      return item.baseSubtype ? `Base: ${item.baseSubtype}` : 'Base Engine';
    }
    if (item.baseMode === 'RegEx' || item.baseMode === 'Set/Enum' || item.baseMode === 'Int' || item.baseMode === 'Float' || item.baseMode === 'Sequence') {
      return `Base: ${item.baseMode}`;
    }
    return item.baseMode;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="bg-secondary border border-border-subtle w-full max-w-4xl h-[90vh] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-content"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border-subtle bg-primary/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 text-accent border border-accent/25 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-content">Custom Column Type Studio</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-accent/15 text-accent border border-accent/30 font-semibold">
                  Advance Studio
                </span>
              </div>
              <p className="text-xs text-content-muted">
                Explore example generators, import custom JSON schemas, or build your own column rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Studio Sub-Navigation Tabs */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-border-subtle bg-secondary flex-shrink-0 gap-2 flex-wrap">
          <AnimatedTabs
            tabs={[
              { id: 'examples', label: 'Examples (ตัวอย่าง)', icon: <Sparkles size={13} />, badge: examplePresets.length },
              { id: 'import', label: 'Import & Manage (หน้าจัดการ)', icon: <Upload size={13} /> },
              { id: 'create', label: editingId ? 'Edit Type' : 'Create Type', icon: <Plus size={13} /> },
              { id: 'installed', label: 'My Types', icon: <Layers size={13} />, badge: types.length },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => {
              if (tabId === 'create') {
                handleStartCreate();
              } else {
                setActiveTab(tabId);
              }
            }}
            layoutId="custom-type-studio-tabs"
            variant="pill"
            size="sm"
          />

          <div className="flex items-center gap-2">
            {types.length > 0 && (
              <button
                type="button"
                onClick={handleExportAll}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary hover:bg-tertiary border border-border-subtle text-content flex items-center gap-1.5 transition cursor-pointer"
                title="Download all installed types as JSON"
              >
                <Download size={12} className="text-accent" />
                <span>Export JSON</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: Examples & Presets (ตัวอย่าง) */}
        {activeTab === 'examples' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Header / Description Banner */}
            <div className="px-4 py-2.5 bg-accent/5 border-b border-border-subtle/70 flex items-center justify-between text-xs text-content-muted">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-accent flex-shrink-0" />
                <span>
                  Preset examples are kept separate so your schema remains clean. Choose any example to add to your custom types or directly apply to your schema.
                </span>
              </div>
            </div>

            {/* Search & Category Filter */}
            <div className="p-3 sm:p-4 border-b border-border-subtle flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-primary/20 flex-shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Search examples (e.g. Thai ID, Mobile, Wallet, SKU)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-primary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>

              {/* Category Filter Pills */}
              <AnimatedTabs
                tabs={categories.map((c) => ({ id: c, label: c }))}
                activeTab={selectedCategory}
                onChange={(cat) => setSelectedCategory(cat)}
                layoutId="example-categories-filter"
                variant="chip"
                size="xs"
              />
            </div>

            {/* Example Presets Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredExamples.map((ex) => {
                  const installed = isInstalled(ex.id, ex.name);
                  const samples = exampleSampleMap[ex.id] || ex.sampleOutputs || getCustomTypeSamples(ex, 2);

                  return (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded-xl bg-primary border border-border-subtle hover:border-accent/40 transition flex flex-col justify-between shadow-2xs group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-xs font-bold text-content">{ex.name}</h3>
                              {installed && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                                  <Check size={10} /> Installed
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-content-muted line-clamp-1 mt-0.5">
                              {ex.description}
                            </p>
                          </div>

                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-secondary border border-border-subtle text-accent font-semibold flex-shrink-0">
                            {ex.category}
                          </span>
                        </div>

                        {/* Rule spec snippet */}
                        <div className="p-2 rounded-lg bg-secondary/80 border border-border-subtle font-mono text-[11px] text-content-muted flex items-center justify-between">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getModeBadgeClass(ex.baseMode)}`}>
                            {getModeLabel(ex)}
                          </span>
                          <span className="truncate max-w-[200px] text-accent font-mono text-[11px]" title={ex.defaultRule}>
                            {ex.baseMode === 'Script' || ex.baseMode === 'Lua'
                              ? `${ex.defaultRule.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('--'))[0] || 'Custom Script'}`
                              : ex.defaultRule}
                          </span>
                        </div>

                        {/* Live sample outputs */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-content-muted">
                              Sample Output:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRollExampleSample(ex)}
                              className="text-[10px] text-accent hover:underline flex items-center gap-1"
                            >
                              <RefreshCw size={9} /> Roll sample
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {samples.map((s, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary border border-border-subtle text-content truncate max-w-[220px]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action footer */}
                      <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between gap-2">
                        {!installed ? (
                          <button
                            type="button"
                            onClick={() => handleInstallExample(ex)}
                            className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold flex items-center gap-1.5 transition"
                            title="Add to My Custom Types registry"
                          >
                            <BookmarkPlus size={12} className="text-accent" />
                            <span>Add to My Types</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} /> Ready in registry
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAddColumnDirectly(ex)}
                          className="px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                          title="Insert this field directly into the active table schema"
                        >
                          <Plus size={12} />
                          <span>Use in Schema</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Footer */}
            <div className="p-3 border-t border-border-subtle bg-secondary flex items-center justify-between text-xs text-content-muted flex-shrink-0">
              <span className="text-[11px]">
                Showing {filteredExamples.length} of {examplePresets.length} ready-to-use template examples
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('import')}
                  className="text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  <Upload size={11} /> Go to Import Manager
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Import & Management (หน้าจัดการสำหรับ import) */}
        {activeTab === 'import' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Notice Banner */}
              {importNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    importNotice.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <span>{importNotice.message}</span>
                  <button
                    type="button"
                    onClick={() => setImportNotice(null)}
                    className="p-1 hover:opacity-75"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* 1. File Upload Card */}
              <div className="p-4 rounded-xl bg-primary border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-content flex items-center gap-1.5">
                    <FolderDown size={14} className="text-accent" />
                    <span>Upload Schema File (.json)</span>
                  </h3>
                  <span className="text-[10px] text-content-muted font-mono bg-secondary px-2 py-0.5 rounded border border-border-subtle">
                    Drag & Drop or Select
                  </span>
                </div>
                <p className="text-xs text-content-muted leading-relaxed">
                  Upload a previously exported custom type bundle or shared definition JSON file. Existing types with matching IDs will be safely updated.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 border-2 border-dashed border-border-subtle hover:border-accent/50 rounded-xl bg-secondary/50 hover:bg-secondary transition cursor-pointer flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <Upload size={20} className="text-accent" />
                  <div className="text-xs font-semibold text-content">Click to select or drop a JSON file here</div>
                  <div className="text-[11px] text-content-muted">Supports array of CustomColumnType or `{'{ column_types: [...] }'}`</div>
                </div>
              </div>

              {/* 2. Paste JSON Card */}
              <div className="p-4 rounded-xl bg-primary border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-content flex items-center gap-1.5">
                    <FileCode size={14} className="text-accent" />
                    <span>Paste Raw JSON Definition</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopySampleJson}
                    className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    <Copy size={11} /> Copy Sample Format
                  </button>
                </div>
                <p className="text-xs text-content-muted leading-relaxed">
                  Directly paste an array of column type definitions or a single object:
                </p>

                <textarea
                  rows={5}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={`[
  {
    "name": "Customer Loyalty Tier",
    "category": "Commerce",
    "baseMode": "Set/Enum",
    "defaultRule": "Bronze, Silver, Gold, Platinum, Diamond",
    "description": "Customer tier status rank"
  }
]`}
                  className="w-full p-2.5 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!importJsonText.trim()}
                    onClick={handleImportText}
                    className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <Check size={13} />
                    <span>Validate & Import Types</span>
                  </button>
                </div>
              </div>

              {/* 3. Registry Management & Maintenance */}
              <div className="p-4 rounded-xl bg-primary border border-border-subtle space-y-2">
                <h3 className="text-xs font-bold text-content flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-accent" />
                  <span>Installed Types Maintenance</span>
                </h3>
                <p className="text-xs text-content-muted leading-relaxed">
                  Currently, you have <strong className="text-content">{types.length}</strong> custom column types installed in your registry.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {types.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportAll}
                      className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content transition flex items-center gap-1.5"
                    >
                      <Download size={13} className="text-accent" />
                      <span>Backup All Installed Types (JSON)</span>
                    </button>
                  )}

                  {types.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-400 transition flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>Clear Registry (Reset to 0)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('examples')}
                    className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-accent transition flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    <span>Browse Preset Examples (ตัวอย่าง)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Create / Edit Type */}
        {activeTab === 'create' && (
          <form onSubmit={handleSaveType} className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Type Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-content flex items-center gap-1">
                    <span>Type Name</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Thai National ID, Crypto Wallet, SKU"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-primary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-content-muted">
                    Display name shown in column type selector
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-content">Category</label>
                  <select
                    value={typeCategory}
                    onChange={(e) => setTypeCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-primary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {categories.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-content-muted">Organizes this type in category lists</p>
                </div>
              </div>

              {/* Base Generation Mode Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-content flex items-center gap-1.5">
                    <Cpu size={14} className="text-accent" />
                    <span>Generator Engine Mode</span>
                  </label>
                  <span className="text-[11px] text-accent font-mono font-semibold">
                    Engine: {typeBaseMode === 'Base' ? `Base (${typeBaseSubtype})` : typeBaseMode}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      mode: 'Base' as const,
                      label: 'Base Engine',
                      badge: 'Core Primitives',
                      desc: 'RegEx patterns, Enum pools, Number ranges & Sequences',
                      icon: <Database size={13} className="text-sky-400" />
                    },
                    {
                      mode: 'Template' as const,
                      label: 'Smart Template',
                      badge: 'Dynamic Tokens',
                      desc: 'Tokens: {INT}, {SET}, {NUM}, {HEX}, {UUID}, {row.col}',
                      icon: <SlidersHorizontal size={13} className="text-emerald-400" />
                    },
                    {
                      mode: 'Script' as const,
                      label: 'JavaScript',
                      badge: 'ES6+ Sandbox',
                      desc: 'ctx.row, ctx.random, ctx.utils, math, checksums',
                      icon: <Code size={13} className="text-amber-400" />
                    },
                    {
                      mode: 'Lua' as const,
                      label: 'Lua 5.3',
                      badge: 'Native VM',
                      desc: 'Lua tables, math, random, luhn check digit',
                      icon: <Terminal size={13} className="text-indigo-400" />
                    },
                  ].map((item) => {
                    const isActive = typeBaseMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => {
                          const newMode = item.mode;
                          setTypeBaseMode(newMode);
                          if (newMode === 'Base') {
                            if (!typeRule || typeRule.includes('ctx.') || typeRule.includes('local ') || typeRule.includes('{SET:')) {
                              setTypeBaseSubtype('RegEx');
                              setTypeRule('[A-Z]{3}-\\d{4}');
                            }
                          } else if (newMode === 'Template') {
                            if (!typeRule || typeRule.includes('ctx.') || typeRule.includes('local ') || typeRule.startsWith('[')) {
                              setTypeRule('SKU-{SET:ELEC,APPAREL,HOME}-{NUM:4}');
                            }
                          } else if (newMode === 'Script' && (!typeRule || !typeRule.includes('ctx'))) {
                            setTypeRule(`// JavaScript Column Generator
// Available: ctx.index, ctx.row, ctx.random, ctx.utils
const dept = ctx.random.choice(['PAY', 'WIRE', 'ACH', 'REF']);
const seq = ctx.utils.pad(ctx.index, 6);
const check = ctx.utils.luhnChecksum(seq);
return \`\${dept}-\${seq}-\${check}\`;`);
                          } else if (newMode === 'Lua' && (!typeRule || !typeRule.includes('local'))) {
                            setTypeRule(`-- Lua 5.3 Column Generator
-- Available: ctx.index, ctx.row, random, utils, math, string, table
local dept = random.choice({"PAY", "WIRE", "ACH", "REF"})
local seq = utils.pad(ctx.index, 6)
local check = utils.luhn(seq)
return string.format("%s-%s-%d", dept, seq, check)`);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer select-none ${
                          isActive
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-primary/80 border-border-subtle text-content-muted hover:text-content hover:bg-tertiary/60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            {item.icon}
                            <span>{item.label}</span>
                          </span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold uppercase ${isActive ? 'bg-white/20 text-white' : 'bg-secondary text-content-muted border border-border-subtle'}`}>
                            {item.badge}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-1 line-clamp-2 leading-tight ${isActive ? 'text-white/85' : 'text-content-muted'}`}>
                          {item.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Specific Editors */}
              {typeBaseMode === 'Base' ? (
                /* Consolidated Base Engine Editor with In-Depth Advanced Settings */
                <BaseEngineEditor
                  subtype={typeBaseSubtype}
                  onSubtypeChange={(st) => {
                    setTypeBaseSubtype(st);
                  }}
                  config={typeBaseConfig}
                  onChangeConfig={(cfg) => {
                    setTypeBaseConfig(cfg);
                    setTypeRule(serializeBaseConfig(cfg));
                  }}
                  rule={typeRule}
                  onRuleChange={(newRule) => {
                    setTypeRule(newRule);
                  }}
                />
              ) : typeBaseMode === 'Template' ? (
                /* Smart Template Engine Editor */
                <div className="space-y-3 p-3.5 rounded-xl bg-primary border border-border-subtle">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                    <label className="text-xs font-bold text-content flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-emerald-400" />
                      <span>Smart Template Pattern (Fully Offline Dynamic Engine)</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                      Supports {'{TOKEN}'}, #{'{TOKEN}'}#, {'{{TOKEN}}'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-content flex items-center gap-1">
                        <span>Template Expression</span>
                        <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-[10px] text-content-muted font-mono">
                        Mix literal text with dynamic tokens
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={typeRule}
                      onChange={(e) => setTypeRule(e.target.value)}
                      placeholder="SKU-{SET:ELEC,APPAREL,HOME}-{NUM:4} or TRK-{YEAR}-{SEQ:5}"
                      className="w-full px-3 py-2 text-xs font-mono bg-secondary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* Interactive Quick Token Insertion Chips */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-content-muted flex items-center justify-between">
                      <span>Click token to append to template:</span>
                      <span className="text-[9px] text-emerald-400 font-mono">Instant live preview</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { token: '{INT:100,999}', label: 'Int Range', desc: 'Random int between 100 and 999' },
                        { token: '{SET:US,EU,APAC}', label: 'Set Choice', desc: 'Pick from list' },
                        { token: '{NUM:4}', label: 'Digits', desc: 'Random 4 digits' },
                        { token: '{HEX:4}', label: 'Hex', desc: 'Random hex string' },
                        { token: '{ALPHA:3}', label: 'Letters', desc: 'Uppercase letters' },
                        { token: '{SEQ:5}', label: 'Sequence', desc: '00001, 00002...' },
                        { token: '{UUID}', label: 'UUID', desc: 'UUID v4' },
                        { token: '{YEAR}', label: 'Year', desc: 'Current year' },
                        { token: '{DATE}', label: 'Date', desc: 'YYYY-MM-DD' },
                        { token: '{FULL_NAME}', label: 'Full Name', desc: 'Realistic person name' },
                        { token: '{EMAIL}', label: 'Email', desc: 'Mock user email' },
                        { token: '{row.category}', label: 'Row Col', desc: 'Value of another column' },
                      ].map(chip => (
                        <button
                          key={chip.token}
                          type="button"
                          title={chip.desc}
                          onClick={() => {
                            setTypeRule(prev => prev ? `${prev}-${chip.token}` : chip.token);
                          }}
                          className="px-2 py-1 rounded-md text-[11px] font-mono bg-secondary hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-border-subtle text-content hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={10} className="text-emerald-400" />
                          <span>{chip.token}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Script / Code Editor for JS and Lua */
                <div className="space-y-2 p-3.5 rounded-xl bg-primary border border-border-subtle">
                  {/* Script Studio Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-content flex items-center gap-1.5">
                        {typeBaseMode === 'Script' ? (
                          <>
                            <Code size={14} className="text-amber-400" />
                            <span>JavaScript Script Editor</span>
                          </>
                        ) : (
                          <>
                            <Terminal size={14} className="text-indigo-400" />
                            <span>Lua 5.3 Script Editor</span>
                          </>
                        )}
                      </span>

                      {/* Benchmark & Diagnostics Badge */}
                      {benchmarkResult.error ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-semibold">
                          <AlertCircle size={10} /> Runtime Error
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                          <CheckCircle2 size={10} /> Executed in {benchmarkResult.timeMs}ms
                        </span>
                      )}
                    </div>

                    {/* Context Reference Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsCheatSheetOpen(!isCheatSheetOpen)}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium bg-secondary px-2.5 py-1 rounded-lg border border-border-subtle hover:bg-tertiary transition"
                    >
                      <BookOpen size={12} />
                      <span>Context Cheat Sheet (ctx)</span>
                      {isCheatSheetOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {/* Quick Code Templates / Snippets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1">
                      <Zap size={11} className="text-amber-400" /> Quick Templates:
                    </span>
                    {(typeBaseMode === 'Script' ? JS_SNIPPETS : LUA_SNIPPETS).map((snip) => (
                      <button
                        key={snip.label}
                        type="button"
                        onClick={() => {
                          setTypeRule(snip.code);
                          runLiveTest(typeBaseMode, snip.code, typeBaseSubtype);
                        }}
                        title={snip.desc}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-secondary hover:bg-tertiary border border-border-subtle text-content transition hover:border-accent/40"
                      >
                        {snip.label}
                      </button>
                    ))}
                  </div>

                  {/* Collapsible Context Cheat Sheet */}
                  {isCheatSheetOpen && (
                    <div className="p-3 rounded-lg bg-secondary/80 border border-border-subtle text-xs space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="font-bold text-[11px] text-accent uppercase tracking-wider flex items-center justify-between">
                        <span>Available Execution Sandbox Context Variables & Functions</span>
                        <span className="font-mono text-[10px] text-content-muted">
                          {typeBaseMode === 'Script' ? 'JS ES6 Sandbox' : 'Lua 5.3 Global Environment'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-2 rounded bg-primary/80 border border-border-subtle space-y-1">
                          <div className="font-bold text-amber-400 font-sans text-[11px]">Row & State Data</div>
                          <div className="text-content-muted"><strong className="text-content">ctx.index</strong>: Current row 1-based number (1, 2, 3...)</div>
                          <div className="text-content-muted"><strong className="text-content">ctx.row</strong>: Other columns in current row (e.g. <code className="text-accent">{typeBaseMode === 'Script' ? 'ctx.row.quantity' : 'ctx.row.quantity'}</code>)</div>
                        </div>

                        <div className="p-2 rounded bg-primary/80 border border-border-subtle space-y-1">
                          <div className="font-bold text-indigo-400 font-sans text-[11px]">Random Generators ({typeBaseMode === 'Script' ? 'ctx.random' : 'random'})</div>
                          <div className="text-content-muted"><strong className="text-content">.int(min, max)</strong>: Integer between min and max</div>
                          <div className="text-content-muted"><strong className="text-content">.float(min, max, dec)</strong>: Decimal number</div>
                          <div className="text-content-muted"><strong className="text-content">.choice(array/table)</strong>: Uniform random pick</div>
                          <div className="text-content-muted"><strong className="text-content">.uuid()</strong>: v4 UUID string</div>
                          <div className="text-content-muted"><strong className="text-content">.hex(n)</strong>, <strong className="text-content">.alpha(n)</strong>, <strong className="text-content">.numeric(n)</strong></div>
                        </div>

                        <div className="p-2 rounded bg-primary/80 border border-border-subtle space-y-1">
                          <div className="font-bold text-emerald-400 font-sans text-[11px]">Helper Utilities ({typeBaseMode === 'Script' ? 'ctx.utils' : 'utils'})</div>
                          <div className="text-content-muted"><strong className="text-content">.pad(num, len)</strong>: Zero-pad number (e.g. pad(7, 5) -&gt; "00007")</div>
                          <div className="text-content-muted"><strong className="text-content">.luhn(digits)</strong>: Standard Luhn checksum calculation</div>
                          <div className="text-content-muted"><strong className="text-content">.hash(str)</strong>: Cryptographic hash token string</div>
                        </div>

                        <div className="p-2 rounded bg-primary/80 border border-border-subtle space-y-1">
                          <div className="font-bold text-sky-400 font-sans text-[11px]">Return Value Contract</div>
                          <div className="text-content-muted">
                            {typeBaseMode === 'Script' ? (
                              <span>End your script with <code className="text-accent">return value;</code>. Return string, number, or boolean.</span>
                            ) : (
                              <span>End your Lua code with <code className="text-accent">return value</code>. Standard Lua syntax applies.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Multi-line Script Editor with Syntax Highlighting */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2 text-[10px] text-content-muted font-mono">
                      <span>{typeBaseMode === 'Script' ? '// JavaScript (ES6+) Sandbox' : '-- Lua 5.3 Virtual Machine'}</span>
                      <span>Tab key indents by 2 spaces • Syntax highlighted</span>
                    </div>

                    <HighlightedCodeEditor
                      value={typeRule}
                      onChange={(val) => setTypeRule(val)}
                      language={typeBaseMode === 'Script' ? 'javascript' : 'lua'}
                      rows={10}
                      minHeight="220px"
                      placeholder={
                        typeBaseMode === 'Script'
                          ? `// Write your JavaScript generator function here\nconst prefix = ctx.random.choice(['A', 'B']);\nreturn \`\${prefix}-\${ctx.index}\`;`
                          : `-- Write your Lua 5.3 script here\nlocal prefix = random.choice({"A", "B"})\nreturn prefix .. "-" .. ctx.index`
                      }
                    />
                  </div>

                  {/* Error Notification Banner if script failed */}
                  {benchmarkResult.error && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-start gap-2">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <div className="break-all">{benchmarkResult.error}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-content">Description</label>
                <input
                  type="text"
                  value={typeDescription}
                  onChange={(e) => setTypeDescription(e.target.value)}
                  placeholder="What kind of data does this column represent?"
                  className="w-full px-3 py-1.5 text-xs bg-primary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                />
              </div>

              {/* Live Interactive Sandbox Preview */}
              <div className="p-3.5 rounded-xl bg-primary/90 border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <Sparkles size={13} />
                    Live Sandbox Generator Preview (4 Simulated Rows)
                  </span>
                  <button
                    type="button"
                    onClick={() => runLiveTest(typeBaseMode, typeRule, typeBaseSubtype)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-secondary hover:bg-tertiary border border-border-subtle text-content flex items-center gap-1 transition"
                  >
                    <RefreshCw size={11} className="text-accent" />
                    <span>Re-evaluate Samples</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  {liveTestSamples.map((sample, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-secondary border border-border-subtle flex flex-col justify-between shadow-inner"
                    >
                      <div className="flex items-center justify-between text-[10px] text-content-muted font-mono mb-1">
                        <span>Row #{idx + 1}</span>
                        <span className="text-[9px] text-accent/80">ctx.row mockup</span>
                      </div>
                      <div className="font-mono text-xs text-content break-all select-all font-semibold">
                        {sample || <span className="text-content-muted italic">empty</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="p-3.5 border-t border-border-subtle bg-secondary flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab(types.length > 0 ? 'installed' : 'examples')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-content-muted hover:text-content"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <Check size={13} />
                <span>{editingId ? 'Update Column Type' : 'Save Column Type'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: My Types (Installed) */}
        {activeTab === 'installed' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {types.length === 0 ? (
              /* Clean Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="p-4 rounded-2xl bg-primary border border-border-subtle text-content-muted">
                  <Layers size={36} className="text-accent" />
                </div>
                <h3 className="text-sm font-bold text-content">No Custom Column Types Installed</h3>
                <p className="text-xs text-content-muted max-w-md leading-relaxed">
                  Your column type selector remains clean and lightweight. You can explore ready-to-use template examples (เช่น เลขบัตรประชาชน, เบอร์โทร, Crypto Wallet) or import a custom JSON schema.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('examples')}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    <span>Browse Examples (ตัวอย่าง)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('import')}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Upload size={13} className="text-accent" />
                    <span>Import File or JSON (หน้าจัดการ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Plus size={13} className="text-accent" />
                    <span>Create from Scratch</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Installed Types Grid */
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Search & Category Filter */}
                <div className="p-3 sm:p-4 border-b border-border-subtle flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-primary/20 flex-shrink-0">
                  <div className="relative flex-1 max-w-md">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
                    <input
                      type="text"
                      placeholder="Search my types..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-primary border border-border-subtle rounded-lg text-content focus:outline-none focus:border-accent"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus size={13} />
                    <span>Create New Type</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredInstalled.map((t) => {
                      const samples = t.sampleOutputs && t.sampleOutputs.length > 0
                        ? t.sampleOutputs
                        : getCustomTypeSamples(t, 2);

                      return (
                        <div
                          key={t.id}
                          className="p-3.5 rounded-xl bg-primary border border-border-subtle hover:border-accent/40 transition flex flex-col justify-between shadow-2xs group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-xs font-bold text-content">{t.name}</h3>
                                <p className="text-[11px] text-content-muted line-clamp-1 mt-0.5">
                                  {t.description || 'Custom generator rule'}
                                </p>
                              </div>

                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-secondary border border-border-subtle text-accent font-semibold flex-shrink-0">
                                {t.category}
                              </span>
                            </div>

                            {/* Rule Spec Snippet */}
                            <div className="p-2 rounded-lg bg-secondary/80 border border-border-subtle font-mono text-[11px] text-content-muted flex items-center justify-between">
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getModeBadgeClass(t.baseMode)}`}>
                                {getModeLabel(t)}
                              </span>
                              <span className="truncate max-w-[200px] text-accent font-mono text-[11px]" title={t.defaultRule}>
                                {t.baseMode === 'Script' || t.baseMode === 'Lua'
                                  ? `${t.defaultRule.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('--'))[0] || 'Custom Script'}`
                                  : t.defaultRule}
                              </span>
                            </div>

                            {/* Live Samples preview */}
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-content-muted">
                                Sample Output:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {samples.map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary border border-border-subtle text-content truncate max-w-[200px]"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Action Footer */}
                          <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(t)}
                                className="p-1.5 text-content-muted hover:text-accent hover:bg-tertiary rounded transition"
                                title="Edit Type Rule"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(t.id, t.name)}
                                className="p-1.5 text-content-muted hover:text-rose-400 hover:bg-tertiary rounded transition"
                                title="Delete Type"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddColumnDirectly(t)}
                              className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                            >
                              <Plus size={12} />
                              <span>Add Field to Schema</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-3 border-t border-border-subtle bg-secondary flex items-center justify-between text-xs text-content-muted flex-shrink-0">
                  <span className="text-[11px]">
                    {types.length} custom column type{types.length !== 1 ? 's' : ''} registered
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Clear All My Types
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
