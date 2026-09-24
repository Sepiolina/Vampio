import { ColumnSpec, EntitySubtype } from '../types';
import { getCustomColumnTypes, getExamplePresetTypes, generateCustomTypeValue, getRegisteredCustomEntities } from './customTypesManager';
import { getSynchronousRestApiValue, parseRestApiConfig } from './restApiManager';
import { generateRegexString } from './regexSynthesizer';

// Realistic datasets for Entity generator
export const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
  'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Elena', 'Mateo',
  'Aria', 'Sebastian', 'Chloe', 'Jack', 'Layla', 'Daniel', 'Zoe', 'Leo'
];

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez'
];

export const COMPANIES = [
  'Apex Dynamics', 'Nexus Solutions', 'Vanguard Systems', 'Horizon Global',
  'Stratum Analytics', 'Cipher Labs', 'Aether Corp', 'Prism Cloud',
  'Cobalt Robotics', 'OmniPulse Tech', 'Solstice Media', 'Zenith Logistics'
];

export const JOB_TITLES = [
  'Senior Software Engineer', 'Product Manager', 'Data Scientist',
  'UX/UI Designer', 'DevOps Architect', 'QA Automation Engineer',
  'VP of Engineering', 'Security Analyst', 'Solutions Architect',
  'Machine Learning Specialist', 'Database Administrator', 'Technical Writer'
];

export const COUNTRIES = [
  'United States', 'Germany', 'United Kingdom', 'Japan', 'Canada',
  'France', 'Australia', 'Netherlands', 'Singapore', 'Switzerland',
  'Sweden', 'Brazil', 'South Korea', 'India', 'Ireland'
];

export const CITIES: Record<string, string[]> = {
  'United States': ['San Francisco', 'New York', 'Seattle', 'Austin', 'Boston', 'Chicago'],
  'Germany': ['Berlin', 'Munich', 'Frankfurt', 'Hamburg'],
  'United Kingdom': ['London', 'Manchester', 'Edinburgh', 'Bristol'],
  'Japan': ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary'],
  'Singapore': ['Singapore'],
  'Default': ['Metropolis', 'Riverdale', 'Central City', 'Starling City', 'Gotham']
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.186 Mobile Safari/537.36'
];

export const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'corp-net.io', 'techgroup.com', 'icloud.com', 'proton.me'];

export class GeneratorEngine {
  private sequenceState: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.sequenceState.clear();
  }

  public generateRow(
    specs: ColumnSpec[],
    rowIndex: number = 0
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    const skippedColumns: Map<string, boolean> = new Map();

    for (const col of specs) {
      let actionTaken = false;

      // 1. Evaluate Conditional Dependency Rules if configured
      if (col.dependencyCases && col.dependencyCases.length > 0) {
        for (const depCase of col.dependencyCases) {
          const parentName = (depCase.parentColumn || col.condition || '').trim();
          if (!parentName) continue;

          const parentVal = row[parentName];
          const isParentNull = parentVal === null || parentVal === undefined || parentVal === '';

          let isMatch = false;
          switch (depCase.operator) {
            case 'is_null':
              isMatch = isParentNull;
              break;
            case 'is_not_null':
              isMatch = !isParentNull;
              break;
            case 'equals': {
              const targetVal = String(depCase.value ?? '').trim().toLowerCase();
              if (targetVal === 'null' || targetVal === '<null>') {
                isMatch = isParentNull;
              } else if (!isParentNull) {
                isMatch = String(parentVal).trim().toLowerCase() === targetVal;
              } else {
                isMatch = targetVal === '';
              }
              break;
            }
            case 'not_equals': {
              const targetVal = String(depCase.value ?? '').trim().toLowerCase();
              if (targetVal === 'null' || targetVal === '<null>') {
                isMatch = !isParentNull;
              } else if (!isParentNull) {
                isMatch = String(parentVal).trim().toLowerCase() !== targetVal;
              } else {
                isMatch = targetVal !== '';
              }
              break;
            }
            case 'contains':
              if (!isParentNull) {
                isMatch = String(parentVal).toLowerCase().includes(String(depCase.value ?? '').trim().toLowerCase());
              }
              break;
            case 'greater_than': {
              const numP = Number(parentVal);
              const numV = Number(depCase.value);
              if (!isNaN(numP) && !isNaN(numV)) {
                isMatch = numP > numV;
              }
              break;
            }
            case 'less_than': {
              const numP = Number(parentVal);
              const numV = Number(depCase.value);
              if (!isNaN(numP) && !isNaN(numV)) {
                isMatch = numP < numV;
              }
              break;
            }
          }

          if (isMatch) {
            actionTaken = true;
            if (depCase.action === 'skip') {
              skippedColumns.set(col.name, true);
              row[col.name] = null;
            } else if (depCase.action === 'set_value') {
              skippedColumns.set(col.name, false);
              let val: any = depCase.actionValue ?? '';
              if (typeof val === 'string') {
                const lower = val.trim().toLowerCase();
                if (lower === 'null') val = null;
                else if (lower === 'true') val = true;
                else if (lower === 'false') val = false;
                else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
              }
              row[col.name] = val;
              if (val === null) skippedColumns.set(col.name, true);
            } else if (depCase.action === 'type_override') {
              const overrideCol: ColumnSpec = {
                ...col,
                type: depCase.actionType || col.type,
                rule: depCase.actionValue !== undefined && depCase.actionValue !== '' ? depCase.actionValue : col.rule
              };
              const val = this.generateValue(overrideCol, row, rowIndex);
              skippedColumns.set(col.name, false);
              row[col.name] = val;
            }
            break; // First matching case wins
          }
        }
      } else if (col.condition && col.condition.trim() !== '') {
        // Simple default: if parent column was skipped or is null, skip this
        const parentSkipped = skippedColumns.get(col.condition) ?? false;
        const parentVal = row[col.condition];
        if (parentSkipped || parentVal === null || parentVal === undefined) {
          skippedColumns.set(col.name, true);
          row[col.name] = null;
          actionTaken = true;
        }
      }

      if (actionTaken) {
        continue;
      }

      // If dependency cases evaluated without match, check fallback action
      if (col.dependencyCases && col.dependencyCases.length > 0 && col.fallbackAction) {
        if (col.fallbackAction === 'skip') {
          skippedColumns.set(col.name, true);
          row[col.name] = null;
          continue;
        } else if (col.fallbackAction === 'set_value') {
          let val: any = col.fallbackValue ?? '';
          if (typeof val === 'string' && val.trim().toLowerCase() === 'null') val = null;
          row[col.name] = val;
          skippedColumns.set(col.name, val === null);
          continue;
        }
      }

      // 2. Check skip probability (null rate)
      if (col.skip_pct > 0 && Math.random() * 100 < col.skip_pct) {
        skippedColumns.set(col.name, true);
        row[col.name] = null;
        continue;
      }

      // 3. Generate value
      const val = this.generateValue(col, row, rowIndex);
      skippedColumns.set(col.name, false);
      row[col.name] = val;
    }

    return row;
  }

  public generateBatch(
    specs: ColumnSpec[],
    count: number
  ): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.generateRow(specs, i));
    }
    return results;
  }

  private generateValue(
    col: ColumnSpec,
    rowContext: Record<string, unknown>,
    rowIndex: number
  ): unknown {
    const rule = (col.rule || '').trim();

    // Check custom column type registration
    if (col.type?.startsWith('custom:') || col.type?.startsWith('example:') || col.customTypeId) {
      const targetId = col.customTypeId || col.type;
      const customTypes = getCustomColumnTypes();
      const examplePresets = getExamplePresetTypes();
      const customType = customTypes.find(t => t.id === targetId || t.name === col.type)
        || examplePresets.find(t => t.id === targetId || t.name === col.type);
      if (customType) {
        return generateCustomTypeValue(customType, rule, { rowIndex, row: rowContext });
      }
    }

    switch (col.type) {
      case 'Sequence': {
        const key = col.id || col.name;
        let current = this.sequenceState.get(key);
        if (current === undefined) {
          // Parse start value from rule
          const start = parseInt(rule, 10);
          current = isNaN(start) ? 1 : start;
        }
        const val = current;
        this.sequenceState.set(key, current + 1);
        return val;
      }

      case 'Int': {
        const parts = rule.split(',').map((p) => p.trim());
        const min = parts[0] ? parseInt(parts[0], 10) : 1;
        const max = parts[1] ? parseInt(parts[1], 10) : 100;
        const lo = isNaN(min) ? 1 : min;
        const hi = isNaN(max) ? 100 : max;
        return Math.floor(Math.random() * (hi - lo + 1)) + lo;
      }

      case 'Float': {
        const parts = rule.split(',').map((p) => p.trim());
        const min = parts[0] ? parseFloat(parts[0]) : 0.0;
        const max = parts[1] ? parseFloat(parts[1]) : 100.0;
        const decimals = parts[2] ? parseInt(parts[2], 10) : 2;
        const lo = isNaN(min) ? 0.0 : min;
        const hi = isNaN(max) ? 100.0 : max;
        const dec = isNaN(decimals) ? 2 : Math.min(Math.max(decimals, 0), 8);
        const val = Math.random() * (hi - lo) + lo;
        return Number(val.toFixed(dec));
      }

      case 'String': {
        const len = parseInt(rule, 10);
        const length = isNaN(len) || len <= 0 ? 10 : Math.min(len, 256);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let str = '';
        for (let i = 0; i < length; i++) {
          str += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return str;
      }

      case 'Boolean': {
        const pct = parseFloat(rule);
        const ratio = !isNaN(pct) && pct >= 0 && pct <= 100 ? pct / 100 : 0.5;
        return Math.random() < ratio;
      }

      case 'UUID': {
        return crypto.randomUUID ? crypto.randomUUID() : this.fallbackUUID();
      }

      case 'DateTime': {
        return this.generateDateTime(rule);
      }

      case 'Set/Enum': {
        return this.generateEnum(rule);
      }

      case 'RegEx': {
        return this.generateRegexLike(rule);
      }

      case 'Blob/Hex': {
        const byteCount = parseInt(rule, 10);
        const count = isNaN(byteCount) || byteCount <= 0 ? 6 : Math.min(byteCount, 64);
        const bytes: string[] = [];
        for (let i = 0; i < count; i++) {
          const byte = Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
          bytes.push(byte);
        }
        return bytes.join('-');
      }

      case 'Calculation': {
        return this.evaluateCalculation(rule, rowContext);
      }

      case 'Entity': {
        return this.generateEntity(rule);
      }

      case 'REST_API': {
        const config = parseRestApiConfig(rule);
        return getSynchronousRestApiValue(config, { rowIndex, row: rowContext });
      }

      default:
        return 'N/A';
    }
  }

  private fallbackUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private generateDateTime(rule: string): string {
    // rule can be a format or range: e.g. "ISO", "past_30d", "YYYY-MM-DD", "timestamp"
    const now = new Date();
    let target = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 3600 * 1000));

    if (rule.toLowerCase().includes('future')) {
      target = new Date(now.getTime() + Math.floor(Math.random() * 30 * 24 * 3600 * 1000));
    } else if (rule.toLowerCase().includes('today') || rule.toLowerCase().includes('now')) {
      target = now;
    }

    if (rule.toLowerCase() === 'timestamp' || rule.toLowerCase() === 'unix') {
      return Math.floor(target.getTime() / 1000).toString();
    }

    if (rule.toLowerCase() === 'date' || rule === 'YYYY-MM-DD') {
      return target.toISOString().split('T')[0];
    }

    if (rule.toLowerCase() === 'time') {
      return target.toTimeString().split(' ')[0];
    }

    // Default: "YYYY-MM-DD HH:mm:ss"
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = target.getFullYear();
    const m = pad(target.getMonth() + 1);
    const d = pad(target.getDate());
    const h = pad(target.getHours());
    const min = pad(target.getMinutes());
    const s = pad(target.getSeconds());

    if (rule.toLowerCase() === 'iso') {
      return target.toISOString();
    }

    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }

  private generateEnum(rule: string): string {
    if (!rule) return '';
    // Check if weighted: e.g. "Active:70, Pending:20, Inactive:10"
    const items = rule.split(',').map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return '';

    const weighted: { val: string; weight: number }[] = [];
    let hasWeights = false;

    for (const item of items) {
      if (item.includes(':')) {
        const [v, w] = item.split(':').map((s) => s.trim());
        const weight = parseFloat(w);
        if (!isNaN(weight) && weight > 0) {
          hasWeights = true;
          weighted.push({ val: v, weight });
          continue;
        }
      }
      weighted.push({ val: item, weight: 1 });
    }

    if (hasWeights) {
      const totalWeight = weighted.reduce((acc, curr) => acc + curr.weight, 0);
      let randomVal = Math.random() * totalWeight;
      for (const entry of weighted) {
        if (randomVal <= entry.weight) {
          return entry.val;
        }
        randomVal -= entry.weight;
      }
      return weighted[0].val;
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex];
  }

  private generateRegexLike(pattern: string): string {
    return generateRegexString(pattern);
  }

  private evaluateCalculation(
    formula: string,
    rowContext: Record<string, unknown>
  ): number | string {
    if (!formula) return 0;
    try {
      // Replace tokens like {ColumnName} with numeric values
      let expr = formula;
      const tokenRegex = /\{([^}]+)\}/g;
      expr = expr.replace(tokenRegex, (_, colName) => {
        const val = rowContext[colName];
        if (val === null || val === undefined) return '0';
        const num = Number(val);
        return isNaN(num) ? '0' : num.toString();
      });

      // Sanitization check: only allow numbers, math operators, parens, Math functions, commas, spaces
      if (!/^[0-9+\-*/().,% Math\.minmaxroundceilfloorsqrtabs\s]+$/.test(expr)) {
        return 'CALC_INVALID_CHARS';
      }

      // Safe evaluated math expression
      // eslint-disable-next-line no-new-func
      const func = new Function(`return (${expr});`);
      const res = func();
      if (typeof res === 'number') {
        if (isNaN(res) || !isFinite(res)) return 0;
        return Number(res.toFixed(4));
      }
      return 'CALC_ERR';
    } catch {
      return 'CALC_SYNTAX_ERR';
    }
  }

  private generateEntity(subtype: string): string {
    let cleanSubtype = (subtype || 'full_name').trim();

    // 1. JSON rule format check
    if (cleanSubtype.startsWith('{') && cleanSubtype.includes('Entity')) {
      try {
        const parsed = JSON.parse(cleanSubtype);
        if (parsed.type === 'Entity' && parsed.config) {
          if (parsed.config.customItems && parsed.config.customItems.length > 0) {
            const arr = parsed.config.customItems;
            return arr[Math.floor(Math.random() * arr.length)];
          }
          if (parsed.config.subtype) {
            cleanSubtype = parsed.config.subtype;
          }
        }
      } catch {}
    }

    // 2. Custom Entity registry check
    const registered = getRegisteredCustomEntities();
    const matched = registered.find(
      e => e.id === cleanSubtype || e.name.toLowerCase() === cleanSubtype.toLowerCase()
    );
    if (matched && matched.items.length > 0) {
      return matched.items[Math.floor(Math.random() * matched.items.length)];
    }

    const type = cleanSubtype.toLowerCase();
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

    switch (type) {
      case 'first_name':
        return fn;
      case 'last_name':
        return ln;
      case 'full_name':
        return `${fn} ${ln}`;
      case 'email': {
        const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
        return `${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}`;
      }
      case 'phone': {
        const area = Math.floor(Math.random() * 800) + 200;
        const mid = Math.floor(Math.random() * 900) + 100;
        const last = Math.floor(Math.random() * 9000) + 1000;
        return `+1 (${area}) ${mid}-${last}`;
      }
      case 'company':
        return COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
      case 'job_title':
        return JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
      case 'country':
        return COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      case 'city': {
        const randomCountry = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        const cities = CITIES[randomCountry] || CITIES['Default'];
        return cities[Math.floor(Math.random() * cities.length)];
      }
      case 'ip_address': {
        return `${Math.floor(Math.random() * 220) + 10}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
      }
      case 'user_agent':
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      case 'url': {
        const slug = `${fn.toLowerCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        return `https://cloud-api.internal/v1/records/${slug}`;
      }
      default:
        return `${fn} ${ln}`;
    }
  }
}
