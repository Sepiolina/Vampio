import { generateRegexString } from './regexSynthesizer';
import {
  createScriptContext,
  executeJavaScriptScript,
  executeLuaScript,
  ScriptContext
} from './scriptEngine';
import {
  FIRST_NAMES,
  LAST_NAMES,
  COMPANIES,
  JOB_TITLES,
  COUNTRIES,
  CITIES,
  USER_AGENTS,
  EMAIL_DOMAINS
} from './generator';
import {
  RestApiColumnConfig,
  getSynchronousRestApiValue,
  parseRestApiConfig,
  serializeRestApiConfig
} from './restApiManager';

export type CustomTypeBaseMode =
  | 'Base'
  | 'Template'
  | 'Script'
  | 'Lua'
  // Backward compatibility aliases:
  | 'RegEx'
  | 'Set/Enum'
  | 'Int'
  | 'Float'
  | 'Sequence';

export type BaseEngineSubtype =
  | 'Int'
  | 'Float'
  | 'String'
  | 'Boolean'
  | 'DateTime'
  | 'Sequence'
  | 'Set/Enum'
  | 'RegEx'
  | 'Blob/Hex'
  | 'UUID'
  | 'Entity'
  | 'REST_API';

export interface IntAdvancedConfig {
  min: number;
  max: number;
  step?: number;
  padZeros?: number; // e.g. 5 -> 00042
  thousandsSeparator?: 'none' | 'comma' | 'dot' | 'space' | 'underscore';
  signDisplay?: 'default' | 'always' | 'negative_only';
  prefix?: string;
  suffix?: string;
  distribution?: 'uniform' | 'normal' | 'min_heavy' | 'max_heavy';
}

export interface FloatAdvancedConfig {
  min: number;
  max: number;
  decimals: number;
  padDecimals?: boolean;
  decimalSeparator?: '.' | ',';
  thousandsSeparator?: 'none' | 'comma' | 'dot' | 'space';
  rounding?: 'round' | 'floor' | 'ceil' | 'truncate';
  prefix?: string;
  suffix?: string;
}

export interface StringAdvancedConfig {
  lengthMode?: 'fixed' | 'range';
  length?: number;
  minLength?: number;
  maxLength?: number;
  charset?: 'alphanumeric' | 'alpha' | 'alpha_upper' | 'alpha_lower' | 'numeric' | 'hex' | 'symbols' | 'custom';
  customCharset?: string;
  casing?: 'original' | 'upper' | 'lower' | 'capitalize';
  prefix?: string;
  suffix?: string;
}

export interface BooleanAdvancedConfig {
  truePct: number; // 0 to 100
  format: 'true_false' | 'True_False' | 'TRUE_FALSE' | '1_0' | 'yes_no' | 'Y_N' | 'enabled_disabled' | 'active_inactive' | 'custom';
  customTrue?: string;
  customFalse?: string;
}

export interface DateTimeAdvancedConfig {
  range: 'past_30d' | 'past_90d' | 'past_year' | 'past_5y' | 'future_30d' | 'future_year' | 'today' | 'custom_range';
  startDate?: string;
  endDate?: string;
  format: 'YYYY-MM-DD HH:mm:ss' | 'ISO' | 'YYYY-MM-DD' | 'HH:mm:ss' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'timestamp_s' | 'timestamp_ms';
  businessOnly?: boolean;
}

export interface SequenceAdvancedConfig {
  start: number;
  step: number;
  padZeros?: number;
  cycleAt?: number;
  base?: 'decimal' | 'hex' | 'alpha';
  prefix?: string;
  suffix?: string;
}

export interface SetEnumAdvancedConfig {
  items: { value: string; weight: number }[];
  selectionMode?: 'single' | 'multi';
  multiMin?: number;
  multiMax?: number;
  multiDelimiter?: string;
  strategy?: 'weighted' | 'uniform' | 'round_robin';
  quote?: 'none' | 'single' | 'double';
}

export interface RegExAdvancedConfig {
  pattern: string;
  namedPreset?: string;
}

export interface BlobHexAdvancedConfig {
  bytes: number;
  encoding: 'hex_delimited' | 'hex_continuous' | 'hex_0x' | 'base64' | 'binary';
  delimiter?: '-' | ':' | ' ' | '';
  casing?: 'upper' | 'lower';
}

export interface UuidAdvancedConfig {
  version: 'v4' | 'v7' | 'nanoid' | 'short';
  hyphens?: boolean;
  casing?: 'lower' | 'upper';
  urnPrefix?: boolean;
}

export type BuiltInEntitySubtype =
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'company'
  | 'job_title'
  | 'country'
  | 'city'
  | 'ip_address'
  | 'user_agent'
  | 'url';

export interface CustomEntityDataset {
  id: string; // e.g. "entity:hospital_departments"
  name: string; // e.g. "Hospital Departments"
  description?: string;
  items: string[];
  createdAt: number;
  updatedAt: number;
}

export interface EntityAdvancedConfig {
  subtype: BuiltInEntitySubtype | 'custom' | string;
  customEntityId?: string;
  customEntityName?: string;
  customItems?: string[];
  locale?: 'global' | 'us' | 'eu' | 'asia';
  emailDomain?: string;
  phoneFormat?: 'us' | 'international' | 'local';
  gender?: 'any' | 'female' | 'male';
}

export type RestApiAdvancedConfig = RestApiColumnConfig;

export type BaseEngineConfig =
  | { type: 'Int'; config: IntAdvancedConfig }
  | { type: 'Float'; config: FloatAdvancedConfig }
  | { type: 'String'; config: StringAdvancedConfig }
  | { type: 'Boolean'; config: BooleanAdvancedConfig }
  | { type: 'DateTime'; config: DateTimeAdvancedConfig }
  | { type: 'Sequence'; config: SequenceAdvancedConfig }
  | { type: 'Set/Enum'; config: SetEnumAdvancedConfig }
  | { type: 'RegEx'; config: RegExAdvancedConfig }
  | { type: 'Blob/Hex'; config: BlobHexAdvancedConfig }
  | { type: 'UUID'; config: UuidAdvancedConfig }
  | { type: 'Entity'; config: EntityAdvancedConfig }
  | { type: 'REST_API'; config: RestApiAdvancedConfig };

export interface CustomColumnType {
  id: string; // Unique ID, e.g. "custom:thai_id"
  name: string; // Human readable name, e.g. "Thai National ID (เลขบัตรประชาชน)"
  category: 'Identity' | 'Finance' | 'Telecom' | 'Commerce' | 'Security' | 'Network' | 'Scripting' | 'Custom';
  description: string;
  baseMode: CustomTypeBaseMode;
  baseSubtype?: BaseEngineSubtype;
  defaultRule: string; // The script code, regex pattern, template, or enum list
  baseConfig?: BaseEngineConfig;
  sampleOutputs?: string[];
  createdAt: number;
  author?: string;
  isBuiltin?: boolean;
}

// Preset Examples & Templates catalog (NOT auto-seeded into user custom types)
export const EXAMPLE_PRESET_TYPES: CustomColumnType[] = [
  {
    id: 'example:lua_bank_txn',
    name: 'Banking Txn Code & Luhn Checksum (Lua)',
    category: 'Finance',
    description: 'Generates ISO-grade banking transaction codes with Luhn check digit computed in real Lua 5.3',
    baseMode: 'Lua',
    defaultRule: `-- Banking Txn Generator (Lua 5.3)
local dept = random.choice({"PAY", "WIRE", "ACH", "REF", "SETTLE"})
local seq = utils.pad(ctx.index, 6)
local rawDigits = string.format("%d%04d", ctx.index, random.int(1000, 9999))
local check = utils.luhn(rawDigits)
return string.format("%s-%s-%s-%d", dept, seq, random.hex(4):upper(), check)`,
    sampleOutputs: ['PAY-000001-3A9F-4', 'WIRE-000002-8B1C-2', 'ACH-000003-E50D-9'],
    createdAt: 1700000000000,
    author: 'Vampio Script Engine'
  },
  {
    id: 'example:lua_thai_id',
    name: 'Thai National ID Algorithm (Lua 5.3)',
    category: 'Identity',
    description: 'Generates valid 13-digit Thai national IDs with real Modulo-11 checksum calculated directly in Lua',
    baseMode: 'Lua',
    defaultRule: `-- Thai National ID Modulo-11 Checksum (Lua 5.3)
local digits = {1} -- standard Thai citizen prefix
for i = 2, 12 do
  digits[i] = random.int(0, 9)
end

local sum = 0
for i = 1, 12 do
  sum = sum + digits[i] * (14 - i)
end
local check = (11 - (sum % 11)) % 10
digits[13] = check

return table.concat(digits)`,
    sampleOutputs: ['1100702345124', '1501500412893', '1209801456236'],
    createdAt: 1700000000000,
    author: 'Vampio Script Engine'
  },
  {
    id: 'example:js_dynamic_pricing',
    name: 'Dynamic Item Subtotal & Tier (JS Script)',
    category: 'Commerce',
    description: 'Calculates dynamic invoice totals and discount tiers with access to row context',
    baseMode: 'Script',
    defaultRule: `// Accesses row context or random fallback
const qty = typeof ctx.row.quantity === 'number' ? ctx.row.quantity : ctx.random.int(1, 8);
const unitPrice = typeof ctx.row.price === 'number' ? ctx.row.price : ctx.random.float(12.5, 340.0, 2);
const discountRate = ctx.random.choice([0, 0, 0.05, 0.10, 0.20]);
const subtotal = Number((qty * unitPrice * (1 - discountRate)).toFixed(2));
return subtotal;`,
    sampleOutputs: ['142.50', '28.99', '512.40'],
    createdAt: 1700000000000,
    author: 'Vampio Script Engine'
  },
  {
    id: 'example:js_employee_badge',
    name: 'Enterprise Security Badge (JS Script)',
    category: 'Security',
    description: 'Enterprise badge combining weighted department distribution, sequence number, and FNV hash check',
    baseMode: 'Script',
    defaultRule: `// Enterprise Employee Badge Generator
const dept = ctx.random.weighted([
  { value: 'ENG', weight: 45 },
  { value: 'SEC', weight: 25 },
  { value: 'FIN', weight: 15 },
  { value: 'EXEC', weight: 15 }
]);
const seq = ctx.utils.pad(ctx.index, 5);
const hashToken = ctx.utils.hash(dept + seq).slice(0, 4).toUpperCase();
return \`BADGE-\${dept}-\${seq}-\${hashToken}\`;`,
    sampleOutputs: ['BADGE-ENG-00001-A9E2', 'BADGE-SEC-00002-3B7D', 'BADGE-EXEC-00003-8F4C'],
    createdAt: 1700000000000,
    author: 'Vampio Script Engine'
  },
  {
    id: 'example:lua_color_palette',
    name: 'Hex Palette & Luminance Tag (Lua)',
    category: 'Custom',
    description: 'Generates hexadecimal color code with calculated relative luminance contrast category in Lua',
    baseMode: 'Lua',
    defaultRule: `-- Generates Hex Color with Contrast Tag in Lua
local r = random.int(0, 255)
local g = random.int(0, 255)
local b = random.int(0, 255)
local hex = string.format("#%02X%02X%02X", r, g, b)
local lum = (0.299 * r + 0.587 * g + 0.114 * b)
local tone = lum > 128 and "LIGHT" or "DARK"
return string.format("%s (%s)", hex, tone)`,
    sampleOutputs: ['#3A82F6 (LIGHT)', '#1E293B (DARK)', '#10B981 (LIGHT)'],
    createdAt: 1700000000000,
    author: 'Vampio Script Engine'
  },
  {
    id: 'example:thai_id',
    name: 'Thai National ID (เลขบัตรประชาชน)',
    category: 'Identity',
    description: '13-digit Thai citizen national identification with valid checksum algorithm',
    baseMode: 'Base',
    baseSubtype: 'RegEx',
    defaultRule: 'thai_id_checksum',
    sampleOutputs: ['1100702345124', '3501500412891', '1209801456238'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  },
  {
    id: 'example:thai_phone',
    name: 'Thai Mobile Phone (+66)',
    category: 'Telecom',
    description: 'Thailand mobile phone number (+66 8X-XXX-XXXX or 08X-XXX-XXXX)',
    baseMode: 'Base',
    baseSubtype: 'RegEx',
    defaultRule: '+66 8[1-9]-\\d{3}-\\d{4}',
    sampleOutputs: ['+66 81-492-3104', '+66 89-721-8842', '+66 86-309-1255'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  },
  {
    id: 'example:eth_wallet',
    name: 'Ethereum Wallet Address',
    category: 'Finance',
    description: 'EVM compatible public hexadecimal wallet address (0x + 40 characters)',
    baseMode: 'Base',
    baseSubtype: 'RegEx',
    defaultRule: '0x[a-f0-9]{40}',
    sampleOutputs: ['0x71c...b82a', '0x29d...41a0', '0xe4f...732c'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  },
  {
    id: 'example:credit_card_mask',
    name: 'Credit Card Number (Masked)',
    category: 'Finance',
    description: 'Masked 16-digit card number with dynamic 4-digit terminal digits',
    baseMode: 'Template',
    defaultRule: '4{NUM:3}-{NUM:4}-{NUM:4}-{NUM:4}',
    sampleOutputs: ['4512-8821-4920-1182', '4120-7492-0193-8419'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  },
  {
    id: 'example:sku_code',
    name: 'E-Commerce SKU Code',
    category: 'Commerce',
    description: 'SKU identifier with category department prefix and serial code',
    baseMode: 'Template',
    defaultRule: 'SKU-{SET:ELEC,APPAREL,HOME,BEAUTY,SPORT}-{NUM:5}',
    sampleOutputs: ['SKU-ELEC-84920', 'SKU-APPAREL-31940', 'SKU-HOME-90214'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  },
  {
    id: 'example:iban',
    name: 'International Bank Account (IBAN)',
    category: 'Finance',
    description: 'Standardized international bank account identifier (e.g. GB, DE, FR)',
    baseMode: 'Base',
    baseSubtype: 'RegEx',
    defaultRule: '[A-Z]{2}\\d{2}[A-Z]{4}\\d{10}',
    sampleOutputs: ['GB29NWBK60161331926819', 'DE89370400440532013000'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  },
  {
    id: 'example:ipv6',
    name: 'IPv6 Network Address',
    category: 'Network',
    description: 'Full 128-bit 8-group hexadecimal colon-separated IPv6 address',
    baseMode: 'Template',
    defaultRule: '2001:0db8:{HEX:4}:{HEX:4}:{HEX:4}:{HEX:4}:{HEX:4}:{HEX:4}',
    sampleOutputs: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
    createdAt: 1700000000000,
    author: 'Vampio System'
  }
];

// Alias for backward compatibility
export const BUILTIN_CUSTOM_TYPES = EXAMPLE_PRESET_TYPES;

const STORAGE_KEY = 'vampio_user_custom_types_v2';

export function getExamplePresetTypes(): CustomColumnType[] {
  return EXAMPLE_PRESET_TYPES;
}

export function getCustomColumnTypes(): CustomColumnType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Do NOT pre-seed anything into user types! Keep schema and dropdown clean.
      // Clean up any legacy v1 key if present
      try {
        localStorage.removeItem('vampio_custom_column_types_v1');
      } catch {
        // ignore
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Ensure only valid user-custom types are returned
      return parsed.filter((t) => t && t.id && t.name);
    }
    return [];
  } catch (err) {
    console.error('Failed to load custom column types:', err);
    return [];
  }
}

export function isCustomTypeInstalled(id: string): boolean {
  const current = getCustomColumnTypes();
  return current.some(t => t.id === id || t.name.toLowerCase() === id.toLowerCase());
}

export function installExamplePreset(preset: CustomColumnType): void {
  const newType: CustomColumnType = {
    ...preset,
    id: preset.id.startsWith('custom:') ? preset.id : `custom:${preset.id.replace(/^example:/, '')}`,
    createdAt: Date.now(),
    isBuiltin: false
  };
  saveCustomColumnType(newType);
}

export function saveCustomColumnType(item: CustomColumnType): void {
  const current = getCustomColumnTypes();
  const existingIndex = current.findIndex(t => t.id === item.id);
  let updated: CustomColumnType[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = { ...item, isBuiltin: false };
  } else {
    updated = [item, ...current];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteCustomColumnType(id: string): void {
  const current = getCustomColumnTypes();
  const updated = current.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function resetCustomColumnTypesToDefault(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

export function clearAllCustomTypes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

export function exportCustomColumnTypesJSON(): string {
  const types = getCustomColumnTypes();
  return JSON.stringify({
    schema_version: '1.0',
    type: 'vampio_custom_column_types',
    exported_at: new Date().toISOString(),
    count: types.length,
    column_types: types
  }, null, 2);
}

export function importCustomColumnTypes(jsonStr: string): { imported: number; updated: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;

  try {
    const parsed = JSON.parse(jsonStr);
    let itemsToImport: any[] = [];

    if (Array.isArray(parsed)) {
      itemsToImport = parsed;
    } else if (parsed && Array.isArray(parsed.column_types)) {
      itemsToImport = parsed.column_types;
    } else if (parsed && parsed.name && parsed.baseMode) {
      itemsToImport = [parsed];
    } else {
      errors.push('Unrecognized format. Expected array of column types or { column_types: [...] }');
      return { imported, updated, errors };
    }

    const current = getCustomColumnTypes();
    const map = new Map<string, CustomColumnType>(current.map(c => [c.id, c]));

    for (const rawItem of itemsToImport) {
      if (!rawItem.name || typeof rawItem.name !== 'string') {
        errors.push(`Skipped item missing valid 'name' attribute.`);
        continue;
      }

      const id = rawItem.id && typeof rawItem.id === 'string'
        ? (rawItem.id.startsWith('custom:') ? rawItem.id : `custom:${rawItem.id}`)
        : `custom:${rawItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;

      // Map legacy modes to Base if applicable
      const rawMode = (rawItem.baseMode || 'Base') as CustomTypeBaseMode;
      const isLegacyBase = rawMode === 'RegEx' || rawMode === 'Set/Enum' || rawMode === 'Int' || rawMode === 'Float' || rawMode === 'Sequence';
      const effectiveMode: CustomTypeBaseMode = isLegacyBase ? 'Base' : rawMode;
      const effectiveSubtype: BaseEngineSubtype | undefined = rawItem.baseSubtype || (isLegacyBase ? (rawMode as BaseEngineSubtype) : undefined);

      const sanitized: CustomColumnType = {
        id,
        name: rawItem.name.trim(),
        category: rawItem.category || 'Custom',
        description: rawItem.description || '',
        baseMode: effectiveMode,
        baseSubtype: effectiveSubtype,
        defaultRule: rawItem.defaultRule || '',
        sampleOutputs: Array.isArray(rawItem.sampleOutputs) ? rawItem.sampleOutputs : [],
        createdAt: rawItem.createdAt || Date.now(),
        author: rawItem.author || 'Imported User',
        isBuiltin: false
      };

      if (map.has(id)) {
        map.set(id, sanitized);
        updated++;
      } else {
        map.set(id, sanitized);
        imported++;
      }
    }

    const nextList = Array.from(map.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));

    return { imported, updated, errors };
  } catch (err: any) {
    errors.push(`JSON Parse Error: ${err.message}`);
    return { imported, updated, errors };
  }
}

/**
 * Enhanced, 100% offline Smart Template Engine
 * Supports versatile syntax: {TOKEN}, #{TOKEN}#, {{TOKEN}}, ${TOKEN}
 * Tokens supported:
 *  - Numbers: {INT:min,max}, {FLOAT:min,max,dec}, {NUM:length}, {DIGIT:length}
 *  - Sets: {SET:opt1,opt2,opt3}, {CHOICE:a,b,c}, {WEIGHTED:a:70,b:30}
 *  - Formats: {HEX:length}, {ALPHA:length}, {ALPHA_LOWER:length}, {ALPHANUM:length}
 *  - IDs: {UUID}, {UUID:SHORT}
 *  - Sequence & Row: {INDEX}, {SEQ}, {SEQ:pad}, {INDEX:start,pad}, {row.columnName}
 *  - Date & Time: {YEAR}, {MONTH}, {DAY}, {DATE}, {TIME}, {TIMESTAMP}
 *  - Real Entities: {FIRST_NAME}, {LAST_NAME}, {FULL_NAME}, {EMAIL}, {PHONE}, {CITY}, {COUNTRY}, {COMPANY}
 */
export function generateFromTemplate(
  template: string,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): string {
  if (!template) return '';
  const rowIndex = context?.rowIndex ?? 0;
  const rowContext = context?.row ?? {};

  // Matches #{...}#, {{...}}, {...}, ${...}
  return template.replace(/(?:#\{|\{\{|\{|\$\{)([^}#]+)(?:\}#|\}\}|\})/g, (fullMatch, rawTag: string) => {
    const tag = rawTag.trim();
    const upper = tag.toUpperCase();

    // 1. Integer Range: {INT:min,max} or {INT:max} or {RANDOM:min,max}
    if (upper.startsWith('INT:') || upper.startsWith('RANDOM:')) {
      const paramStr = tag.substring(tag.indexOf(':') + 1);
      const parts = paramStr.split(',');
      let min = parseInt(parts[0], 10);
      let max = parseInt(parts[1], 10);
      if (isNaN(max)) {
        max = isNaN(min) ? 100 : min;
        min = 1;
      }
      if (min > max) [min, max] = [max, min];
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    // 2. Float Range: {FLOAT:min,max,dec}
    if (upper.startsWith('FLOAT:')) {
      const parts = tag.substring(6).split(',');
      const min = parseFloat(parts[0]) || 0.0;
      const max = parseFloat(parts[1]) || 100.0;
      const dec = parseInt(parts[2], 10);
      const val = Math.random() * (max - min) + min;
      return val.toFixed(isNaN(dec) ? 2 : Math.min(Math.max(dec, 0), 6));
    }

    // 3. Set / Enum choice: {SET:a,b,c} or {CHOICE:a,b,c}
    if (upper.startsWith('SET:') || upper.startsWith('CHOICE:')) {
      const separator = tag.includes('|') ? '|' : ',';
      const items = tag.substring(tag.indexOf(':') + 1).split(separator).map(s => s.trim()).filter(Boolean);
      if (items.length === 0) return 'ITEM';
      return items[Math.floor(Math.random() * items.length)];
    }

    // 4. Weighted Set: {WEIGHTED:a:70,b:30}
    if (upper.startsWith('WEIGHTED:')) {
      const items = tag.substring(9).split(',').map(s => s.trim()).filter(Boolean);
      const parsed: { val: string; weight: number }[] = [];
      let totalWeight = 0;
      for (const item of items) {
        const [v, w] = item.split(':').map(p => p.trim());
        const weight = parseInt(w, 10) || 10;
        parsed.push({ val: v, weight });
        totalWeight += weight;
      }
      let r = Math.random() * totalWeight;
      for (const p of parsed) {
        if (r < p.weight) return p.val;
        r -= p.weight;
      }
      return parsed[0]?.val || '';
    }

    // 5. Hexadecimal string: {HEX:length} or {HEX}
    if (upper.startsWith('HEX:') || upper === 'HEX') {
      const len = upper.includes(':') ? parseInt(tag.substring(tag.indexOf(':') + 1), 10) || 4 : 4;
      let s = '';
      for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16).toUpperCase();
      return s;
    }

    // 6. Digits / Numbers: {NUM:length} or {DIGIT:length}
    if (upper.startsWith('NUM:') || upper.startsWith('DIGIT:') || upper.startsWith('D:')) {
      const len = parseInt(tag.substring(tag.indexOf(':') + 1), 10) || 4;
      let s = '';
      for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10).toString();
      return s;
    }

    // 7. Alphabetic string: {ALPHA:length} or {STR:length}
    if (upper.startsWith('ALPHA:') || upper.startsWith('STR:') || upper.startsWith('CHARS:')) {
      const len = parseInt(tag.substring(tag.indexOf(':') + 1), 10) || 4;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let s = '';
      for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      return s;
    }

    // 8. Lowercase Alphabetic: {ALPHA_LOWER:length}
    if (upper.startsWith('ALPHA_LOWER:')) {
      const len = parseInt(tag.substring(12), 10) || 4;
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      let s = '';
      for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      return s;
    }

    // 9. Alphanumeric: {ALPHANUM:length}
    if (upper.startsWith('ALPHANUM:')) {
      const len = parseInt(tag.substring(9), 10) || 6;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let s = '';
      for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      return s;
    }

    // 10. UUID
    if (upper === 'UUID') {
      return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
    if (upper === 'UUID:SHORT' || upper === 'UUID_SHORT') {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // 11. Sequence / Index: {INDEX} or {SEQ} or {INDEX:pad} or {INDEX:start,pad}
    if (upper === 'INDEX' || upper === 'SEQ' || upper.startsWith('INDEX:') || upper.startsWith('SEQ:')) {
      let start = 1;
      let pad = 0;
      if (tag.includes(':')) {
        const parts = tag.substring(tag.indexOf(':') + 1).split(',').map(s => parseInt(s.trim(), 10));
        if (parts.length === 1) {
          pad = isNaN(parts[0]) ? 0 : parts[0];
        } else if (parts.length >= 2) {
          start = isNaN(parts[0]) ? 1 : parts[0];
          pad = isNaN(parts[1]) ? 0 : parts[1];
        }
      }
      const seqVal = (start + rowIndex).toString();
      return pad > 0 ? seqVal.padStart(pad, '0') : seqVal;
    }

    // 12. Dates & Times
    if (upper === 'YEAR') {
      return new Date().getFullYear().toString();
    }
    if (upper === 'MONTH') {
      return String(new Date().getMonth() + 1).padStart(2, '0');
    }
    if (upper === 'DAY') {
      return String(new Date().getDate()).padStart(2, '0');
    }
    if (upper === 'DATE' || upper === 'DATE:ISO' || upper === 'TODAY') {
      return new Date().toISOString().split('T')[0];
    }
    if (upper === 'TIME') {
      return new Date().toTimeString().split(' ')[0];
    }
    if (upper === 'TIMESTAMP' || upper === 'UNIX') {
      return Math.floor(Date.now() / 1000).toString();
    }

    // 13. Entity helpers: {FIRST_NAME}, {LAST_NAME}, {FULL_NAME}, {EMAIL}, {PHONE}, {CITY}, {COUNTRY}, {COMPANY}
    if (upper === 'FIRST_NAME') {
      const names = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'James', 'Mia'];
      return names[Math.floor(Math.random() * names.length)];
    }
    if (upper === 'LAST_NAME') {
      const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'];
      return names[Math.floor(Math.random() * names.length)];
    }
    if (upper === 'FULL_NAME') {
      const firsts = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'James'];
      const lasts = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller'];
      return `${firsts[Math.floor(Math.random() * firsts.length)]} ${lasts[Math.floor(Math.random() * lasts.length)]}`;
    }
    if (upper === 'EMAIL') {
      const prefixes = ['alex', 'jordan', 'taylor', 'sam', 'morgan', 'casey'];
      const domains = ['example.com', 'corp.net', 'cloud.io'];
      return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${Math.floor(Math.random() * 900 + 100)}@${domains[Math.floor(Math.random() * domains.length)]}`;
    }
    if (upper === 'PHONE') {
      return `+1-${Math.floor(Math.random() * 800 + 200)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    if (upper === 'CITY') {
      const cities = ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Bangkok', 'Singapore'];
      return cities[Math.floor(Math.random() * cities.length)];
    }
    if (upper === 'COUNTRY') {
      const countries = ['US', 'UK', 'DE', 'FR', 'JP', 'TH', 'SG'];
      return countries[Math.floor(Math.random() * countries.length)];
    }
    if (upper === 'COMPANY') {
      const comps = ['Nexus Tech', 'Vanguard Corp', 'Apex Global', 'Cipher Systems', 'OmniPulse'];
      return comps[Math.floor(Math.random() * comps.length)];
    }

    // 14. Row context reference: {row.colName} or {ROW:colName}
    if (tag.toLowerCase().startsWith('row.') || upper.startsWith('ROW:')) {
      const colName = tag.includes('.') ? tag.split('.')[1] : tag.substring(4);
      if (rowContext && colName && colName in rowContext) {
        const val = rowContext[colName];
        return val !== null && val !== undefined ? String(val) : '';
      }
      return `[${colName}]`;
    }

    // Fallback: if tag not matched, return original
    return fullMatch;
  });
}

export const DEFAULT_STARTER_ENTITIES: CustomEntityDataset[] = [
  {
    id: 'entity:hospital_departments',
    name: 'Hospital Departments',
    description: 'Clinical medical departments and hospital wards',
    items: [
      'Cardiology', 'Neurology', 'Pediatrics', 'Oncology', 'Radiology',
      'Orthopedics', 'Emergency Medicine', 'Dermatology', 'Psychiatry',
      'Pathology', 'Gastroenterology', 'Endocrinology', 'Ophthalmology',
      'Urology', 'Anesthesiology', 'Obstetrics & Gynecology', 'Pulmonology',
      'Hematology', 'Nephrology', 'Rheumatology'
    ],
    createdAt: 1710000000000,
    updatedAt: 1710000000000
  },
  {
    id: 'entity:ecommerce_categories',
    name: 'E-Commerce Product Categories',
    description: 'Retail and online store product hierarchy categories',
    items: [
      'Electronics & Gadgets', 'Home & Kitchen Appliances', 'Apparel & Footwear',
      'Health & Personal Care', 'Sports & Outdoors', 'Books & Stationery',
      'Beauty & Cosmetics', 'Automotive & Hardware', 'Toys & Baby Products',
      'Pet Supplies & Food', 'Office Equipment', 'Jewelry & Watches'
    ],
    createdAt: 1710000000000,
    updatedAt: 1710000000000
  },
  {
    id: 'entity:crypto_tickers',
    name: 'Cryptocurrency Tickers',
    description: 'Major blockchain tokens and cryptocurrency symbols',
    items: [
      'BTC (Bitcoin)', 'ETH (Ethereum)', 'SOL (Solana)', 'ADA (Cardano)',
      'XRP (Ripple)', 'AVAX (Avalanche)', 'DOT (Polkadot)', 'MATIC (Polygon)',
      'LINK (Chainlink)', 'NEAR (Near Protocol)', 'UNI (Uniswap)', 'ATOM (Cosmos)',
      'APT (Aptos)', 'SUI (Sui Network)', 'ARB (Arbitrum)', 'OP (Optimism)'
    ],
    createdAt: 1710000000000,
    updatedAt: 1710000000000
  },
  {
    id: 'entity:world_airports',
    name: 'World Airports (IATA)',
    description: 'High-volume international airport hubs and IATA codes',
    items: [
      'JFK (John F. Kennedy - New York)', 'LHR (Heathrow - London)', 'HND (Haneda - Tokyo)',
      'CDG (Charles de Gaulle - Paris)', 'SIN (Changi - Singapore)', 'DXB (Dubai International)',
      'FRA (Frankfurt Airport)', 'BKK (Suvarnabhumi - Bangkok)', 'SYD (Sydney Kingsford Smith)',
      'AMS (Schiphol - Amsterdam)', 'ICN (Incheon - Seoul)', 'LAX (Los Angeles International)',
      'HKG (Hong Kong International)', 'ZRH (Zurich Airport)', 'SFO (San Francisco International)'
    ],
    createdAt: 1710000000000,
    updatedAt: 1710000000000
  }
];

export const CUSTOM_ENTITIES_STORAGE_KEY = 'data_forge_custom_entities_v1';

/**
 * Retrieves all registered custom entities from persistent storage.
 */
export function getRegisteredCustomEntities(): CustomEntityDataset[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_STARTER_ENTITIES;
  }
  try {
    const raw = localStorage.getItem(CUSTOM_ENTITIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse custom entities from localStorage:', err);
  }
  return DEFAULT_STARTER_ENTITIES;
}

/**
 * Persists a new or updated custom entity dataset to registry.
 */
export function saveCustomEntity(entity: CustomEntityDataset): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = getRegisteredCustomEntities();
    const idx = list.findIndex(e => e.id === entity.id);
    let updated: CustomEntityDataset[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...entity, updatedAt: Date.now() };
    } else {
      updated = [entity, ...list];
    }
    localStorage.setItem(CUSTOM_ENTITIES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save custom entity:', err);
  }
}

/**
 * Deletes a custom entity from registry.
 */
export function deleteCustomEntity(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = getRegisteredCustomEntities();
    const updated = list.filter(e => e.id !== id);
    localStorage.setItem(CUSTOM_ENTITIES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to delete custom entity:', err);
  }
}

/**
 * Universal Parser for Custom Entity Uploads:
 * Supports:
 * - .txt: Line-by-line values separated by Enter/newline
 * - .json: Array of strings, array of objects, or object with arrays
 * - .csv / .tsv: Delimited lines
 */
export function parseEntityUpload(
  content: string,
  fileName?: string
): { name: string; items: string[] } {
  let items: string[] = [];
  let suggestedName = fileName
    ? fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Custom Entity';

  const trimmed = content.trim();

  // Try parsing as JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
            const s = String(entry).trim();
            if (s) items.push(s);
          } else if (entry && typeof entry === 'object') {
            const obj = entry as Record<string, unknown>;
            const preferredKey = ['name', 'title', 'label', 'value', 'text', 'id', 'item'].find(
              (k) => typeof obj[k] === 'string' || typeof obj[k] === 'number'
            );
            if (preferredKey && obj[preferredKey] !== undefined) {
              items.push(String(obj[preferredKey]).trim());
            } else {
              const firstVal = Object.values(obj).find((v) => typeof v === 'string' || typeof v === 'number');
              if (firstVal !== undefined) items.push(String(firstVal).trim());
            }
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        const arrayKey = Object.keys(parsed).find((k) => Array.isArray((parsed as any)[k]));
        if (arrayKey) {
          if (!fileName) suggestedName = arrayKey.replace(/[-_]+/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          const arr = (parsed as any)[arrayKey];
          for (const entry of arr) {
            if (typeof entry === 'string' || typeof entry === 'number') {
              items.push(String(entry).trim());
            } else if (entry && typeof entry === 'object') {
              const firstVal = Object.values(entry).find((v) => typeof v === 'string' || typeof v === 'number');
              if (firstVal !== undefined) items.push(String(firstVal).trim());
            }
          }
        } else {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' || typeof v === 'number') {
              items.push(String(v).trim());
            } else {
              items.push(k.trim());
            }
          }
        }
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // If not parsed from JSON or array is empty, parse as TXT (separated by Enter/newline) or CSV
  if (items.length === 0) {
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        if (parts[0]) items.push(parts[0]);
      } else if (line.includes(',') && !line.includes(' ')) {
        const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        items.push(...parts);
      } else {
        const cleaned = line.replace(/^["']|["']$/g, '').trim();
        if (cleaned) items.push(cleaned);
      }
    }
  }

  return {
    name: suggestedName,
    items
  };
}

/**
 * Creates a sensible default configuration for any Base Engine Subtype.
 */
export function createDefaultBaseConfig(subtype: 'Int'): { type: 'Int'; config: IntAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'Float'): { type: 'Float'; config: FloatAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'String'): { type: 'String'; config: StringAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'Boolean'): { type: 'Boolean'; config: BooleanAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'DateTime'): { type: 'DateTime'; config: DateTimeAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'Sequence'): { type: 'Sequence'; config: SequenceAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'Set/Enum'): { type: 'Set/Enum'; config: SetEnumAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'Blob/Hex'): { type: 'Blob/Hex'; config: BlobHexAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'UUID'): { type: 'UUID'; config: UuidAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'Entity'): { type: 'Entity'; config: EntityAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'RegEx'): { type: 'RegEx'; config: RegExAdvancedConfig };
export function createDefaultBaseConfig(subtype: 'REST_API'): { type: 'REST_API'; config: RestApiAdvancedConfig };
export function createDefaultBaseConfig(subtype: BaseEngineSubtype): BaseEngineConfig;
export function createDefaultBaseConfig(subtype: BaseEngineSubtype): BaseEngineConfig {
  switch (subtype) {
    case 'Int':
      return {
        type: 'Int',
        config: {
          min: 1,
          max: 100,
          step: 1,
          padZeros: 0,
          thousandsSeparator: 'none',
          signDisplay: 'default',
          prefix: '',
          suffix: '',
          distribution: 'uniform'
        }
      };
    case 'Float':
      return {
        type: 'Float',
        config: {
          min: 0.0,
          max: 100.0,
          decimals: 2,
          padDecimals: true,
          decimalSeparator: '.',
          thousandsSeparator: 'none',
          rounding: 'round',
          prefix: '',
          suffix: ''
        }
      };
    case 'String':
      return {
        type: 'String',
        config: {
          lengthMode: 'fixed',
          length: 10,
          minLength: 6,
          maxLength: 16,
          charset: 'alphanumeric',
          casing: 'original',
          prefix: '',
          suffix: ''
        }
      };
    case 'Boolean':
      return {
        type: 'Boolean',
        config: {
          truePct: 50,
          format: 'true_false'
        }
      };
    case 'DateTime':
      return {
        type: 'DateTime',
        config: {
          range: 'past_30d',
          format: 'YYYY-MM-DD HH:mm:ss',
          businessOnly: false
        }
      };
    case 'Sequence':
      return {
        type: 'Sequence',
        config: {
          start: 1001,
          step: 1,
          padZeros: 0,
          base: 'decimal',
          prefix: '',
          suffix: ''
        }
      };
    case 'Set/Enum':
      return {
        type: 'Set/Enum',
        config: {
          items: [
            { value: 'Active', weight: 70 },
            { value: 'Pending', weight: 20 },
            { value: 'Suspended', weight: 10 }
          ],
          selectionMode: 'single',
          strategy: 'weighted',
          quote: 'none'
        }
      };
    case 'Blob/Hex':
      return {
        type: 'Blob/Hex',
        config: {
          bytes: 6,
          encoding: 'hex_delimited',
          delimiter: '-',
          casing: 'upper'
        }
      };
    case 'UUID':
      return {
        type: 'UUID',
        config: {
          version: 'v4',
          hyphens: true,
          casing: 'lower',
          urnPrefix: false
        }
      };
    case 'Entity':
      return {
        type: 'Entity',
        config: {
          subtype: 'full_name',
          locale: 'global',
          gender: 'any',
          phoneFormat: 'international'
        }
      };
    case 'REST_API':
      return {
        type: 'REST_API',
        config: {
          url: 'https://dummyjson.com/users?limit=50',
          method: 'GET',
          jsonPath: 'users[].email',
          retrievalMode: 'pool',
          sampleStrategy: 'sequential',
          fallbackValue: 'api_unavailable'
        }
      };
    case 'RegEx':
    default:
      return {
        type: 'RegEx',
        config: {
          pattern: '[A-Z]{3}-\\d{4}'
        }
      };
  }
}

/**
 * Serializes BaseEngineConfig to JSON string format.
 */
export function serializeBaseConfig(config: BaseEngineConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Parses BaseEngineConfig from stored string or falls back to legacy formats.
 */
export function parseBaseConfigFromRule(
  rule: string,
  fallbackSubtype?: BaseEngineSubtype
): BaseEngineConfig {
  const trimmed = (rule || '').trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type && parsed.config) {
        return parsed as BaseEngineConfig;
      }
    } catch {
      // not JSON, fallback to heuristic parsing
    }
  }

  const effectiveSubtype = fallbackSubtype || detectBaseSubtype(trimmed);
  const def = createDefaultBaseConfig(effectiveSubtype);

  if (!trimmed) return def;

  switch (effectiveSubtype) {
    case 'Int': {
      const def = createDefaultBaseConfig('Int');
      const parts = trimmed.split(',').map(s => parseInt(s.trim(), 10));
      return {
        type: 'Int',
        config: {
          ...def.config,
          min: !isNaN(parts[0]) ? parts[0] : 1,
          max: !isNaN(parts[1]) ? parts[1] : 100
        }
      };
    }
    case 'Float': {
      const def = createDefaultBaseConfig('Float');
      const parts = trimmed.split(',').map(s => s.trim());
      return {
        type: 'Float',
        config: {
          ...def.config,
          min: parseFloat(parts[0]) || 0.0,
          max: parseFloat(parts[1]) || 100.0,
          decimals: parseInt(parts[2], 10) || 2
        }
      };
    }
    case 'Sequence': {
      const def = createDefaultBaseConfig('Sequence');
      const start = parseInt(trimmed, 10);
      return {
        type: 'Sequence',
        config: {
          ...def.config,
          start: !isNaN(start) ? start : 1
        }
      };
    }
    case 'Set/Enum': {
      const def = createDefaultBaseConfig('Set/Enum');
      const rawItems = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      const items = rawItems.map(item => {
        if (item.includes(':')) {
          const [v, w] = item.split(':').map(p => p.trim());
          return { value: v, weight: parseInt(w, 10) || 10 };
        }
        return { value: item, weight: 10 };
      });
      return {
        type: 'Set/Enum',
        config: {
          ...def.config,
          items: items.length > 0 ? items : def.config.items
        }
      };
    }
    case 'String': {
      const def = createDefaultBaseConfig('String');
      const len = parseInt(trimmed, 10);
      return {
        type: 'String',
        config: {
          ...def.config,
          length: !isNaN(len) && len > 0 ? len : 10
        }
      };
    }
    case 'Boolean': {
      const def = createDefaultBaseConfig('Boolean');
      const pct = parseFloat(trimmed);
      return {
        type: 'Boolean',
        config: {
          ...def.config,
          truePct: !isNaN(pct) ? Math.min(Math.max(pct, 0), 100) : 50
        }
      };
    }
    case 'DateTime': {
      const def = createDefaultBaseConfig('DateTime');
      return {
        type: 'DateTime',
        config: {
          ...def.config,
          format: (trimmed as any) || 'YYYY-MM-DD HH:mm:ss'
        }
      };
    }
    case 'Blob/Hex': {
      const def = createDefaultBaseConfig('Blob/Hex');
      const bytes = parseInt(trimmed, 10);
      return {
        type: 'Blob/Hex',
        config: {
          ...def.config,
          bytes: !isNaN(bytes) && bytes > 0 ? bytes : 6
        }
      };
    }
    case 'UUID': {
      return createDefaultBaseConfig('UUID');
    }
    case 'Entity': {
      const def = createDefaultBaseConfig('Entity');
      return {
        type: 'Entity',
        config: {
          ...def.config,
          subtype: (trimmed as any) || 'full_name'
        }
      };
    }
    case 'REST_API': {
      return {
        type: 'REST_API',
        config: parseRestApiConfig(trimmed)
      };
    }
    case 'RegEx':
    default: {
      return {
        type: 'RegEx',
        config: {
          pattern: trimmed
        }
      };
    }
  }
}

/**
 * Detects the most appropriate Base Engine Subtype based on rule syntax.
 */
export function detectBaseSubtype(rule: string): BaseEngineSubtype {
  if (!rule || !rule.trim()) return 'RegEx';
  const trimmed = rule.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type) return parsed.type;
    } catch {}
  }

  // If starts with http:// or https:// or contains REST_API
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('"type":"REST_API"') || trimmed.includes('"type": "REST_API"')) {
    return 'REST_API';
  }

  // If contains regex characters or named algorithms, it's regex
  if (/[\\\[\]\^\$\(\)\{\}\|\?\*\+]/.test(trimmed) || trimmed === 'thai_id_checksum') {
    return 'RegEx';
  }

  // If a single integer, it can be a sequence start value
  if (/^\d+$/.test(trimmed)) {
    return 'Sequence';
  }

  // If comma separated numbers: "1, 100" or "10.5, 99.5, 2"
  const parts = trimmed.split(',').map(p => p.trim());
  if (parts.length >= 2 && parts.every(p => !isNaN(Number(p)))) {
    if (parts.some(p => p.includes('.'))) {
      return 'Float';
    }
    return 'Int';
  }

  // If comma separated text items, it's an enum pool
  if (trimmed.includes(',')) {
    return 'Set/Enum';
  }

  return 'RegEx';
}

/**
 * Generates values with full advanced configuration in Base Engine.
 */
export function generateFromBaseConfig(
  config: BaseEngineConfig,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): unknown {
  switch (config.type) {
    case 'Int': {
      const {
        min,
        max,
        step = 1,
        padZeros = 0,
        thousandsSeparator = 'none',
        signDisplay = 'default',
        prefix = '',
        suffix = '',
        distribution = 'uniform'
      } = config.config;

      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      let raw: number;
      if (distribution === 'normal') {
        const r = (Math.random() + Math.random() + Math.random()) / 3;
        raw = lo + r * (hi - lo);
      } else if (distribution === 'min_heavy') {
        raw = lo + (hi - lo) * Math.pow(Math.random(), 2);
      } else if (distribution === 'max_heavy') {
        raw = lo + (hi - lo) * (1 - Math.pow(Math.random(), 2));
      } else {
        raw = lo + Math.random() * (hi - lo + 1);
      }

      let rounded = Math.floor(raw);
      if (step > 1) {
        rounded = Math.round((rounded - lo) / step) * step + lo;
      }
      rounded = Math.max(lo, Math.min(hi, rounded));

      let numStr = Math.abs(rounded).toString();
      if (padZeros > 0) {
        numStr = numStr.padStart(padZeros, '0');
      }

      if (thousandsSeparator !== 'none') {
        const sep = thousandsSeparator === 'comma' ? ',' : thousandsSeparator === 'dot' ? '.' : thousandsSeparator === 'space' ? ' ' : '_';
        numStr = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      }

      let sign = '';
      if (rounded < 0) sign = '-';
      else if (signDisplay === 'always') sign = '+';

      return `${prefix}${sign}${numStr}${suffix}`;
    }

    case 'Float': {
      const {
        min,
        max,
        decimals = 2,
        padDecimals = true,
        decimalSeparator = '.',
        thousandsSeparator = 'none',
        rounding = 'round',
        prefix = '',
        suffix = ''
      } = config.config;

      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      let val = lo + Math.random() * (hi - lo);
      const factor = Math.pow(10, decimals);
      if (rounding === 'floor') val = Math.floor(val * factor) / factor;
      else if (rounding === 'ceil') val = Math.ceil(val * factor) / factor;
      else if (rounding === 'truncate') val = Math.trunc(val * factor) / factor;
      else val = Math.round(val * factor) / factor;

      let str = padDecimals ? val.toFixed(decimals) : String(val);
      const [intPart, decPart] = str.split('.');
      let formattedInt = intPart;
      if (thousandsSeparator !== 'none') {
        const sep = thousandsSeparator === 'comma' ? ',' : thousandsSeparator === 'dot' ? '.' : ' ';
        formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      }
      const result = decPart !== undefined ? `${formattedInt}${decimalSeparator}${decPart}` : formattedInt;
      return `${prefix}${result}${suffix}`;
    }

    case 'String': {
      const {
        lengthMode = 'fixed',
        length = 10,
        minLength = 6,
        maxLength = 16,
        charset = 'alphanumeric',
        customCharset,
        casing = 'original',
        prefix = '',
        suffix = ''
      } = config.config;

      const targetLen = lengthMode === 'range'
        ? Math.floor(Math.random() * (Math.max(minLength, maxLength) - Math.min(minLength, maxLength) + 1)) + Math.min(minLength, maxLength)
        : (length || 10);

      let pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      if (charset === 'alpha') pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      else if (charset === 'alpha_upper') pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      else if (charset === 'alpha_lower') pool = 'abcdefghijklmnopqrstuvwxyz';
      else if (charset === 'numeric') pool = '0123456789';
      else if (charset === 'hex') pool = '0123456789ABCDEF';
      else if (charset === 'symbols') pool = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+-=';
      else if (charset === 'custom' && customCharset) pool = customCharset;

      let out = '';
      for (let i = 0; i < targetLen; i++) {
        out += pool.charAt(Math.floor(Math.random() * pool.length));
      }
      if (casing === 'upper') out = out.toUpperCase();
      else if (casing === 'lower') out = out.toLowerCase();
      else if (casing === 'capitalize') out = out.charAt(0).toUpperCase() + out.slice(1).toLowerCase();

      return `${prefix}${out}${suffix}`;
    }

    case 'Boolean': {
      const { truePct = 50, format = 'true_false', customTrue = 'Yes', customFalse = 'No' } = config.config;
      const isTrue = Math.random() * 100 < truePct;
      switch (format) {
        case 'True_False': return isTrue ? 'True' : 'False';
        case 'TRUE_FALSE': return isTrue ? 'TRUE' : 'FALSE';
        case '1_0': return isTrue ? 1 : 0;
        case 'yes_no': return isTrue ? 'Yes' : 'No';
        case 'Y_N': return isTrue ? 'Y' : 'N';
        case 'enabled_disabled': return isTrue ? 'Enabled' : 'Disabled';
        case 'active_inactive': return isTrue ? 'Active' : 'Inactive';
        case 'custom': return isTrue ? customTrue : customFalse;
        case 'true_false':
        default: return isTrue;
      }
    }

    case 'DateTime': {
      const { range = 'past_30d', startDate, endDate, format = 'YYYY-MM-DD HH:mm:ss', businessOnly = false } = config.config;
      const now = Date.now();
      let time = now;
      const dayMs = 24 * 3600 * 1000;
      if (range === 'past_30d') time = now - Math.random() * 30 * dayMs;
      else if (range === 'past_90d') time = now - Math.random() * 90 * dayMs;
      else if (range === 'past_year') time = now - Math.random() * 365 * dayMs;
      else if (range === 'past_5y') time = now - Math.random() * 5 * 365 * dayMs;
      else if (range === 'future_30d') time = now + Math.random() * 30 * dayMs;
      else if (range === 'future_year') time = now + Math.random() * 365 * dayMs;
      else if (range === 'today') {
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        time = startOfToday + Math.random() * (Date.now() - startOfToday);
      } else if (range === 'custom_range' && startDate && endDate) {
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        time = s + Math.random() * (e - s);
      }

      const d = new Date(time);
      if (businessOnly) {
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        if (d.getDay() === 6) d.setDate(d.getDate() - 1);
        const h = 9 + Math.floor(Math.random() * 9);
        d.setHours(h);
      }

      if (format === 'ISO') return d.toISOString();
      if (format === 'timestamp_s') return Math.floor(d.getTime() / 1000).toString();
      if (format === 'timestamp_ms') return d.getTime().toString();
      if (format === 'YYYY-MM-DD') return d.toISOString().split('T')[0];
      if (format === 'HH:mm:ss') return d.toTimeString().split(' ')[0];

      const pad = (n: number) => n.toString().padStart(2, '0');
      const YYYY = d.getFullYear();
      const MM = pad(d.getMonth() + 1);
      const DD = pad(d.getDate());
      const HH = pad(d.getHours());
      const mm = pad(d.getMinutes());
      const ss = pad(d.getSeconds());

      if (format === 'MM/DD/YYYY') return `${MM}/${DD}/${YYYY}`;
      if (format === 'DD/MM/YYYY') return `${DD}/${MM}/${YYYY}`;
      return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
    }

    case 'Sequence': {
      const { start = 1, step = 1, padZeros = 0, cycleAt, base = 'decimal', prefix = '', suffix = '' } = config.config;
      const idx = context?.rowIndex ?? 0;
      let num = start + idx * step;
      if (cycleAt && cycleAt > 0) {
        num = start + ((idx * step) % cycleAt);
      }
      let str = '';
      if (base === 'hex') {
        str = Math.abs(num).toString(16).toUpperCase();
      } else if (base === 'alpha') {
        let n = Math.abs(num);
        while (n > 0) {
          n--;
          str = String.fromCharCode(65 + (n % 26)) + str;
          n = Math.floor(n / 26);
        }
        if (!str) str = 'A';
      } else {
        str = Math.abs(num).toString();
      }

      if (padZeros > 0) {
        str = str.padStart(padZeros, '0');
      }
      const sign = num < 0 ? '-' : '';
      return `${prefix}${sign}${str}${suffix}`;
    }

    case 'Set/Enum': {
      const {
        items = [],
        selectionMode = 'single',
        multiMin = 1,
        multiMax = 2,
        multiDelimiter = ', ',
        strategy = 'weighted',
        quote = 'none'
      } = config.config;

      if (!items || items.length === 0) return 'Choice';

      const pickOne = (availItems: { value: string; weight: number }[]): string => {
        if (strategy === 'uniform') {
          return availItems[Math.floor(Math.random() * availItems.length)].value;
        }
        if (strategy === 'round_robin') {
          const idx = context?.rowIndex ?? 0;
          return availItems[idx % availItems.length].value;
        }
        let totalWeight = 0;
        for (const it of availItems) totalWeight += Math.max(1, it.weight || 1);
        let r = Math.random() * totalWeight;
        for (const it of availItems) {
          const w = Math.max(1, it.weight || 1);
          if (r < w) return it.value;
          r -= w;
        }
        return availItems[0].value;
      };

      const applyQuote = (val: string) => {
        if (quote === 'single') return `'${val}'`;
        if (quote === 'double') return `"${val}"`;
        return val;
      };

      if (selectionMode === 'multi') {
        const count = Math.min(
          items.length,
          Math.floor(Math.random() * (Math.max(multiMin, multiMax) - Math.min(multiMin, multiMax) + 1)) + Math.min(multiMin, multiMax)
        );
        const pool = [...items];
        const picked: string[] = [];
        for (let i = 0; i < count && pool.length > 0; i++) {
          const it = pickOne(pool);
          picked.push(applyQuote(it));
          const idx = pool.findIndex(p => p.value === it);
          if (idx !== -1) pool.splice(idx, 1);
        }
        return picked.join(multiDelimiter);
      }

      return applyQuote(pickOne(items));
    }

    case 'RegEx': {
      const { pattern } = config.config;
      return generateRegexString(pattern || '[A-Z]{3}-\\d{4}');
    }

    case 'Blob/Hex': {
      const { bytes = 6, encoding = 'hex_delimited', delimiter = '-', casing = 'upper' } = config.config;
      const count = Math.min(Math.max(1, bytes), 256);
      const arr = new Uint8Array(count);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
      } else {
        for (let i = 0; i < count; i++) arr[i] = Math.floor(Math.random() * 256);
      }

      if (encoding === 'base64') {
        let binary = '';
        for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
        return btoa(binary);
      }
      if (encoding === 'binary') {
        return Array.from(arr).map(b => b.toString(2).padStart(8, '0')).join(' ');
      }

      const hexBytes = Array.from(arr).map(b => {
        const h = b.toString(16).padStart(2, '0');
        return casing === 'upper' ? h.toUpperCase() : h.toLowerCase();
      });

      if (encoding === 'hex_0x') {
        return `0x${hexBytes.join('')}`;
      }
      if (encoding === 'hex_continuous') {
        return hexBytes.join('');
      }
      return hexBytes.join(delimiter);
    }

    case 'UUID': {
      const { version = 'v4', hyphens = true, casing = 'lower', urnPrefix = false } = config.config;
      let id = '';
      if (version === 'nanoid') {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
        for (let i = 0; i < 21; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
        return id;
      }
      if (version === 'short') {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
      }
      if (version === 'v7') {
        const timestamp = Date.now();
        const timeHex = timestamp.toString(16).padStart(12, '0');
        const randA = Math.floor(Math.random() * 0xfff).toString(16).padStart(3, '0');
        const randB = Math.floor(Math.random() * 0x3fff | 0x8000).toString(16);
        const randC = Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0');
        id = `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${randA}-${randB}-${randC}`;
      } else {
        id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      }

      if (!hyphens) {
        id = id.replace(/-/g, '');
      }
      if (casing === 'upper') {
        id = id.toUpperCase();
      } else {
        id = id.toLowerCase();
      }
      if (urnPrefix) {
        id = `urn:uuid:${id}`;
      }
      return id;
    }

    case 'Entity': {
      const {
        subtype = 'full_name',
        emailDomain,
        phoneFormat = 'international',
        customItems,
        customEntityId
      } = config.config;

      // 1. Direct custom items array in config
      if (customItems && Array.isArray(customItems) && customItems.length > 0) {
        return customItems[Math.floor(Math.random() * customItems.length)];
      }

      // 2. Custom entity ID or non-builtin subtype lookup in registry
      const registered = getRegisteredCustomEntities();
      if (customEntityId) {
        const found = registered.find(e => e.id === customEntityId);
        if (found && found.items.length > 0) {
          return found.items[Math.floor(Math.random() * found.items.length)];
        }
      }

      const isBuiltIn = [
        'full_name', 'first_name', 'last_name', 'email', 'phone',
        'company', 'job_title', 'country', 'city', 'ip_address', 'user_agent', 'url'
      ].includes(subtype);

      if (!isBuiltIn || subtype.startsWith('entity:') || subtype.startsWith('custom:')) {
        const matched = registered.find(
          e => e.id === subtype || e.name.toLowerCase() === subtype.toLowerCase()
        );
        if (matched && matched.items.length > 0) {
          return matched.items[Math.floor(Math.random() * matched.items.length)];
        }
      }

      switch (subtype) {
        case 'first_name':
          return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        case 'last_name':
          return LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        case 'company':
          return COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
        case 'job_title':
          return JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
        case 'country':
          return COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        case 'city': {
          const list = CITIES['Default'] || ['New York', 'London', 'Tokyo'];
          return list[Math.floor(Math.random() * list.length)];
        }
        case 'user_agent':
          return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        case 'ip_address':
          return `${Math.floor(Math.random() * 220 + 10)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254 + 1)}`;
        case 'url':
          return `https://${COMPANIES[Math.floor(Math.random() * COMPANIES.length)].toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
        case 'email': {
          const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)].toLowerCase();
          const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)].toLowerCase();
          const domain = emailDomain ? (emailDomain.startsWith('@') ? emailDomain.slice(1) : emailDomain) : EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
          return `${fn}.${ln}@${domain}`;
        }
        case 'phone': {
          if (phoneFormat === 'us') {
            return `(${Math.floor(Math.random() * 800 + 200)}) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
          }
          if (phoneFormat === 'local') {
            return `0${Math.floor(Math.random() * 8 + 2)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
          }
          return `+1-${Math.floor(Math.random() * 800 + 200)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
        }
        case 'full_name':
        default: {
          const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
          const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
          return `${fn} ${ln}`;
        }
      }
    }

    case 'REST_API': {
      return getSynchronousRestApiValue(config.config, context);
    }

    default:
      return 'N/A';
  }
}

/**
 * Base Engine Value Generator:
 * Evaluates standard built-in rules with deep advanced settings.
 */
export function generateBaseEngineValue(
  rule: string,
  subtype?: BaseEngineSubtype,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): unknown {
  const config = parseBaseConfigFromRule(rule, subtype);
  return generateFromBaseConfig(config, context);
}

// Live generator for custom column types
export function generateCustomTypeValue(
  type: CustomColumnType,
  overrideRule?: string,
  context?: { rowIndex?: number; row?: Record<string, unknown> }
): unknown {
  const rule = (overrideRule !== undefined ? overrideRule : type.defaultRule || '').trim();
  const scriptCtx = (type.baseMode === 'Script' || type.baseMode === 'Lua')
    ? createScriptContext(context?.rowIndex ?? 0, context?.row ?? {})
    : null;

  switch (type.baseMode) {
    case 'Script': {
      const res = executeJavaScriptScript(rule, scriptCtx!);
      if (!res.success) {
        return `[JS Error: ${res.error}]`;
      }
      return res.result;
    }

    case 'Lua': {
      const res = executeLuaScript(rule, scriptCtx!);
      if (!res.success) {
        return `[Lua Error: ${res.error}]`;
      }
      return res.result;
    }

    case 'Template':
      return generateFromTemplate(rule, context);

    case 'Base':
    case 'RegEx':
    case 'Set/Enum':
    case 'Int':
    case 'Float':
    case 'Sequence':
    default: {
      if (type.baseConfig && (!overrideRule || overrideRule === type.defaultRule)) {
        return generateFromBaseConfig(type.baseConfig, context);
      }
      return generateBaseEngineValue(rule, type.baseSubtype, context);
    }
  }
}

// Generate multiple sample values for UI preview
export function getCustomTypeSamples(
  type: CustomColumnType,
  count = 5,
  context?: { row?: Record<string, unknown> }
): string[] {
  const samples: string[] = [];
  for (let i = 0; i < count; i++) {
    const val = generateCustomTypeValue(type, undefined, {
      rowIndex: i,
      row: context?.row || {}
    });
    samples.push(val === null || val === undefined ? '' : String(val));
  }
  return samples;
}
