import type { ColumnType, EntitySubtype } from '../types';
import { serializeEnumRule } from './enumRules';

/** Keep the same bounded row population for type decisions, frequencies and missing-value statistics. */
export const MAX_INFERENCE_RECORDS = 200;

export type InferenceSensitivity = 'strict' | 'balanced' | 'loose';

export interface InferenceAlternative {
  type: ColumnType;
  rule: string;
  label: string;
  confidence: number;
  reason?: string;
}

export interface ColumnInferenceMetadata {
  inferenceReason: string;
  inferenceConfidence: number;
  sampleCount: number;
  nonNullCount: number;
  distinctCount: number;
  nullRatio: number;
  valueFrequencies: { value: string; count: number }[];
  sensitivity?: InferenceSensitivity;
  alternateTypes?: InferenceAlternative[];
}

export interface ColumnInference extends ColumnInferenceMetadata {
  inferredType: ColumnType;
  inferredRule: string;
  sampleValues: string[];
}

export interface InferenceOptions {
  sensitivity?: InferenceSensitivity;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const missing = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && !value.trim());
const asText = (value: unknown): string => (typeof value === 'object' ? JSON.stringify(value) : String(value));

function validDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === +y && date.getUTCMonth() + 1 === +m && date.getUTCDate() === +d;
}

const clock = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const statusLabel = /^(?:ok|ng|nok|not[ _-]?ok|error(?:[ _-]+not[ _-]?ok)?|warn(?:ing)?|pass(?:ed)?|fail(?:ed|ure)?|success(?:ful)?|pending|running|stopped|ready|active|inactive|enabled|disabled|unknown|timeout|cancelled|canceled|true|false|yes|no|info|debug|trace|fatal|critical)$/i;

// Top 60 ISO-3166 alpha-2 country codes and common country names
const COMMON_COUNTRY_CODES = new Set([
  'US', 'GB', 'DE', 'FR', 'CA', 'JP', 'AU', 'CN', 'IN', 'BR', 'IT', 'ES', 'NL', 'SE', 'CH', 'RU', 'KR',
  'SG', 'NZ', 'MX', 'TH', 'VN', 'ID', 'MY', 'PH', 'ZA', 'AE', 'SA', 'AR', 'CL', 'CO', 'PE', 'EG', 'NG',
  'KE', 'IL', 'TR', 'PL', 'NO', 'DK', 'FI', 'AT', 'BE', 'IE', 'PT', 'GR', 'CZ', 'RO', 'HU', 'UA',
  'USA', 'GBR', 'DEU', 'FRA', 'CAN', 'JPN', 'AUS', 'CHN', 'IND', 'BRA', 'ITA', 'ESP', 'NLD', 'SWE', 'CHE',
]);

const COMMON_COUNTRY_NAMES = new Set([
  'united states', 'united kingdom', 'germany', 'france', 'canada', 'japan', 'australia', 'china', 'india',
  'brazil', 'italy', 'spain', 'netherlands', 'sweden', 'switzerland', 'russia', 'south korea', 'singapore',
  'new zealand', 'mexico', 'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'south africa',
  'united arab emirates', 'saudi arabia', 'argentina', 'chile', 'colombia', 'peru', 'egypt', 'nigeria',
  'israel', 'turkey', 'poland', 'norway', 'denmark', 'finland', 'austria', 'belgium', 'ireland', 'portugal',
]);

const COMMON_CITIES = new Set([
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego',
  'dallas', 'san jose', 'austin', 'san francisco', 'seattle', 'denver', 'boston', 'london', 'manchester',
  'birmingham', 'paris', 'lyon', 'marseille', 'berlin', 'munich', 'frankfurt', 'hamburg', 'tokyo', 'osaka',
  'kyoto', 'sydney', 'melbourne', 'brisbane', 'toronto', 'vancouver', 'montreal', 'singapore', 'bangkok',
  'seoul', 'beijing', 'shanghai', 'hong kong', 'mumbai', 'delhi', 'bangalore', 'dubai', 'amsterdam', 'dublin',
  'madrid', 'barcelona', 'rome', 'milan', 'zurich', 'vienna', 'stockholm', 'oslo', 'copenhagen', 'helsinki',
  'warsaw', 'prague', 'budapest', 'buenos aires', 'sao paulo', 'rio de janeiro', 'mexico city', 'cairo',
  'johannesburg', 'cape town', 'auckland',
]);

const COMPANY_SUFFIX_REGEX = /\b(?:inc\.?|corp\.?|corporation|ltd\.?|limited|llc|gmbh|technologies|systems|enterprises|solutions|labs|group|holding|co\.)\b/i;
const JOB_TITLE_KEYWORD_REGEX = /\b(?:engineer|developer|manager|director|analyst|consultant|specialist|coordinator|lead|architect|officer|supervisor|technician|administrator|designer|scientist)\b/i;

/** Infer only generator-supported fixed-width token patterns; whitespace/prose never becomes a code regex. */
function codePattern(values: string[], distinctCount: number): string | undefined {
  if (!values.every(value => value.length <= 64 && !/\s/.test(value) && /^[A-Za-z0-9_.:/()[\]{}+*?^$|=\\-]+$/.test(value))) return;
  const zeroPadded = values.every(value => /^0\d+$/.test(value));
  const mixedCode = values.every(value => /[A-Za-z]/.test(value) && /\d/.test(value));
  const uppercaseCode = distinctCount >= 6 && values.every(value => /^[A-Z]{3,16}$/.test(value));
  if (!zeroPadded && !(distinctCount >= 3 && mixedCode) && !uppercaseCode) return;
  const tokenize = (value: string) => value.match(/[A-Z]+|[a-z]+|\d+|[^A-Za-z0-9]/g) || [];
  const tokens = values.map(tokenize);
  const kind = (token: string) => (/^\d+$/.test(token) ? 'digit' : /^[A-Z]+$/.test(token) ? 'upper' : /^[a-z]+$/.test(token) ? 'lower' : token);
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

/** Detects structured alphanumeric codes like INV-1001, SKU-8921, BATCH_01 */
function isAlphanumericCode(values: string[], header: string): boolean {
  if (values.length === 0) return false;
  const h = header.toLowerCase();
  const hasCodeHeader = /(?:^|_)(?:id|code|sku|serial|ref|num|number|batch|ticket|order|inv|invoice|txn|trans|part|model|barcode|tracking)(?:$|_)/i.test(h);
  const hasCategoryHeader = /(?:^|_)(?:status|type|category|tier|level|priority|mode|severity)(?:$|_)/i.test(h);
  if (hasCategoryHeader) return false;

  let codeCount = 0;
  for (const v of values.slice(0, 30)) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    // Format: letters + digits with optional delimiter e.g. ABC-1234, SKU9901, ORD_001
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    const hasDigits = /\d/.test(trimmed);
    const hasDelim = /[-_/#.:]/.test(trimmed);
    if ((hasLetters && hasDigits) || (hasDelim && hasDigits && trimmed.length <= 24)) {
      codeCount++;
    }
  }
  const ratio = codeCount / Math.min(values.length, 30);
  return hasCodeHeader ? ratio >= 0.25 : ratio >= 0.6;
}

interface DetectedEntity {
  subtype: EntitySubtype;
  confidence: number;
  reason: string;
}

/** Check deterministic semantic entity matchers that take precedence over Enums */
function detectSemanticEntity(header: string, values: string[]): DetectedEntity | null {
  if (!values.length) return null;
  const count = values.length;
  const h = header.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2');
  const all = (pattern: RegExp) => values.every(v => pattern.test(v.trim()));
  const majority = (pattern: RegExp, threshold = 0.75) => values.filter(v => pattern.test(v.trim())).length / count >= threshold;

  // Date-like tokens must never be misclassified as phone numbers or other entities
  if (values.some(v => /^\d{4}[-/]\d{2}[-/]\d{2}/.test(v.trim()))) {
    return null;
  }

  // 1. Email (100% or high match)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (all(emailRegex) || (majority(emailRegex, 0.7) && /(?:^|_)(?:email|e_mail|mail)(?:$|_)/i.test(h))) {
    return { subtype: 'email', confidence: 96, reason: 'Nonempty values adhere to standard email address formatting.' };
  }

  // 2. IP Address (IPv4)
  if (all(/^\d{1,3}(?:\.\d{1,3}){3}$/) && values.every(v => v.split('.').every(p => +p <= 255))) {
    return { subtype: 'ip_address', confidence: 97, reason: 'Nonempty values validate as IPv4 addresses.' };
  }

  // 3. Web URL
  const urlRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
  const hasUrlHeader = /(?:^|_)(?:url|link|website|endpoint|web_address|href)(?:$|_)/i.test(h);
  if (all(urlRegex) || (majority(urlRegex, 0.7) && hasUrlHeader)) {
    return { subtype: 'url', confidence: 95, reason: 'Values conform to HTTP/HTTPS web URL conventions.' };
  }

  // 4. Phone Number
  const hasPhoneHeader = /(?:^|_)(?:phone|mobile|tel|telephone|cell|fax)(?:$|_)/i.test(h);
  const phonePattern = /^\+?[\d\s\-().]{7,22}$/;
  const explicitPhoneSyntax = (v: string) => /^\+\d{1,4}[-\s.]?\d+/.test(v.trim()) || /^\(\d{3}\)\s*\d{3}[-\s.]?\d{4}$/.test(v.trim());
  const hasPhoneDigits = values.every(v => {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  });
  if ((hasPhoneHeader && all(phonePattern) && hasPhoneDigits) || (values.every(explicitPhoneSyntax) && hasPhoneDigits)) {
    return { subtype: 'phone', confidence: 92, reason: 'Observed values follow telecommunication phone number formats.' };
  }

  // 5. Geographic Country (Country codes or names)
  const hasCountryHeader = /(?:^|_)(?:country|country_code|country_iso|nation)(?:$|_)/i.test(h) && !/county/i.test(h);
  const countryCodeMatches = values.filter(v => COMMON_COUNTRY_CODES.has(v.trim().toUpperCase())).length;
  const countryNameMatches = values.filter(v => COMMON_COUNTRY_NAMES.has(v.trim().toLowerCase())).length;
  if ((countryCodeMatches / count >= 0.7) || (countryNameMatches / count >= 0.7) || (hasCountryHeader && (countryCodeMatches > 0 || countryNameMatches > 0 || values.length <= 4))) {
    return { subtype: 'country', confidence: 91, reason: `Identified as country codes or nation names${hasCountryHeader ? ' with matching header hint' : ''}.` };
  }

  // 6. Geographic City
  const hasCityHeader = /(?:^|_)(?:city|town|municipality|metro)(?:$|_)/i.test(h);
  const cityMatches = values.filter(v => COMMON_CITIES.has(v.trim().toLowerCase())).length;
  if (cityMatches / count >= 0.6 || (hasCityHeader && (cityMatches > 0 || values.every(v => /^[A-Z][a-zA-Z\s.-]{2,30}$/.test(v.trim()))))) {
    return { subtype: 'city', confidence: 89, reason: `Values represent recognized city locations or municipal areas${hasCityHeader ? ' with matching header hint' : ''}.` };
  }

  // 7. Company / Organization
  const hasCompanyHeader = /(?:^|_)(?:company|company_name|organization|org|vendor|employer|client_company|business)(?:$|_)/i.test(h);
  const companySuffixMatches = values.filter(v => COMPANY_SUFFIX_REGEX.test(v.trim())).length;
  if (companySuffixMatches / count >= 0.35 || (hasCompanyHeader && values.every(v => v.length >= 2 && v.length <= 60 && !statusLabel.test(v.trim())))) {
    return { subtype: 'company', confidence: 88, reason: 'Identified as enterprise or corporate entity names with corporate suffixes/header hints.' };
  }

  // 8. Person Names: First Name, Last Name, Full Name
  const hasFirstNameHeader = /(?:^|_)(?:first_name|fname|given_name)(?:$|_)/i.test(h);
  if (hasFirstNameHeader && values.every(v => /^[A-Z][a-z]{1,24}$/.test(v.trim()))) {
    return { subtype: 'first_name', confidence: 90, reason: 'Capitalized single name tokens with first_name header hint.' };
  }

  const hasLastNameHeader = /(?:^|_)(?:last_name|lname|surname|family_name)(?:$|_)/i.test(h);
  if (hasLastNameHeader && values.every(v => /^[A-Z][a-zA-Z'-]{1,30}$/.test(v.trim()))) {
    return { subtype: 'last_name', confidence: 90, reason: 'Capitalized surname tokens with last_name header hint.' };
  }

  const hasFullNameHeader = /(?:^|_)(?:full_name|name|author|creator|customer_name|patient_name|user_name|owner|assignee|engineer|doctor|driver|employee)(?:$|_)/i.test(h) &&
    !/(?:company|file|product|app|service|table|channel|event|test|dataset|column|metric)/i.test(h);
  const isMultiWordName = values.every(v => /^[A-Z][a-z]+(?: [A-Z][a-z]+)+$/.test(v.trim()));
  if ((isMultiWordName && values.length >= 2) || (hasFullNameHeader && values.every(v => v.trim().split(/\s+/).length >= 2 && !statusLabel.test(v.trim())))) {
    return { subtype: 'full_name', confidence: 89, reason: 'Multi-word capitalized person names with identity header hint.' };
  }

  // 9. Job Title
  const hasJobHeader = /(?:^|_)(?:job_title|job|title|position|role|designation|profession)(?:$|_)/i.test(h) && !/(?:company|app|system)/i.test(h);
  const jobTitleMatches = values.filter(v => JOB_TITLE_KEYWORD_REGEX.test(v.trim())).length;
  if (jobTitleMatches / count >= 0.4 || (hasJobHeader && values.every(v => v.trim().split(/\s+/).length <= 5 && !statusLabel.test(v.trim())))) {
    return { subtype: 'job_title', confidence: 87, reason: 'Professional role designations and occupational title patterns.' };
  }

  return null;
}

/** Value evidence takes precedence over header hints. Nulls stay in the population, never in the enum. */
export function inferColumnValues(
  header: string,
  rawValues: readonly unknown[],
  options?: InferenceOptions
): ColumnInference {
  const sensitivity: InferenceSensitivity = options?.sensitivity || 'balanced';
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
    sensitivity,
    alternateTypes: [],
  };

  const stringRule = String(Math.min(256, Math.max(10, ...values.map(value => value.length))));

  const decide = (
    inferredType: ColumnType,
    inferredRule: string,
    inferenceReason: string,
    inferenceConfidence: number,
    candidateAlternates: InferenceAlternative[] = []
  ): ColumnInference => {
    // Filter out candidates that match the chosen type to keep alternatives clean
    const alternateTypes = candidateAlternates.filter(alt => alt.type !== inferredType);
    return {
      ...metadata,
      inferredType,
      inferredRule,
      inferenceReason,
      inferenceConfidence,
      sampleValues: Array.from(frequencies.keys()).slice(0, 3),
      alternateTypes,
    };
  };

  if (!values.length) return decide('String', '10', 'No nonempty sampled values; no type or label set can be established.', 0);
  if (present.some(value => typeof value === 'object')) return decide('String', stringRule, 'Nested or non-scalar values need an explicit schema; retained as String.', 30);

  const all = (pattern: RegExp) => values.every(value => pattern.test(value));
  const bounded = values.length < 3 ? ' Evidence is sparse.' : '';

  // 1. UUID Check
  if (all(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return decide('UUID', '', `Every nonempty value is a complete UUID.${bounded}`, 98, [
      { type: 'String', rule: '36', label: 'String', confidence: 70, reason: 'Plain text identifier' },
    ]);
  }

  // 2. Strict DateTime & Time checks
  if (all(/^\d{4}-\d{2}-\d{2}$/) && values.every(validDate)) {
    return decide('DateTime', 'YYYY-MM-DD', `Every nonempty value is a valid calendar date.${bounded}`, 97, [
      { type: 'String', rule: '10', label: 'String', confidence: 60 },
    ]);
  }
  if (all(/^(?:[01]\d|2[0-3]):[0-5]\d$/)) {
    return decide('DateTime', 'HH:mm', `Every nonempty value is a valid HH:mm clock time; output contains no date.${bounded}`, 97, [
      { type: 'String', rule: '5', label: 'String', confidence: 60 },
    ]);
  }
  if (all(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{1,3}$/)) {
    return decide('DateTime', 'HH:mm:ss.SSS', `Every nonempty value is a valid clock time with fractional seconds; output normalizes fractions to three digits and contains no date.${bounded}`, 97, [
      { type: 'String', rule: '12', label: 'String', confidence: 60 },
    ]);
  }
  if (values.every(value => clock.test(value))) {
    return decide('DateTime', 'time', `Every nonempty value is a valid HH:mm:ss clock time.${bounded}`, 97, [
      { type: 'String', rule: '8', label: 'String', confidence: 60 },
    ]);
  }
  const dateTime = /^\d{4}-\d{2}-\d{2}[T ]((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;
  if (all(dateTime) && values.every(value => validDate(value) && Number.isFinite(Date.parse(value)))) {
    const iso = values.every(value => value[10] === 'T');
    return decide('DateTime', iso ? 'ISO' : 'YYYY-MM-DD HH:mm:ss', `Every nonempty value is a valid ${iso ? 'ISO timestamp' : 'date and time'}; output uses the supported normalized format.${bounded}`, 95, [
      { type: 'String', rule: '24', label: 'String', confidence: 60 },
    ]);
  }

  // 3. Boolean Check
  if (present.every(value => typeof value === 'boolean') || all(/^(?:true|false)$/i)) {
    const trueCount = values.filter(value => value.toLowerCase() === 'true').length;
    return decide('Boolean', String(Math.round(100 * trueCount / values.length)), `All nonempty values are true/false; observed true frequency is ${trueCount}/${values.length}.`, 98, [
      { type: 'Set/Enum', rule: 'true:50, false:50', label: 'Set/Enum', confidence: 80 },
      { type: 'String', rule: '5', label: 'String', confidence: 50 },
    ]);
  }

  // 4. Numeric Check (Safe Integers, Sequence, Floats)
  const leadingZero = values.some(value => /^[-+]?0\d/.test(value));
  if (!leadingZero && all(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/) && values.every(value => Number.isFinite(Number(value)))) {
    const nums = values.map(Number);
    const min = Math.min(...nums); const max = Math.max(...nums);
    if (nums.every(Number.isSafeInteger) && values.every(value => !/[.eE]/.test(value))) {
      const idHeader = /(?:^|_)(?:id|index|seq|sequence)$/i.test(header.replace(/([a-z])([A-Z])/g, '$1_$2'));
      const consecutive = nums.length >= 3 && nums.every((num, i) => !i || num === nums[i - 1] + 1);
      if (idHeader && consecutive) {
        return decide('Sequence', String(nums[0]), 'Identifier samples are consecutive safe integers with increment 1; leading-zero identifiers are excluded.', 92, [
          { type: 'Int', rule: `${min}, ${max}`, label: 'Int', confidence: 85 },
          { type: 'String', rule: stringRule, label: 'String', confidence: 60 },
        ]);
      }
      return decide('Int', `${min}, ${max}`, `All nonempty values are safe integers in the observed range ${min}–${max}.${bounded}`, 97, [
        { type: 'String', rule: stringRule, label: 'String', confidence: 60 },
      ]);
    }
    if (nums.some(num => Math.abs(num) > Number.MAX_SAFE_INTEGER)) {
      return decide('String', stringRule, 'Numeric-looking identifiers exceed safe numeric precision; String avoids losing digits.', 90);
    }
    const decimals = Math.max(0, ...values.map(value => (value.match(/\.(\d+)/)?.[1].length || 0) - Number(value.match(/[eE]([+-]?\d+)/)?.[1] || 0)));
    if (decimals <= 8) {
      return decide('Float', `${min}, ${max}, ${decimals}`, `All nonempty values are finite numbers; observed range and up to ${decimals} decimal places are preserved.${bounded}`, 95, [
        { type: 'String', rule: stringRule, label: 'String', confidence: 60 },
      ]);
    }
    return decide('String', stringRule, 'Observed numeric precision exceeds the generator’s eight-decimal limit; retained as String.', 85);
  }

  // ---------------------------------------------------------
  // 5. PRIORITY HEURISTIC 1: Semantic Entities Precedence
  // ---------------------------------------------------------
  const distinct = frequencies.size;
  const compact = values.every(value => value.length <= 48 && value.trim().split(/\s+/).length <= 4 && !/[\r\n]|[.!?](?:\s|$)/.test(value));
  const explicitStatuses = compact && values.every(value => statusLabel.test(value.trim()));
  const pattern = codePattern(values, distinct);
  const isCode = isAlphanumericCode(values, header);

  // Check semantic entities FIRST before Enum
  const entityCandidate = detectSemanticEntity(header, values);

  // Prepare potential Enum candidate for alternative switching
  const enumRuleCandidate = distinct <= 32 ? serializeEnumRule(metadata.valueFrequencies.map(({ value, count }) => ({ value, weight: count }))) : '';
  const enumAlternative: InferenceAlternative = {
    type: 'Set/Enum',
    rule: enumRuleCandidate,
    label: 'Set/Enum',
    confidence: explicitStatuses ? 95 : 75,
    reason: `Retain ${distinct} observed values as a discrete set`,
  };

  // Zero-padded identifiers must retain their width as RegEx
  if (leadingZero && pattern) {
    return decide('RegEx', pattern, 'Zero-padded identifiers share a fixed-width token shape; RegEx retains leading zeros.', 94, [
      ...(enumRuleCandidate ? [enumAlternative] : []),
      { type: 'String', rule: stringRule, label: 'String', confidence: 60 },
    ]);
  }

  // If semantic entity is strongly identified, prioritize it over Enum (unless values are explicit status labels like OK/NG)
  if (entityCandidate && !explicitStatuses) {
    const alternates: InferenceAlternative[] = [];
    if (enumRuleCandidate && distinct <= 24) alternates.push(enumAlternative);
    if (pattern) alternates.push({ type: 'RegEx', rule: pattern, label: 'RegEx', confidence: 75, reason: 'Token shape pattern' });
    alternates.push({ type: 'String', rule: stringRule, label: 'String', confidence: 50 });

    return decide('Entity', entityCandidate.subtype, `${entityCandidate.reason} Semantic entity takes priority over Set/Enum.`, entityCandidate.confidence, alternates);
  }

  // ---------------------------------------------------------
  // 6. PRIORITY HEURISTIC 2: Pattern Shapes & Alphanumeric Codes
  // ---------------------------------------------------------
  if (pattern && (isCode || (distinct >= 3 && distinct / values.length >= 0.65))) {
    const alternates: InferenceAlternative[] = [];
    if (enumRuleCandidate && distinct <= 32) alternates.push(enumAlternative);
    alternates.push({ type: 'String', rule: stringRule, label: 'String', confidence: 60 });

    return decide('RegEx', pattern, `${distinct} mostly distinct code tokens share the same character classes, literal separators and fixed widths; RegEx generalizes that observed shape.`, 90, alternates);
  }

  // ---------------------------------------------------------
  // 7. BALANCED ENUM INFERENCE (Sensitivity Gated)
  // ---------------------------------------------------------
  const categoricalHeader = /(?:^|_)(?:status|level|severity|category|tier|type|method|priority|mode|stage|state|phase)(?:$|_)/i.test(header.replace(/([a-z])([A-Z])/g, '$1_$2'));

  let shouldBeEnum = false;
  let enumReason = '';
  let enumConfidence = 70;

  if (explicitStatuses) {
    // Explicit status keywords (OK, NG, active, inactive, pending...) always qualify
    shouldBeEnum = true;
    enumConfidence = values.length >= 3 ? 95 : 75;
    enumReason = `All ${distinct} observed labels are short status-like values; case and spaces are preserved with observed frequency weights.${bounded}`;
  } else if (sensitivity === 'strict') {
    // STRICT MODE: Only explicit status labels or explicit categorical headers with heavy duplication
    if (categoricalHeader && compact && values.length >= 6 && distinct <= 16 && distinct / values.length <= 0.35) {
      shouldBeEnum = true;
      enumConfidence = 85;
      enumReason = `Strict mode: Categorical header '${header}' with heavy label repetition (${Math.round(distinct / values.length * 100)}% unique) matches categorical enum criteria.`;
    }
  } else if (sensitivity === 'balanced') {
    // BALANCED MODE (Default):
    // Requires either:
    // - Explicit categorical header with at least 2 samples and <= 20 distinct
    // - Or substantial repetition (distinct / count <= 0.35, length >= 6, max distinct 24)
    // - Small sets (distinct <= 6) with distinct / count <= 0.5 and length >= 4
    const heavyRepetition = values.length >= 6 && distinct <= 24 && distinct / values.length <= 0.35;
    const smallRepeatedSet = values.length >= 4 && distinct <= 6 && distinct / values.length <= 0.5;
    const hintedCategory = categoricalHeader && compact && values.length >= 2 && distinct <= 20 && !(pattern && distinct >= 3 && distinct / values.length >= 0.7);

    if (hintedCategory) {
      shouldBeEnum = true;
      enumConfidence = repeatedLabelsConfidence(values.length, distinct);
      enumReason = `The category-like heading '${header}' and ${distinct} compact observed labels establish a categorical Enum.`;
    } else if (heavyRepetition || smallRepeatedSet) {
      shouldBeEnum = true;
      enumConfidence = repeatedLabelsConfidence(values.length, distinct);
      enumReason = `${distinct} distinct compact labels recur across ${values.length} samples (${Math.round(distinct / values.length * 100)}% unique, avg ~${Math.round(values.length / distinct)}x/label); retained as balanced Enum.`;
    }
  } else {
    // LOOSE MODE:
    // Cardinality <= 32 and distinct / values.length <= 0.5
    const repeatedLabels = values.length >= 4 && distinct <= 32 && distinct / values.length <= 0.5 && compact;
    const hintedLabels = categoricalHeader && compact && values.length >= 2 && distinct <= 32 && !(pattern && distinct >= 3 && distinct / values.length >= 0.7);
    if (repeatedLabels || hintedLabels) {
      shouldBeEnum = true;
      enumConfidence = repeatedLabels ? 88 : 65;
      enumReason = `${distinct} distinct compact labels recur across ${values.length} samples; loose sensitivity retained labels as Enum.`;
    }
  }

  if (shouldBeEnum) {
    const alternates: InferenceAlternative[] = [];
    if (pattern) alternates.push({ type: 'RegEx', rule: pattern, label: 'RegEx', confidence: 75, reason: 'Token regex pattern' });
    if (entityCandidate) alternates.push({ type: 'Entity', rule: entityCandidate.subtype, label: `Entity (${entityCandidate.subtype})`, confidence: 70, reason: entityCandidate.reason });
    alternates.push({ type: 'String', rule: stringRule, label: 'String', confidence: 60, reason: 'Plain text string' });

    return decide('Set/Enum', enumRuleCandidate, enumReason, enumConfidence, alternates);
  }

  // ---------------------------------------------------------
  // 8. Fallback Code Pattern or String
  // ---------------------------------------------------------
  if (pattern && distinct >= 3 && distinct / values.length >= 0.7) {
    const alternates: InferenceAlternative[] = [];
    if (enumRuleCandidate && distinct <= 32) alternates.push(enumAlternative);
    alternates.push({ type: 'String', rule: stringRule, label: 'String', confidence: 65 });

    return decide('RegEx', pattern, `${distinct} mostly distinct code tokens share the same character classes, literal separators and fixed widths; RegEx generalizes that observed shape.`, 88, alternates);
  }

  // Fallback to String with viable alternatives if available
  const alternates: InferenceAlternative[] = [];
  if (enumRuleCandidate && distinct <= 32 && compact) alternates.push(enumAlternative);
  if (pattern) alternates.push({ type: 'RegEx', rule: pattern, label: 'RegEx', confidence: 70 });
  if (entityCandidate) alternates.push({ type: 'Entity', rule: entityCandidate.subtype, label: `Entity (${entityCandidate.subtype})`, confidence: 65 });

  const stringReason = !compact
    ? 'Values contain prose, multiline text or long heterogeneous labels; no compact label set or safe code shape is established.'
    : values.length < 4
    ? 'Too few nonempty values establish a repeated category set or consistent code pattern; retained as String.'
    : `Values have ${distinct} unique entries across ${values.length} samples without strong repetition; retained as String to prevent enum over-fitting.`;

  return decide('String', stringRule, stringReason, values.length < 4 ? 45 : 75, alternates);
}

function repeatedLabelsConfidence(count: number, distinct: number): number {
  if (count >= 10 && distinct <= 6) return 92;
  if (count >= 6 && distinct <= 10) return 88;
  if (count >= 4) return 80;
  return 65;
}
