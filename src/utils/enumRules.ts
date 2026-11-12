export interface EnumRuleItem {
  value: string;
  weight: number;
}

interface CompiledEnumSampler {
  items: { value: string; scaledWeight: number }[];
  total: number;
}

const enumCache = new Map<string, EnumRuleItem[]>();
const samplerCache = new Map<string, CompiledEnumSampler>();
const MAX_CACHE_ENTRIES = 500;

function trimCache<K, V>(map: Map<K, V>) {
  if (map.size > MAX_CACHE_ENTRIES) {
    const it = map.keys();
    for (let i = 0; i < 50; i++) {
      const next = it.next();
      if (next.done) break;
      map.delete(next.value);
    }
  }
}

/** Supports existing comma/weight rules and lossless JSON choices for labels containing delimiters. */
export function parseEnumRule(rule: string): EnumRuleItem[] {
  if (!rule?.trim()) return [];
  const text = rule.trim();
  const cached = enumCache.get(text);
  if (cached) return cached;

  let result: EnumRuleItem[] = [];

  if (/^\{\s*"values"\s*:/.test(text)) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).values)) {
        const values = (parsed as any).values;
        if (values.every((item: unknown) => !!item && typeof item === 'object' &&
          typeof (item as any).value === 'string' && typeof (item as any).weight === 'number' &&
          Number.isFinite((item as any).weight) && (item as any).weight >= 0)) {
          result = values.map((item: EnumRuleItem) => ({ value: item.value, weight: item.weight }));
        }
      }
    } catch {
      result = [];
    }
  } else {
    result = text.split(',').map(value => value.trim()).filter(Boolean).map(value => {
      const colon = value.lastIndexOf(':');
      const suffix = value.slice(colon + 1).trim();
      if (colon > 0 && /^\d+(?:\.\d+)?$/.test(suffix) && Number.isFinite(Number(suffix))) {
        return { value: value.slice(0, colon).trim(), weight: Number(suffix) };
      }
      return { value, weight: 1 };
    });
  }

  trimCache(enumCache);
  enumCache.set(text, result);
  return result;
}

/** Keep common status rules readable; switch representation only when legacy separators lose data. */
export function serializeEnumRule(items: EnumRuleItem[]): string {
  const values = items.filter(item => typeof item.value === 'string' && Number.isFinite(item.weight) && item.weight >= 0);
  if (!values.length) return '';
  const needsJson = values.some(item => !item.value || item.value !== item.value.trim() || /[,\r\n]/.test(item.value) || /e/i.test(String(item.weight)))
    || values[0].value.trimStart().startsWith('{');
  return needsJson ? JSON.stringify({ values }) : values.map(item => `${item.value}:${item.weight}`).join(', ');
}

export function sampleEnumRule(rule: string, random: () => number = Math.random): string {
  if (!rule?.trim()) return '';
  const text = rule.trim();

  let sampler = samplerCache.get(text);
  if (!sampler) {
    const items = parseEnumRule(text).filter(item => item.weight > 0);
    if (!items.length) return '';
    const scale = items.reduce((max, item) => Math.max(max, item.weight), 0) || 1;
    const scaledItems = items.map(item => ({
      value: item.value,
      scaledWeight: item.weight / scale,
    }));
    const total = scaledItems.reduce((sum, item) => sum + item.scaledWeight, 0);
    sampler = { items: scaledItems, total };

    trimCache(samplerCache);
    samplerCache.set(text, sampler);
  }

  if (sampler.items.length === 0) return '';
  let remaining = random() * sampler.total;
  for (const item of sampler.items) {
    remaining -= item.scaledWeight;
    if (remaining < 0) return item.value;
  }
  return sampler.items[sampler.items.length - 1].value;
}
