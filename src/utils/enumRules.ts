export interface EnumRuleItem {
  value: string;
  weight: number;
}

/** Supports existing comma/weight rules and lossless JSON choices for labels containing delimiters. */
export function parseEnumRule(rule: string): EnumRuleItem[] {
  if (!rule?.trim()) return [];
  const text = rule.trim();
  if (/^\{\s*"values"\s*:/.test(text)) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).values)) return [];
      const values = (parsed as any).values;
      if (!values.every((item: unknown) => !!item && typeof item === 'object' &&
        typeof (item as any).value === 'string' && typeof (item as any).weight === 'number' &&
        Number.isFinite((item as any).weight) && (item as any).weight >= 0)) return [];
      return values.map((item: EnumRuleItem) => ({ value: item.value, weight: item.weight }));
    } catch {
      return [];
    }
  }
  return text.split(',').map(value => value.trim()).filter(Boolean).map(value => {
    const colon = value.lastIndexOf(':');
    const suffix = value.slice(colon + 1).trim();
    if (colon > 0 && /^\d+(?:\.\d+)?$/.test(suffix) && Number.isFinite(Number(suffix))) {
      return { value: value.slice(0, colon).trim(), weight: Number(suffix) };
    }
    return { value, weight: 1 };
  });
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
  const items = parseEnumRule(rule).filter(item => item.weight > 0);
  if (!items.length) return '';
  // Normalize first so large finite weights cannot overflow their sum.
  const scale = items.reduce((max, item) => Math.max(max, item.weight), 0);
  const total = items.reduce((sum, item) => sum + item.weight / scale, 0);
  let remaining = random() * total;
  for (const item of items) {
    remaining -= item.weight / scale;
    if (remaining < 0) return item.value;
  }
  return items[items.length - 1].value;
}
