import type { ColumnType } from '../types';
import { serializeEnumRule } from './enumRules';

/** Keep the same bounded row population for type decisions, frequencies and missing-value statistics. */
export const MAX_INFERENCE_RECORDS = 200;

export interface ColumnInferenceMetadata {
  inferenceReason: string;
  inferenceConfidence: number;
  sampleCount: number;
  nonNullCount: number;
  distinctCount: number;
  nullRatio: number;
  valueFrequencies: { value: string; count: number }[];
}

export interface ColumnInference extends ColumnInferenceMetadata {
  inferredType: ColumnType;
  inferredRule: string;
  sampleValues: string[];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const missing = (value: unknown) => value === null || value === undefined || typeof value === 'string' && !value.trim();
const asText = (value: unknown): string => typeof value === 'object' ? JSON.stringify(value) : String(value);

function validDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === +y && date.getUTCMonth() + 1 === +m && date.getUTCDate() === +d;
}
const clock = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const statusLabel = /^(?:ok|ng|nok|not[ _-]?ok|error(?:[ _-]+not[ _-]?ok)?|warn(?:ing)?|pass(?:ed)?|fail(?:ed|ure)?|success(?:ful)?|pending|running|stopped|ready|active|inactive|enabled|disabled|unknown|timeout|cancelled|canceled|true|false|yes|no|info|debug|trace|fatal|critical)$/i;

/** Infer only generator-supported fixed-width token patterns; whitespace/prose never becomes a code regex. */
function codePattern(values: string[], distinctCount: number): string | undefined {
  if (!values.every(value => value.length <= 64 && !/\s/.test(value) && /^[A-Za-z0-9_.:/()[\]{}+*?^$|=\\-]+$/.test(value))) return;
  const zeroPadded = values.every(value => /^0\d+$/.test(value));
  const mixedCode = values.every(value => /[A-Za-z]/.test(value) && /\d/.test(value));
  const uppercaseCode = distinctCount >= 6 && values.every(value => /^[A-Z]{3,16}$/.test(value));
  if (!zeroPadded && !(distinctCount >= 3 && mixedCode) && !uppercaseCode) return;
  const tokenize = (value: string) => value.match(/[A-Z]+|[a-z]+|\d+|[^A-Za-z0-9]/g) || [];
  const tokens = values.map(tokenize);
  const kind = (token: string) => /^\d+$/.test(token) ? 'digit' : /^[A-Z]+$/.test(token) ? 'upper' : /^[a-z]+$/.test(token) ? 'lower' : token;
  const first = tokens[0];
  if (!tokens.every(row => row.length === first.length && row.every((token, i) => token.length === first[i].length && kind(token) === kind(first[i])))) return;
  const pattern = first.map((token, i) => {
    const same = tokens.every(row => row[i] === token);
    if (same && kind(token) !== 'digit') return escapeRegex(token);
    const klass = kind(token) === 'digit' ? '\\d' : kind(token) === 'upper' ? '[A-Z]' : kind(token) === 'lower' ? '[a-z]' : undefined;
    if (!klass) return escapeRegex(token);
    if (kind(token) === 'digit' && token.length > 1 && tokens.every(row => row[i].startsWith('0'))) {
      const zeros = Math.min(...tokens.map(row => row[i].match(/^0+/)?.[0].length || 0), token.length - 1);
      return `${'0'.repeat(zeros)}${klass}{${token.length - zeros}}`;
    }
    return `${klass}{${token.length}}`;
  }).join('');
  return `^${pattern}$`;
}

/** Value evidence takes precedence over header hints. Nulls stay in the population, never in the enum. */
export function inferColumnValues(header: string, rawValues: readonly unknown[]): ColumnInference {
  const sampled = rawValues.slice(0, MAX_INFERENCE_RECORDS);
  const present = sampled.filter(value => !missing(value));
  const values = present.map(asText);
  const frequencies = new Map<string, number>();
  for (const value of values) frequencies.set(value, (frequencies.get(value) || 0) + 1);
  const metadata: ColumnInferenceMetadata = {
    sampleCount: sampled.length,
    nonNullCount: values.length,
    distinctCount: frequencies.size,
    nullRatio: sampled.length ? (sampled.length - values.length) / sampled.length : 0,
    valueFrequencies: Array.from(frequencies, ([value, count]) => ({ value, count })),
    inferenceReason: '',
    inferenceConfidence: 0,
  };
  const decide = (inferredType: ColumnType, inferredRule: string, inferenceReason: string, inferenceConfidence: number): ColumnInference => ({
    ...metadata, inferredType, inferredRule, inferenceReason, inferenceConfidence, sampleValues: Array.from(frequencies.keys()).slice(0, 3),
  });
  const stringRule = String(Math.min(256, Math.max(10, ...values.map(value => value.length))));
  if (!values.length) return decide('String', '10', 'No nonempty sampled values; no type or label set can be established.', 0);
  if (present.some(value => typeof value === 'object')) return decide('String', stringRule, 'Nested or non-scalar values need an explicit schema; retained as String.', 30);
  const all = (pattern: RegExp) => values.every(value => pattern.test(value));
  const bounded = values.length < 3 ? ' Evidence is sparse.' : '';
  if (all(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return decide('UUID', '', `Every nonempty value is a complete UUID.${bounded}`, 98);
  if (all(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return decide('Entity', 'email', `Every nonempty value validates as an email address.${bounded}`, 95);
  if (all(/^\d{1,3}(?:\.\d{1,3}){3}$/) && values.every(value => value.split('.').every(part => +part <= 255))) return decide('Entity', 'ip_address', `Every nonempty value is a valid IPv4 address.${bounded}`, 97);
  if (all(/^\d{4}-\d{2}-\d{2}$/) && values.every(validDate)) return decide('DateTime', 'YYYY-MM-DD', `Every nonempty value is a valid calendar date.${bounded}`, 97);
  if (all(/^(?:[01]\d|2[0-3]):[0-5]\d$/)) return decide('DateTime', 'HH:mm', `Every nonempty value is a valid HH:mm clock time; output contains no date.${bounded}`, 97);
  if (all(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{1,3}$/)) return decide('DateTime', 'HH:mm:ss.SSS', `Every nonempty value is a valid clock time with fractional seconds; output normalizes fractions to three digits and contains no date.${bounded}`, 97);
  if (values.every(value => clock.test(value))) return decide('DateTime', 'time', `Every nonempty value is a valid HH:mm:ss clock time.${bounded}`, 97);
  const dateTime = /^\d{4}-\d{2}-\d{2}[T ]((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;
  if (all(dateTime) && values.every(value => validDate(value) && Number.isFinite(Date.parse(value)))) {
    const iso = values.every(value => value[10] === 'T');
    return decide('DateTime', iso ? 'ISO' : 'YYYY-MM-DD HH:mm:ss', `Every nonempty value is a valid ${iso ? 'ISO timestamp' : 'date and time'}; output uses the supported normalized format.${bounded}`, 95);
  }
  // True/false primitives are distinct from status labels such as OK and yes/no.
  if (present.every(value => typeof value === 'boolean') || all(/^(?:true|false)$/i)) {
    const trueCount = values.filter(value => value.toLowerCase() === 'true').length;
    return decide('Boolean', String(100 * trueCount / values.length), `All nonempty values are true/false; observed true frequency is ${trueCount}/${values.length}.`, 98);
  }
  const leadingZero = values.some(value => /^[-+]?0\d/.test(value));
  if (!leadingZero && all(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/) && values.every(value => Number.isFinite(Number(value)))) {
    const nums = values.map(Number);
    const min = Math.min(...nums); const max = Math.max(...nums);
    if (nums.every(Number.isSafeInteger) && values.every(value => !/[.eE]/.test(value))) {
      const idHeader = /(?:^|_)(?:id|index|seq|sequence)$/i.test(header.replace(/([a-z])([A-Z])/g, '$1_$2'));
      const consecutive = nums.length >= 3 && nums.every((num, i) => !i || num === nums[i - 1] + 1);
      if (idHeader && consecutive) return decide('Sequence', String(nums[0]), 'Identifier samples are consecutive safe integers with increment 1; leading-zero identifiers are excluded.', 92);
      return decide('Int', `${min}, ${max}`, `All nonempty values are safe integers in the observed range ${min}–${max}.${bounded}`, 97);
    }
    if (nums.some(num => Math.abs(num) > Number.MAX_SAFE_INTEGER)) return decide('String', stringRule, 'Numeric-looking identifiers exceed safe numeric precision; String avoids losing digits.', 90);
    const decimals = Math.max(0, ...values.map(value => (value.match(/\.(\d+)/)?.[1].length || 0) - Number(value.match(/[eE]([+-]?\d+)/)?.[1] || 0)));
    if (decimals <= 8) return decide('Float', `${min}, ${max}, ${decimals}`, `All nonempty values are finite numbers; observed range and up to ${decimals} decimal places are preserved.${bounded}`, 95);
    return decide('String', stringRule, 'Observed numeric precision exceeds the generator’s eight-decimal limit; retained as String.', 85);
  }
  const distinct = frequencies.size;
  const compact = values.every(value => value.length <= 48 && value.trim().split(/\s+/).length <= 4 && !/[\r\n]|[.!?](?:\s|$)/.test(value));
  const explicitStatuses = compact && values.every(value => statusLabel.test(value.trim()));
  const repeatedLabels = values.length >= 4 && distinct <= 32 && distinct / values.length <= 0.5 && compact;
  const pattern = codePattern(values, distinct);
  // Leading-zero tokens must retain their width even when there are too few rows to infer cardinality.
  if (leadingZero && pattern) return decide('RegEx', pattern, 'Zero-padded identifiers share a fixed-width token shape; RegEx retains leading zeros.', 94);
  const categoricalHeader = /(?:^|_)(?:status|level|severity|category|type|method)$/i.test(header.replace(/([a-z])([A-Z])/g, '$1_$2'));
  const hintedLabels = categoricalHeader && compact && values.length >= 2 && distinct <= 32 && !(pattern && distinct >= 3 && distinct / values.length >= 0.7);
  if (explicitStatuses || repeatedLabels || hintedLabels) {
    return decide('Set/Enum', serializeEnumRule(metadata.valueFrequencies.map(({ value, count }) => ({ value, weight: count }))),
      explicitStatuses ? `All ${distinct} observed labels are short status-like values; case and spaces are preserved with observed frequency weights.${bounded}`
        : hintedLabels && !repeatedLabels ? `The category-like heading and ${distinct} compact observed labels support a provisional Enum; all labels and observed frequencies are retained.`
        : `${distinct} distinct compact labels recur across ${values.length} nonempty samples (${Math.round(distinct / values.length * 100)}% distinct); every observed label is retained with its frequency weight.`, explicitStatuses ? (values.length >= 3 ? 95 : 75) : repeatedLabels ? 90 : 65);
  }
  if (pattern && distinct >= 3 && distinct / values.length >= 0.7) return decide('RegEx', pattern, `${distinct} mostly distinct code tokens share the same character classes, literal separators and fixed widths; RegEx generalizes that observed shape.`, 88);
  return decide('String', stringRule, !compact ? 'Values contain prose, multiline text or long heterogeneous labels; no compact label set or safe code shape is established.'
    : values.length < 4 ? 'Too few nonempty values establish a repeated category set or consistent code pattern; retained as String.'
    : 'Values have high or mixed cardinality without a supported consistent code shape; retained as String.', values.length < 4 ? 45 : 75);
}
