import * as XLSX from 'xlsx';
import { ColumnSpec, ColumnType, EntitySubtype } from '../types';

export interface ExtractedColumnResult {
  id: string;
  name: string;
  originalName: string;
  type: ColumnType;
  rule: string;
  skip_pct: number;
  condition: string;
  sampleValues: (string | number | boolean | null)[];
  uniqueCount: number;
  totalCount: number;
  nullCount: number;
  isSensitive: boolean;
  notes?: string;
  detectedFormat?: string;
  // Dynamic Pattern & Enum criteria controls
  inferredRegexRule?: string;
  inferredEnumRule?: string;
  isAlphanumericCode?: boolean;
}

export type ExtractionMode = 'realistic' | 'mock';
export type PatternPreference = 'smart' | 'prefer_regex' | 'prefer_enum';

export interface ExtractionOptions {
  mode?: ExtractionMode;
  patternPreference?: PatternPreference;
  maxEnumUnique?: number;
  ignoreAlphanumericInEnum?: boolean;
  selectedColumnNames?: string[];
}

export type HeaderSeverity = 'critical' | 'warning' | 'info';

export type HeaderIssueType =
  | 'delimiter_anomaly'
  | 'duplicate_header'
  | 'case_conflict'
  | 'empty_header'
  | 'data_in_header'
  | 'whitespace_padding'
  | 'invalid_characters'
  | 'leading_number'
  | 'naming_convention'
  | 'missing_expected'
  | 'unexpected_extra'
  | 'reserved_keyword';

export interface HeaderIssue {
  id: string;
  type: HeaderIssueType;
  severity: HeaderSeverity;
  column?: string;
  columnIndex?: number;
  message: string;
  suggestion?: string;
  fixable?: boolean;
}

export type ExpectedNamingConvention =
  | 'auto'
  | 'snake_case'
  | 'camelCase'
  | 'PascalCase'
  | 'UPPER_CASE'
  | 'kebab-case'
  | 'alphanumeric'
  | 'any';

export interface HeaderValidationOptions {
  expectedConvention?: ExpectedNamingConvention;
  expectedHeaders?: string[];
  strictCase?: boolean;
  allowSpaces?: boolean;
  fileFormat?: string;
}

export interface HeaderColumnMapping {
  original: string;
  sanitized: string;
  index: number;
  issues: HeaderIssue[];
  status: 'valid' | 'warning' | 'critical';
}

export interface HeaderValidationReport {
  isValid: boolean;
  hasWarnings: boolean;
  hasErrors: boolean;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalHeaders: number;
  detectedDelimiter?: string;
  detectedConvention?: string;
  issues: HeaderIssue[];
  rawHeaders: string[];
  sanitizedHeaders: string[];
  headerMapping: HeaderColumnMapping[];
  matchedExpected: string[];
  missingExpected: string[];
  unexpectedExtra: string[];
}

export interface SheetData {
  sheetName: string;
  headers: string[];
  rawHeaders?: string[];
  validationReport?: HeaderValidationReport;
  rows: (string | number | boolean | null)[][];
  totalRows: number;
  totalCols: number;
}

export interface ParsedWorkbook {
  filename: string;
  sheetNames: string[];
  sheets: Record<string, SheetData>;
  rawWorkbook?: any;
  fileFormat: string;
  rawFile?: File;
  rawContent?: string;
  rawJson?: any[];
}

const SQL_RESERVED_KEYWORDS = new Set([
  'select', 'from', 'where', 'table', 'order', 'group', 'by', 'having',
  'insert', 'update', 'delete', 'create', 'alter', 'drop', 'index',
  'primary', 'key', 'foreign', 'join', 'inner', 'left', 'right', 'outer',
  'full', 'union', 'all', 'as', 'distinct', 'case', 'when', 'then', 'else',
  'end', 'limit', 'offset', 'view', 'trigger', 'procedure', 'database',
  'schema', 'user', 'role', 'grant', 'revoke', 'desc', 'asc', 'check',
  'default', 'values', 'unique', 'column', 'rows', 'count', 'null', 'true', 'false'
]);

/**
 * Detect probable CSV delimiter by analyzing character frequency on header lines
 */
export function detectCsvDelimiter(sampleText: string): string {
  const firstLine = sampleText.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount && tabCount > pipeCount) return '\t';
  if (semicolonCount > commaCount && semicolonCount > tabCount && semicolonCount > pipeCount) return ';';
  if (pipeCount > commaCount && pipeCount > tabCount && pipeCount > semicolonCount) return '|';
  return ',';
}

/**
 * Convert an arbitrary header string to a specified naming convention
 */
export function toNamingConvention(name: string, convention: ExpectedNamingConvention): string {
  const trimmed = name.trim();
  if (!trimmed) return 'field';

  // Break apart words by spaces, underscores, hyphens, and camelCase transitions
  const words = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'field';

  switch (convention) {
    case 'snake_case':
      return words.map((w) => w.toLowerCase()).join('_');

    case 'camelCase':
      return words
        .map((w, idx) =>
          idx === 0
            ? w.toLowerCase()
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        )
        .join('');

    case 'PascalCase':
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');

    case 'UPPER_CASE':
      return words.map((w) => w.toUpperCase()).join('_');

    case 'kebab-case':
      return words.map((w) => w.toLowerCase()).join('-');

    case 'alphanumeric':
    case 'auto':
    case 'any':
    default: {
      let res = trimmed.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
      if (/^\d/.test(res)) res = `col_${res}`;
      return res || 'field';
    }
  }
}

/**
 * Sanitize a single header, ensuring valid identifier syntax and uniqueness
 */
export function sanitizeHeaderName(
  original: any,
  index: number,
  convention: ExpectedNamingConvention = 'snake_case',
  existingNames: Set<string> = new Set()
): string {
  const str = original !== null && original !== undefined ? String(original).trim() : '';
  let base: string;

  if (!str) {
    base = `field_${index + 1}`;
  } else {
    base = toNamingConvention(str, convention);
  }

  // Ensure does not start with a digit
  if (/^\d/.test(base)) {
    base = `col_${base}`;
  }

  // Ensure unique within set (case-insensitive deduplication)
  let candidate = base;
  let counter = 2;
  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter++}`;
  }

  existingNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Sanitize an entire array of raw headers
 */
export function sanitizeAllHeaders(
  rawHeaders: any[],
  convention: ExpectedNamingConvention = 'snake_case'
): string[] {
  const existingNames = new Set<string>();
  return (rawHeaders || []).map((h, idx) => sanitizeHeaderName(h, idx, convention, existingNames));
}

/**
 * Comprehensive Offline Header Format Validator.
 * Evaluates duplicate headers, empty fields, data rows mistaken as headers,
 * delimiter squashing, naming conventions, and alignment with target schema.
 */
export function validateCsvHeaders(
  rawHeaders: any[],
  options: HeaderValidationOptions = {}
): HeaderValidationReport {
  const convention = options.expectedConvention || 'auto';
  const expectedHeaders = options.expectedHeaders || [];
  const issues: HeaderIssue[] = [];

  const rawHeadersList: string[] = (rawHeaders || []).map((h) =>
    h !== null && h !== undefined ? String(h) : ''
  );

  // 1. Delimiter / Squashed column anomaly
  if (rawHeadersList.length === 1 && rawHeadersList[0]) {
    const single = rawHeadersList[0];
    if (single.includes(';') || single.includes('\t') || single.includes('|') || single.includes(',')) {
      const sep = single.includes(';') ? ';' : single.includes('\t') ? 'tab' : single.includes('|') ? '|' : ',';
      issues.push({
        id: 'delimiter_anomaly',
        type: 'delimiter_anomaly',
        severity: 'critical',
        column: single,
        columnIndex: 0,
        message: `Possible delimiter mismatch: Only 1 column detected, but it contains separator characters (${sep}). All fields appear squashed into a single header.`,
        suggestion: `Verify your CSV delimiter or export with standard comma separators.`,
        fixable: false,
      });
    }
  }

  // Track occurrences for duplicate detection
  const seenLower = new Map<string, number[]>();
  const exactCount = new Map<string, number>();

  rawHeadersList.forEach((h, idx) => {
    exactCount.set(h, (exactCount.get(h) || 0) + 1);
    const lower = h.trim().toLowerCase();
    if (lower) {
      if (!seenLower.has(lower)) seenLower.set(lower, []);
      seenLower.get(lower)!.push(idx);
    }
  });

  // Evaluate each individual column header
  rawHeadersList.forEach((raw, idx) => {
    const trimmed = raw.trim();

    // 2. Empty or missing header
    if (!trimmed) {
      issues.push({
        id: `empty_${idx}`,
        type: 'empty_header',
        severity: 'critical',
        columnIndex: idx,
        message: `Column ${idx + 1} has an empty or blank header name.`,
        suggestion: `Assign a descriptive title. Auto-sanitizer will assign "field_${idx + 1}".`,
        fixable: true,
      });
      return;
    }

    // 3. Whitespace padding
    if (raw !== trimmed) {
      issues.push({
        id: `ws_${idx}`,
        type: 'whitespace_padding',
        severity: 'warning',
        column: raw,
        columnIndex: idx,
        message: `Header "${raw}" contains leading or trailing whitespace.`,
        suggestion: `Trim whitespace to "${trimmed}".`,
        fixable: true,
      });
    }

    // 4. Duplicate headers
    if ((exactCount.get(raw) || 0) > 1) {
      issues.push({
        id: `dup_${idx}`,
        type: 'duplicate_header',
        severity: 'critical',
        column: raw,
        columnIndex: idx,
        message: `Duplicate header name "${raw}" detected at column ${idx + 1}.`,
        suggestion: `Rename to "${raw}_${idx + 1}" to avoid data loss.`,
        fixable: true,
      });
    } else {
      const lower = trimmed.toLowerCase();
      const occurrences = seenLower.get(lower) || [];
      if (occurrences.length > 1 && occurrences[0] !== idx) {
        issues.push({
          id: `case_${idx}`,
          type: 'case_conflict',
          severity: 'warning',
          column: raw,
          columnIndex: idx,
          message: `Case-insensitive conflict: "${raw}" conflicts with column ${occurrences[0] + 1} ("${rawHeadersList[occurrences[0]]}").`,
          suggestion: `Ensure distinct names for cross-database compatibility.`,
          fixable: true,
        });
      }
    }

    // 5. Data row mistaken as header heuristics
    const numMatch = /^-?\d+(?:\.\d+)?$/.test(trimmed);
    const dateMatch = /^\d{4}[-/]\d{2}[-/]\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(trimmed);
    const emailMatch = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
    const uuidMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    const boolMatch = /^(?:true|false|yes|no)$/i.test(trimmed);
    const ipMatch = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed);

    if (numMatch || dateMatch || emailMatch || uuidMatch || boolMatch || ipMatch) {
      const typeLabel = numMatch
        ? 'numeric value'
        : dateMatch
        ? 'date/time'
        : emailMatch
        ? 'email address'
        : uuidMatch
        ? 'UUID'
        : boolMatch
        ? 'boolean flag'
        : 'IP address';

      issues.push({
        id: `data_${idx}`,
        type: 'data_in_header',
        severity: 'warning',
        column: raw,
        columnIndex: idx,
        message: `Header "${raw}" appears to be a data value (${typeLabel}) rather than a column title.`,
        suggestion: `Check if your CSV lacks a header row (first line is a data record).`,
        fixable: false,
      });
    }

    // 6. Leading number
    if (/^\d/.test(trimmed)) {
      issues.push({
        id: `lead_num_${idx}`,
        type: 'leading_number',
        severity: 'warning',
        column: raw,
        columnIndex: idx,
        message: `Header "${raw}" starts with a number. In database engines, identifiers must begin with a letter or underscore.`,
        suggestion: `Prefix with "col_${trimmed}".`,
        fixable: true,
      });
    }

    // 7. Invalid characters & punctuation
    const hasInvalidChars = /[^a-zA-Z0-9_]/.test(trimmed);
    if (hasInvalidChars) {
      const containsSpace = /\s/.test(trimmed);
      issues.push({
        id: `chars_${idx}`,
        type: 'invalid_characters',
        severity: 'warning',
        column: raw,
        columnIndex: idx,
        message: `Header "${raw}" contains ${containsSpace ? 'spaces or ' : ''}non-standard characters.`,
        suggestion: `Sanitize to "${toNamingConvention(trimmed, 'snake_case')}".`,
        fixable: true,
      });
    }

    // 8. Reserved keywords
    if (SQL_RESERVED_KEYWORDS.has(trimmed.toLowerCase())) {
      issues.push({
        id: `keyword_${idx}`,
        type: 'reserved_keyword',
        severity: 'info',
        column: raw,
        columnIndex: idx,
        message: `"${raw}" is an SQL reserved keyword and may require escaping in queries.`,
        suggestion: `Consider appending a suffix, e.g. "${trimmed}_col".`,
        fixable: true,
      });
    }

    // 9. Naming convention compliance
    if (convention !== 'any' && convention !== 'auto') {
      let matches = false;
      switch (convention) {
        case 'snake_case':
          matches = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(trimmed);
          break;
        case 'camelCase':
          matches = /^[a-z][a-zA-Z0-9]*$/.test(trimmed) && !trimmed.includes('_');
          break;
        case 'PascalCase':
          matches = /^[A-Z][a-zA-Z0-9]*$/.test(trimmed) && !trimmed.includes('_');
          break;
        case 'UPPER_CASE':
          matches = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(trimmed);
          break;
        case 'kebab-case':
          matches = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(trimmed);
          break;
        case 'alphanumeric':
          matches = /^[a-zA-Z0-9_]+$/.test(trimmed) && !/^\d/.test(trimmed);
          break;
      }
      if (!matches) {
        issues.push({
          id: `conv_${idx}`,
          type: 'naming_convention',
          severity: 'warning',
          column: raw,
          columnIndex: idx,
          message: `Header "${raw}" does not adhere to the requested ${convention} naming convention.`,
          suggestion: `Convert to "${toNamingConvention(trimmed, convention)}".`,
          fixable: true,
        });
      }
    }
  });

  // 10. Alignment with expected schema columns
  const matchedExpected: string[] = [];
  const missingExpected: string[] = [];
  const unexpectedExtra: string[] = [];

  if (expectedHeaders.length > 0) {
    const rawSet = new Set(rawHeadersList.map((h) => h.trim().toLowerCase()));
    const expectedSet = new Set(expectedHeaders.map((h) => h.trim().toLowerCase()));

    expectedHeaders.forEach((exp) => {
      const expNorm = exp.trim().toLowerCase();
      if (rawSet.has(expNorm)) {
        matchedExpected.push(exp);
      } else {
        missingExpected.push(exp);
      }
    });

    rawHeadersList.forEach((raw) => {
      const rawNorm = raw.trim().toLowerCase();
      if (rawNorm && !expectedSet.has(rawNorm)) {
        unexpectedExtra.push(raw.trim());
      }
    });

    if (missingExpected.length > 0) {
      issues.push({
        id: 'missing_expected',
        type: 'missing_expected',
        severity: 'warning',
        message: `Missing ${missingExpected.length} expected column(s) from target schema: [${missingExpected.slice(0, 4).join(', ')}${missingExpected.length > 4 ? ` +${missingExpected.length - 4} more` : ''}].`,
        suggestion: `Verify whether this file matches your expected schema design.`,
        fixable: false,
      });
    }

    if (unexpectedExtra.length > 0) {
      issues.push({
        id: 'unexpected_extra',
        type: 'unexpected_extra',
        severity: 'info',
        message: `File contains ${unexpectedExtra.length} unexpected extra column(s): [${unexpectedExtra.slice(0, 4).join(', ')}${unexpectedExtra.length > 4 ? ` +${unexpectedExtra.length - 4} more` : ''}].`,
        suggestion: `These extra columns will be added to the extracted schema unless excluded.`,
        fixable: false,
      });
    }
  }

  // Generate sanitized headers
  const effectiveConvention =
    convention === 'any' || convention === 'auto' ? 'snake_case' : convention;
  const sanitizedHeaders = sanitizeAllHeaders(rawHeadersList, effectiveConvention);

  // Build column-level diagnostic mapping
  const headerMapping: HeaderColumnMapping[] = rawHeadersList.map((original, idx) => {
    const colIssues = issues.filter((iss) => iss.columnIndex === idx);
    const hasCrit = colIssues.some((i) => i.severity === 'critical');
    const hasWarn = colIssues.some((i) => i.severity === 'warning');
    return {
      original,
      sanitized: sanitizedHeaders[idx],
      index: idx,
      issues: colIssues,
      status: hasCrit ? 'critical' : hasWarn ? 'warning' : 'valid',
    };
  });

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    isValid: criticalCount === 0,
    hasWarnings: criticalCount > 0 || warningCount > 0,
    hasErrors: criticalCount > 0,
    criticalCount,
    warningCount,
    infoCount,
    totalHeaders: rawHeadersList.length,
    issues,
    rawHeaders: rawHeadersList,
    sanitizedHeaders,
    headerMapping,
    matchedExpected,
    missingExpected,
    unexpectedExtra,
  };
}

/**
 * Apply sanitized headers to a ParsedWorkbook's active sheet
 */
export function applySanitizedHeadersToWorkbook(
  workbook: ParsedWorkbook,
  sheetName: string,
  newHeaders: string[]
): ParsedWorkbook {
  const currentSheet = workbook.sheets[sheetName];
  if (!currentSheet) return workbook;

  const updatedSheet: SheetData = {
    ...currentSheet,
    headers: [...newHeaders],
    totalCols: newHeaders.length,
  };

  return {
    ...workbook,
    sheets: {
      ...workbook.sheets,
      [sheetName]: updatedSheet,
    },
  };
}

/**
 * Offline In-Memory Universal Data File Parser.
 * Supports: XLSX, XLS (Excel), CSV, TSV, JSON, JSONL (NDJSON), XML, and TXT.
 * Uses SheetJS and browser native parsers in-memory with zero network requests.
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParsedWorkbook> {
  const filename = file.name;
  const lowerName = filename.toLowerCase();

  // 1. JSON Array of Objects or Object
  if (lowerName.endsWith('.json')) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const items: any[] = Array.isArray(parsed) ? parsed : [parsed];
      const headerSet = new Set<string>();
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach((k) => headerSet.add(k));
        }
      }
      const headers = Array.from(headerSet);
      if (headers.length === 0) headers.push('value');

      const dataRows = items.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return headers.map((h) => item[h] ?? null);
        }
        return [item];
      });

      const sheetName = 'Records';
      return {
        filename,
        sheetNames: [sheetName],
        sheets: {
          [sheetName]: {
            sheetName,
            headers,
            rows: dataRows,
            totalRows: dataRows.length,
            totalCols: headers.length,
          },
        },
        fileFormat: 'json',
        rawFile: file,
        rawContent: text,
        rawJson: items,
      };
    } catch (e: any) {
      throw new Error(`Invalid JSON file format: ${e.message}`);
    }
  }

  // 2. JSON Lines (NDJSON)
  if (lowerName.endsWith('.jsonl') || lowerName.endsWith('.ndjson')) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items: any[] = [];
    const headerSet = new Set<string>();

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        items.push(obj);
        if (typeof obj === 'object' && obj !== null) {
          Object.keys(obj).forEach((k) => headerSet.add(k));
        }
      } catch {
        // ignore malformed line
      }
    }

    const headers = Array.from(headerSet);
    const dataRows = items.map((item) => headers.map((h) => item[h] ?? null));
    const sheetName = 'Stream';

    return {
      filename,
      sheetNames: [sheetName],
      sheets: {
        [sheetName]: {
          sheetName,
          headers,
          rows: dataRows,
          totalRows: dataRows.length,
          totalCols: headers.length,
        },
      },
      fileFormat: 'jsonl',
      rawFile: file,
      rawContent: text,
      rawJson: items,
    };
  }

  // 3. XML Data File
  if (lowerName.endsWith('.xml')) {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'application/xml');
    const records = Array.from(xmlDoc.querySelectorAll('record, row, item, entry'));
    const headerSet = new Set<string>();
    const items: any[] = [];

    for (const rec of records) {
      const rowObj: Record<string, any> = {};
      for (const child of Array.from(rec.children)) {
        headerSet.add(child.tagName);
        rowObj[child.tagName] = child.textContent;
      }
      items.push(rowObj);
    }

    const headers = Array.from(headerSet);
    const dataRows = items.map((item) => headers.map((h) => item[h] ?? null));
    const sheetName = 'Dataset';

    return {
      filename,
      sheetNames: [sheetName],
      sheets: {
        [sheetName]: {
          sheetName,
          headers,
          rows: dataRows,
          totalRows: dataRows.length,
          totalCols: headers.length,
        },
      },
      fileFormat: 'xml',
      rawFile: file,
      rawContent: text,
    };
  }

  // 4. Spreadsheets: XLSX, XLS, CSV, TSV, TXT
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  let fileFormat = 'csv';
  if (lowerName.endsWith('.xlsx')) fileFormat = 'xlsx';
  else if (lowerName.endsWith('.xls')) fileFormat = 'xls';
  else if (lowerName.endsWith('.tsv')) fileFormat = 'tsv';
  else if (lowerName.endsWith('.txt')) fileFormat = 'txt';

  const sheetNames = workbook.SheetNames;
  const sheets: Record<string, SheetData> = {};

  for (const name of sheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rawRows.length === 0) {
      sheets[name] = {
        sheetName: name,
        headers: [],
        rawHeaders: [],
        validationReport: validateCsvHeaders([], { fileFormat: 'csv' }),
        rows: [],
        totalRows: 0,
        totalCols: 0,
      };
      continue;
    }

    const headerRow = rawRows[0] || [];
    const rawHeaders = headerRow.map((cell: any) =>
      cell !== null && cell !== undefined ? String(cell) : ''
    );
    const validationReport = validateCsvHeaders(rawHeaders, {
      expectedConvention: 'auto',
      fileFormat,
    });

    const headers = headerRow.map((cell: any, idx: number) => {
      const str = cell !== null && cell !== undefined ? String(cell).trim() : '';
      return str || `col_${idx + 1}`;
    });

    const dataRows = rawRows.slice(1).map((row) => {
      return headers.map((_, colIdx) => {
        const val = row[colIdx];
        if (val === undefined || val === null || val === '') return null;
        if (val instanceof Date) {
          return val.toISOString().slice(0, 19).replace('T', ' ');
        }
        return val;
      });
    });

    sheets[name] = {
      sheetName: name,
      headers,
      rawHeaders,
      validationReport,
      rows: dataRows,
      totalRows: dataRows.length,
      totalCols: headers.length,
    };
  }

  return {
    filename: file.name,
    sheetNames,
    sheets,
    rawWorkbook: workbook,
    fileFormat,
    rawFile: file,
  };
}

/**
 * Parse plain pasted CSV or TSV string offline
 */
export function parsePastedDelimitedText(text: string, filename: string = 'pasted_data.csv'): ParsedWorkbook {
  const workbook = XLSX.read(text, { type: 'string' });
  const sheetName = workbook.SheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  const headerRow = rawRows[0] || [];
  const rawHeaders = headerRow.map((cell: any) =>
    cell !== null && cell !== undefined ? String(cell) : ''
  );
  const validationReport = validateCsvHeaders(rawHeaders, {
    expectedConvention: 'auto',
    fileFormat: 'csv',
  });

  const headers = headerRow.map((cell: any, idx: number) => {
    const str = cell !== null && cell !== undefined ? String(cell).trim() : '';
    return str || `col_${idx + 1}`;
  });

  const dataRows = rawRows.slice(1).map((row) => {
    return headers.map((_, colIdx) => {
      const val = row[colIdx];
      if (val === undefined || val === null || val === '') return null;
      return val;
    });
  });

  return {
    filename,
    fileFormat: 'csv',
    rawContent: text,
    sheetNames: [sheetName],
    sheets: {
      [sheetName]: {
        sheetName,
        headers,
        rawHeaders,
        validationReport,
        rows: dataRows,
        totalRows: dataRows.length,
        totalCols: headers.length,
      },
    },
  };
}

/**
 * Parse human row range string, e.g.:
 * "1-500", "1 to 200", "50-100", "first 100", "all", "1, 2, 5-10"
 */
export function parseRowRangeInput(
  input: string,
  totalAvailableRows: number
): { startIndex: number; endIndex: number; count: number } {
  const clean = input.trim().toLowerCase();
  if (!clean || clean === 'all' || clean === '*') {
    return { startIndex: 0, endIndex: totalAvailableRows, count: totalAvailableRows };
  }

  // Matches "first 50" or "top 100"
  const firstMatch = clean.match(/(?:first|top)\s+(\d+)/);
  if (firstMatch) {
    const count = Math.min(parseInt(firstMatch[1], 10), totalAvailableRows);
    return { startIndex: 0, endIndex: count, count };
  }

  // Matches "1-500" or "1 to 500" or "1..500"
  const rangeMatch = clean.match(/(\d+)\s*(?:-|to|\.\.)\s*(\d+)/);
  if (rangeMatch) {
    const start = Math.max(0, parseInt(rangeMatch[1], 10) - 1); // 1-indexed to 0-indexed
    const end = Math.min(totalAvailableRows, parseInt(rangeMatch[2], 10));
    return {
      startIndex: start,
      endIndex: Math.max(start + 1, end),
      count: Math.max(1, end - start),
    };
  }

  // Single number e.g. "500" -> treat as first 500 rows
  const singleNum = parseInt(clean, 10);
  if (!isNaN(singleNum) && singleNum > 0) {
    const count = Math.min(singleNum, totalAvailableRows);
    return { startIndex: 0, endIndex: count, count };
  }

  return { startIndex: 0, endIndex: Math.min(500, totalAvailableRows), count: Math.min(500, totalAvailableRows) };
}

/**
 * Parse column focus string:
 * Can be comma-separated column names or letters/indices, e.g.:
 * "name, email, price, status" or "A, B, D, F" or "1, 2, 5"
 */
export function parseColumnFocusInput(input: string, availableHeaders: string[]): string[] {
  const clean = input.trim();
  if (!clean || clean === '*' || clean.toLowerCase() === 'all') {
    return [...availableHeaders];
  }

  const tokens = clean.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  const matchedHeaders: string[] = [];

  for (const token of tokens) {
    // 1. Direct name match (case-insensitive)
    const foundDirect = availableHeaders.find((h) => h.toLowerCase() === token.toLowerCase());
    if (foundDirect) {
      if (!matchedHeaders.includes(foundDirect)) matchedHeaders.push(foundDirect);
      continue;
    }

    // 2. Partial substring name match
    const foundPartial = availableHeaders.find((h) => h.toLowerCase().includes(token.toLowerCase()));
    if (foundPartial) {
      if (!matchedHeaders.includes(foundPartial)) matchedHeaders.push(foundPartial);
      continue;
    }

    // 3. Excel column letter match (e.g. A, B, AA)
    if (/^[A-Za-z]+$/.test(token)) {
      const colIdx = letterToColumnIndex(token.toUpperCase());
      if (colIdx >= 0 && colIdx < availableHeaders.length) {
        const header = availableHeaders[colIdx];
        if (!matchedHeaders.includes(header)) matchedHeaders.push(header);
        continue;
      }
    }

    // 4. Numeric 1-indexed column number (e.g. "1", "3")
    const num = parseInt(token, 10);
    if (!isNaN(num) && num >= 1 && num <= availableHeaders.length) {
      const header = availableHeaders[num - 1];
      if (!matchedHeaders.includes(header)) matchedHeaders.push(header);
      continue;
    }
  }

  return matchedHeaders.length > 0 ? matchedHeaders : availableHeaders;
}

function letterToColumnIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Check if a field name indicates sensitive / PII data
 */
export function isSensitiveField(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const sensitivePatterns = [
    /pass(word)?/,
    /secret/,
    /token/,
    /ssn|social_?security/,
    /credit_?card|card_?num|cvv|expir/,
    /bank|account_?num|iban|routing/,
    /first_?name|last_?name|full_?name|patient|customer_?name/,
    /email|e_?mail/,
    /phone|mobile|cell|telephone/,
    /address|street|zip|postal/,
    /salary|wage|bonus|net_?worth|income|compensation/,
    /dob|date_?of_?birth|birth_?date/,
    /license|passport|national_?id|tax_?id/,
    /ip_?address|mac_?address/,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(lower));
}

/**
 * Main Offline Pattern Extraction Algorithm.
 * Evaluates column values, computes statistical distribution,
 * null percentages, types, and generates both 'Realistic' and 'Mock' rules.
 */
export function extractFieldArchitecture(
  headers: string[],
  rows: (string | number | boolean | null)[][],
  modeOrOptions: ExtractionMode | ExtractionOptions = 'realistic',
  selectedColumnNames?: string[]
): ExtractedColumnResult[] {
  const options: ExtractionOptions =
    typeof modeOrOptions === 'string'
      ? { mode: modeOrOptions, selectedColumnNames }
      : modeOrOptions;

  const mode = options.mode || 'realistic';
  const effectiveSelectedCols = options.selectedColumnNames || selectedColumnNames;

  const targetHeaders = effectiveSelectedCols && effectiveSelectedCols.length > 0
    ? headers.filter((h) => effectiveSelectedCols.includes(h))
    : headers;

  const results: ExtractedColumnResult[] = [];

  for (const header of targetHeaders) {
    const colIndex = headers.indexOf(header);
    if (colIndex === -1) continue;

    // Extract all values for this column
    const rawValues = rows.map((r) => r[colIndex]);
    const totalCount = rawValues.length;
    const nonNullValues = rawValues.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const nullCount = totalCount - nonNullValues.length;
    const skip_pct = totalCount > 0 ? Math.round((nullCount / totalCount) * 100) : 0;

    const sensitive = isSensitiveField(header);
    const cleanHeader = header.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    // Unique non-null values
    const uniqueValueSet = new Set(nonNullValues.map((v) => String(v).trim()));
    const uniqueCount = uniqueValueSet.size;
    const samples = nonNullValues.slice(0, 5);

    // Analyze pattern with criteria and options
    const pattern = analyzeColumnPattern(header, nonNullValues, uniqueValueSet, totalCount, options);

    // Apply Mode: Realistic vs Mock
    let finalType: ColumnType = pattern.type;
    let finalRule: string = pattern.rule;

    if (mode === 'mock' || sensitive) {
      // If Sensitive or Mock mode is chosen, apply sanitization and mock rules
      const mockResult = applyMockSanitization(header, pattern, nonNullValues);
      finalType = mockResult.type;
      finalRule = mockResult.rule;
    } else {
      // Realistic mode
      finalType = pattern.type;
      finalRule = pattern.rule;
    }

    results.push({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name: cleanHeader || `field_${results.length + 1}`,
      originalName: header,
      type: finalType,
      rule: finalRule,
      skip_pct,
      condition: '',
      sampleValues: samples,
      uniqueCount,
      totalCount,
      nullCount,
      isSensitive: sensitive,
      detectedFormat: pattern.notes,
      notes: pattern.notes,
      inferredRegexRule: pattern.inferredRegexRule,
      inferredEnumRule: pattern.inferredEnumRule,
      isAlphanumericCode: pattern.isAlphanumericCode,
    });
  }

  return results;
}

interface PatternAnalysis {
  type: ColumnType;
  rule: string;
  entitySubtype?: EntitySubtype;
  notes: string;
  inferredRegexRule?: string;
  inferredEnumRule?: string;
  isAlphanumericCode?: boolean;
}

/**
 * Detects whether sample values exhibit characteristics of structured alphanumeric codes,
 * identifiers, SKUs, serial numbers, or masked tokens.
 */
export function isAlphanumericCode(values: string[], header: string): boolean {
  if (values.length === 0) return false;
  const h = header.toLowerCase();

  const hasCodeHeader = /(?:^|_)(?:id|code|sku|serial|ref|num|number|batch|ticket|order|inv|invoice|txn|trans|vin|license|part|model|barcode|tracking)(?:$|_)/i.test(h);
  const hasCategoryHeader = /(?:^|_)(?:status|type|category|tier|gender|priority|role|department|stage|state|level|frequency|method|classification|group|condition)(?:$|_)/i.test(h);

  let mixedAlphaNumeric = 0;
  let delimitedDigits = 0;
  let uppercaseDigits = 0;
  let wordCount = 0;

  for (const raw of values.slice(0, 35)) {
    const v = raw.trim();
    if (!v) continue;

    const hasLetters = /[a-zA-Z]/.test(v);
    const hasDigits = /\d/.test(v);
    const hasDelims = /[-_/#.:]/.test(v);

    if (hasLetters && hasDigits) {
      mixedAlphaNumeric++;
    }
    if (hasDelims && hasDigits) {
      delimitedDigits++;
    }
    if (/^[A-Z0-9_\-#/.]{3,24}$/.test(v) && hasDigits) {
      uppercaseDigits++;
    }
    if (/^[a-zA-Z\s&]{2,30}$/.test(v)) {
      wordCount++;
    }
  }

  const sampleSize = Math.min(values.length, 35) || 1;
  const mixedRatio = mixedAlphaNumeric / sampleSize;
  const delimRatio = delimitedDigits / sampleSize;
  const codeRatio = uppercaseDigits / sampleSize;
  const wordRatio = wordCount / sampleSize;

  // If mostly dictionary/label words and header is categorical, not a code
  if (hasCategoryHeader && wordRatio >= 0.6) {
    return false;
  }

  if (hasCodeHeader) {
    return mixedRatio > 0.15 || delimRatio > 0.15 || codeRatio > 0.15 || wordRatio < 0.6;
  }

  return mixedRatio >= 0.35 || delimRatio >= 0.35 || codeRatio >= 0.35;
}

/**
 * Checks if column values and header strongly point to natural categorical labels/words.
 */
export function isLikelyCategorical(values: string[], header: string, uniqueCount: number): boolean {
  if (uniqueCount < 2 || uniqueCount > 30) return false;
  const h = header.toLowerCase();

  const hasCategoryHeader = /(?:^|_)(?:status|type|category|tier|gender|priority|role|department|stage|state|level|frequency|method|classification|group|condition)(?:$|_)/i.test(h);

  let wordCount = 0;
  for (const raw of values.slice(0, 30)) {
    const v = raw.trim();
    if (/^[a-zA-Z\s&/]{2,30}$/.test(v)) {
      wordCount++;
    }
  }

  const sampleSize = Math.min(values.length, 30) || 1;
  const wordRatio = wordCount / sampleSize;

  return (hasCategoryHeader && wordRatio >= 0.5) || (wordRatio >= 0.85 && uniqueCount <= 15);
}

/**
 * Builds a weighted Set/Enum rule: e.g. "Active:60, Pending:30, Inactive:10"
 */
export function buildEnumRule(
  values: string[],
  uniqueValues: Set<string>,
  totalCount: number,
  maxItems = 15
): string {
  const freqMap: Record<string, number> = {};
  for (const v of values) {
    const clean = String(v).trim();
    if (clean) freqMap[clean] = (freqMap[clean] || 0) + 1;
  }
  const totalFreq = Object.values(freqMap).reduce((a, b) => a + b, 0) || totalCount || 1;
  const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);

  return sorted
    .slice(0, maxItems)
    .map(([val, freq]) => {
      const pct = Math.max(1, Math.round((freq / totalFreq) * 100));
      const cleanVal = val.replace(/[:,]/g, ' ').trim();
      return `${cleanVal}:${pct}`;
    })
    .join(', ');
}

/**
 * Converts a string to its structural mask representation.
 * e.g. "ORD-1234" -> "[A-Z]{3}-\d{4}"
 */
export function stringToStructuralMask(val: string): string {
  if (!val) return '';
  const tokens: string[] = [];
  let i = 0;
  while (i < val.length) {
    const ch = val[i];
    if (/\d/.test(ch)) {
      let count = 0;
      while (i < val.length && /\d/.test(val[i])) {
        count++;
        i++;
      }
      tokens.push(count === 1 ? '\\d' : `\\d{${count}}`);
    } else if (/[A-Z]/.test(ch)) {
      let count = 0;
      while (i < val.length && /[A-Z]/.test(val[i])) {
        count++;
        i++;
      }
      tokens.push(count === 1 ? '[A-Z]' : `[A-Z]{${count}}`);
    } else if (/[a-z]/.test(ch)) {
      let count = 0;
      while (i < val.length && /[a-z]/.test(val[i])) {
        count++;
        i++;
      }
      tokens.push(count === 1 ? '[a-z]' : `[a-z]{${count}}`);
    } else {
      tokens.push(ch);
      i++;
    }
  }
  return tokens.join('');
}

/**
 * Finds the longest common static prefix among non-empty strings.
 */
function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (!prefix) return '';
    }
  }
  return prefix;
}

/**
 * High-precision RegEx Pattern Synthesizer.
 * Analyzes prefixes, suffixes, delimiters, character classes, and masks.
 */
export function inferRegexPattern(
  values: string[],
  header = ''
): { pattern: string; confidence: number; notes: string } | null {
  const sample = values.slice(0, 35).filter((s) => s.length > 0);
  if (sample.length < 2) return null;

  // 1. Common Prefix + Digits pattern (e.g. "ORD-001", "INV_2023_01", "SKU042", "#1002")
  const commonPrefix = findCommonPrefix(sample);
  if (commonPrefix.length >= 2 || (commonPrefix.length === 1 && /[-_#/]/.test(commonPrefix))) {
    const remainders = sample.map((s) => s.slice(commonPrefix.length));
    const allDigits = remainders.every((rem) => /^\d+$/.test(rem));
    if (allDigits && remainders.length > 0) {
      const lengths = remainders.map((r) => r.length);
      const minL = Math.min(...lengths);
      const maxL = Math.max(...lengths);
      const digitSpec = minL === maxL ? `\\d{${minL}}` : `\\d{${minL},${maxL}}`;
      const pattern = `${commonPrefix}${digitSpec}`;
      return {
        pattern,
        confidence: 0.95,
        notes: `Prefix Code Pattern (${pattern})`,
      };
    }
  }

  // 2. Structural Mask Frequency Analysis
  const masks = sample.map(stringToStructuralMask);
  const maskFreq: Record<string, number> = {};
  for (const m of masks) {
    maskFreq[m] = (maskFreq[m] || 0) + 1;
  }
  const sortedMasks = Object.entries(maskFreq).sort((a, b) => b[1] - a[1]);
  if (sortedMasks.length > 0) {
    const [bestMask, count] = sortedMasks[0];
    const matchRatio = count / sample.length;
    if (matchRatio >= 0.5 && bestMask.length >= 3) {
      return {
        pattern: bestMask,
        confidence: matchRatio,
        notes: `Structural Mask (${bestMask})`,
      };
    }
  }

  // 3. Fixed-length pure numeric code check (e.g. 5-digit zip code \d{5}, 8-digit ID \d{8})
  if (sample.every((s) => /^\d{3,16}$/.test(s))) {
    const lengths = sample.map((s) => s.length);
    const minL = Math.min(...lengths);
    const maxL = Math.max(...lengths);
    const pattern = minL === maxL ? `\\d{${minL}}` : `\\d{${minL},${maxL}}`;
    return {
      pattern,
      confidence: 0.85,
      notes: `Numeric Code (${pattern})`,
    };
  }

  // 4. Mixed alphanumeric code with delimiter
  if (sample.every((s) => /^[A-Za-z0-9]{1,8}[-_/.][A-Za-z0-9]{1,8}$/.test(s))) {
    return {
      pattern: '[A-Z]{2,4}-\\d{3,5}',
      confidence: 0.75,
      notes: 'Delimited Alphanumeric Code',
    };
  }

  // 5. Short distinct code set fallback (e.g. ["STD", "EXP", "PRI"])
  const uniqueVals = Array.from(new Set(sample));
  if (uniqueVals.length >= 2 && uniqueVals.length <= 6 && uniqueVals.every((v) => /^[A-Z0-9_-]{2,10}$/.test(v))) {
    const pattern = `(${uniqueVals.join('|')})`;
    return {
      pattern,
      confidence: 0.7,
      notes: `Code Set Pattern (${pattern})`,
    };
  }

  return null;
}

function analyzeColumnPattern(
  header: string,
  values: (string | number | boolean | null)[],
  uniqueValues: Set<string>,
  totalRows: number,
  options?: ExtractionOptions
): PatternAnalysis {
  const h = header.toLowerCase();
  const stringValues = values.map((v) => String(v).trim());
  const count = values.length;

  const pref = options?.patternPreference || 'smart';
  const maxEnum = options?.maxEnumUnique || 12;
  const ignoreAlphaInEnum = options?.ignoreAlphanumericInEnum ?? true;

  if (count === 0) {
    return { type: 'String', rule: '12', notes: 'Empty Column' };
  }

  // Pre-compute inferred alternative rules for quick switching
  const inferredEnum = buildEnumRule(stringValues, uniqueValues, count, maxEnum);
  const regexAnalysis = inferRegexPattern(stringValues, header);
  const inferredRegex = regexAnalysis?.pattern || (isAlphanumericCode(stringValues, header) ? '[A-Z0-9]{6,10}' : `[A-Za-z0-9]{${Math.min(16, Math.max(4, Math.round(stringValues.reduce((a, s) => a + s.length, 0) / (count || 1))))}}`);
  const isCode = isAlphanumericCode(stringValues, header);
  const isCat = isLikelyCategorical(stringValues, header, uniqueValues.size);

  // 1. UUID Check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidMatches = stringValues.filter((v) => uuidRegex.test(v)).length;
  if (uuidMatches / count >= 0.7 || h.includes('uuid') || (h.includes('guid') && uuidMatches > 0)) {
    return {
      type: 'UUID',
      rule: '',
      notes: 'UUID v4 identifier',
      inferredRegexRule: inferredRegex,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: isCode,
    };
  }

  // 2. Sequence Check (Auto-increment integers)
  const allIntegers = values.every((v) => typeof v === 'number' && Number.isInteger(v) || (!isNaN(Number(v)) && Number.isInteger(Number(v))));
  if (allIntegers && count >= 3) {
    const numValues = values.map((v) => Number(v));
    const isAscendingSeq = numValues.every((val, idx) => idx === 0 || val === numValues[idx - 1] + 1);
    if (isAscendingSeq || (h.includes('id') && uniqueValues.size === count && numValues[0] >= 0)) {
      const start = Math.min(...numValues);
      return {
        type: 'Sequence',
        rule: String(start > 0 ? start : 1),
        notes: `Sequential ID starting at ${start}`,
        inferredRegexRule: inferredRegex,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: isCode,
      };
    }
  }

  // 3. Email Check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailMatches = stringValues.filter((v) => emailRegex.test(v)).length;
  if (emailMatches / count >= 0.6 || h.includes('email') || h.includes('mail')) {
    return {
      type: 'Entity',
      rule: 'email',
      entitySubtype: 'email',
      notes: 'Email Address',
      inferredRegexRule: '[a-z]{4,8}\\.[a-z]{4,8}@example\\.com',
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // 4. Phone Check
  const phoneRegex = /^\+?[\d\s\-\(\)\.]{7,20}$/;
  const phoneMatches = stringValues.filter((v) => phoneRegex.test(v) && /\d{4,}/.test(v)).length;
  if (phoneMatches / count >= 0.6 || h.includes('phone') || h.includes('mobile') || h.includes('tel')) {
    return {
      type: 'Entity',
      rule: 'phone',
      entitySubtype: 'phone',
      notes: 'Phone Number',
      inferredRegexRule: '\\+1-\\d{3}-\\d{3}-\\d{4}',
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // 5. IP Address Check
  const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipMatches = stringValues.filter((v) => ipRegex.test(v)).length;
  if (ipMatches / count >= 0.6 || h.includes('ip_address') || h === 'ip') {
    return {
      type: 'Entity',
      rule: 'ip_address',
      entitySubtype: 'ip_address',
      notes: 'IPv4 Address',
      inferredRegexRule: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}',
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // 6. URL Check
  const urlRegex = /^https?:\/\//i;
  const urlMatches = stringValues.filter((v) => urlRegex.test(v)).length;
  if (urlMatches / count >= 0.6 || h.includes('url') || h.includes('link') || h.includes('website')) {
    return {
      type: 'Entity',
      rule: 'url',
      entitySubtype: 'url',
      notes: 'Web URL',
      inferredRegexRule: 'https://[a-z]{4,10}\\.com/[a-z]{3,6}',
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // 7. Date / DateTime Check
  const isDateColumn = isLikelyDateTime(h, stringValues);
  if (isDateColumn.isMatch) {
    return {
      type: 'DateTime',
      rule: isDateColumn.format,
      notes: `Date/Time (${isDateColumn.format})`,
      inferredRegexRule: inferredRegex,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // 8. Named Entity Detection by Header keyword
  if (/(?:full_?)?name|customer|client|patient|user_?name|author|creator/i.test(h) && !/company|file|product|app/i.test(h)) {
    return { type: 'Entity', rule: 'full_name', entitySubtype: 'full_name', notes: 'Full Name', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }
  if (/first_?name|fname|given_?name/i.test(h)) {
    return { type: 'Entity', rule: 'first_name', entitySubtype: 'first_name', notes: 'First Name', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }
  if (/last_?name|lname|surname|family_?name/i.test(h)) {
    return { type: 'Entity', rule: 'last_name', entitySubtype: 'last_name', notes: 'Last Name', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }
  if (/company|organization|corp|employer|agency/i.test(h)) {
    return { type: 'Entity', rule: 'company', entitySubtype: 'company', notes: 'Company Name', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }
  if (/job|title|designation|profession|position|role/i.test(h) && uniqueValues.size > 15) {
    return { type: 'Entity', rule: 'job_title', entitySubtype: 'job_title', notes: 'Job Title', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }
  if (/country|nation/i.test(h)) {
    return { type: 'Entity', rule: 'country', entitySubtype: 'country', notes: 'Country Name', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }
  if (/city|town|municipality/i.test(h)) {
    return { type: 'Entity', rule: 'city', entitySubtype: 'city', notes: 'City Name', inferredRegexRule: inferredRegex, inferredEnumRule: inferredEnum, isAlphanumericCode: false };
  }

  // 9. Boolean Check
  const boolMatches = stringValues.filter((v) => {
    const l = v.toLowerCase();
    return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 't', 'f'].includes(l);
  }).length;
  if (boolMatches / count >= 0.85 || (uniqueValues.size <= 2 && /is_|has_|can_|active|enabled/i.test(h))) {
    return {
      type: 'Boolean',
      rule: '',
      notes: 'Boolean True/False',
      inferredRegexRule: '(true|false)',
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // 10. Numeric Check (Float vs Int, while guarding against formatted ID codes with leading zeros)
  const numericCount = values.filter((v) => !isNaN(Number(v)) && v !== null && v !== '').length;
  const hasLeadingZeroes = stringValues.some((s) => /^0\d{2,}$/.test(s));
  const isPureIdHeader = /^(?:id|code|sku|zip|postal|account_no|ssn|serial)$/i.test(h.trim());

  if (numericCount / count >= 0.8 && (!hasLeadingZeroes || !isPureIdHeader)) {
    const numbers = values.map((v) => Number(v)).filter((n) => !isNaN(n));
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const hasDecimals = numbers.some((n) => !Number.isInteger(n));

    if (hasDecimals || /price|amount|cost|balance|rate|salary|fee|total|avg|score/i.test(h)) {
      const precision = detectFloatPrecision(stringValues);
      return {
        type: 'Float',
        rule: `${min.toFixed(precision)}, ${max.toFixed(precision)}, ${precision}`,
        notes: `Decimal Number [${min} to ${max}]`,
        inferredRegexRule: `\\d{2,4}\\.\\d{${precision}}`,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: false,
      };
    } else if (!hasLeadingZeroes) {
      return {
        type: 'Int',
        rule: `${Math.round(min)}, ${Math.round(max)}`,
        notes: `Integer Range [${Math.round(min)} to ${Math.round(max)}]`,
        inferredRegexRule: `\\d{${Math.max(1, String(Math.round(max)).length)}}`,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: false,
      };
    }
  }

  // 11. Discerning Phase: RegEx vs Set/Enum vs String
  // Guided by user preference and mathematical/structural criteria

  // Preference: PREFER REGEX
  if (pref === 'prefer_regex') {
    if (regexAnalysis || isCode) {
      const pattern = regexAnalysis?.pattern || inferredRegex;
      return {
        type: 'RegEx',
        rule: pattern,
        notes: regexAnalysis?.notes || `Alphanumeric Pattern (${pattern})`,
        inferredRegexRule: pattern,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: isCode,
      };
    }
    if (uniqueValues.size >= 2 && uniqueValues.size <= maxEnum) {
      return {
        type: 'Set/Enum',
        rule: inferredEnum,
        notes: `Categorical Set (${uniqueValues.size} observed values)`,
        inferredRegexRule: inferredRegex,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: isCode,
      };
    }
  }

  // Preference: PREFER SET/ENUM
  if (pref === 'prefer_enum') {
    if (uniqueValues.size >= 2 && uniqueValues.size <= maxEnum) {
      return {
        type: 'Set/Enum',
        rule: inferredEnum,
        notes: `Categorical Set (${uniqueValues.size} observed values)`,
        inferredRegexRule: inferredRegex,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: isCode,
      };
    }
    if (regexAnalysis) {
      return {
        type: 'RegEx',
        rule: regexAnalysis.pattern,
        notes: regexAnalysis.notes,
        inferredRegexRule: regexAnalysis.pattern,
        inferredEnumRule: inferredEnum,
        isAlphanumericCode: isCode,
      };
    }
  }

  // Preference: SMART CRITERIA (Default)
  // Criterion 1: If it is an alphanumeric code (letters + digits) or has a code/id header
  if (isCode && ignoreAlphaInEnum) {
    const pattern = regexAnalysis?.pattern || inferredRegex;
    return {
      type: 'RegEx',
      rule: pattern,
      notes: regexAnalysis?.notes || `Alphanumeric Code Pattern (${pattern})`,
      inferredRegexRule: pattern,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: true,
    };
  }

  // Criterion 2: If it looks like natural categorical words/labels
  if (isCat) {
    return {
      type: 'Set/Enum',
      rule: inferredEnum,
      notes: `Categorical Set (${uniqueValues.size} observed values)`,
      inferredRegexRule: inferredRegex,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // Criterion 3: Strong structural pattern match (e.g. prefix + digits or mask)
  if (regexAnalysis && regexAnalysis.confidence >= 0.65) {
    return {
      type: 'RegEx',
      rule: regexAnalysis.pattern,
      notes: regexAnalysis.notes,
      inferredRegexRule: regexAnalysis.pattern,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: isCode,
    };
  }

  // Criterion 4: Low cardinality without alphanumeric code characteristics
  if (uniqueValues.size >= 2 && uniqueValues.size <= maxEnum && !isCode) {
    return {
      type: 'Set/Enum',
      rule: inferredEnum,
      notes: `Categorical Set (${uniqueValues.size} observed values)`,
      inferredRegexRule: inferredRegex,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: false,
    };
  }

  // Criterion 5: Pattern fallback
  if (regexAnalysis) {
    return {
      type: 'RegEx',
      rule: regexAnalysis.pattern,
      notes: regexAnalysis.notes,
      inferredRegexRule: regexAnalysis.pattern,
      inferredEnumRule: inferredEnum,
      isAlphanumericCode: isCode,
    };
  }

  // Fallback: String (with detected average/max length)
  const avgLen = Math.max(4, Math.min(64, Math.round(stringValues.reduce((acc, s) => acc + s.length, 0) / (count || 1))));
  return {
    type: 'String',
    rule: String(avgLen),
    notes: `Text String (~${avgLen} chars)`,
    inferredRegexRule: inferredRegex,
    inferredEnumRule: inferredEnum,
    isAlphanumericCode: isCode,
  };
}

/**
 * Applies Mock & Anonymization rules when dealing with sensitive data
 */
function applyMockSanitization(
  header: string,
  pattern: PatternAnalysis,
  values: (string | number | boolean | null)[]
): { type: ColumnType; rule: string } {
  const h = header.toLowerCase();

  // If it's a person's name -> replace with random entity generator
  if (/name|patient|customer|user|client|author/i.test(h)) {
    if (/first/i.test(h)) return { type: 'Entity', rule: 'first_name' };
    if (/last/i.test(h)) return { type: 'Entity', rule: 'last_name' };
    return { type: 'Entity', rule: 'full_name' };
  }

  // If it's an email -> replace with synthetic email entity
  if (/email|mail/i.test(h) || pattern.rule === 'email') {
    return { type: 'Entity', rule: 'email' };
  }

  // If it's a phone number -> replace with synthetic phone
  if (/phone|mobile|tel|cell/i.test(h) || pattern.rule === 'phone') {
    return { type: 'Entity', rule: 'phone' };
  }

  // If it's an address / location
  if (/city/i.test(h)) return { type: 'Entity', rule: 'city' };
  if (/country/i.test(h)) return { type: 'Entity', rule: 'country' };
  if (/company/i.test(h)) return { type: 'Entity', rule: 'company' };
  if (/job|title|role/i.test(h)) return { type: 'Entity', rule: 'job_title' };

  // If it's a sensitive ID / token / password / hash / account
  if (/pass(word)?|secret|token|ssn|national_?id|tax_?id|credit_?card|iban/i.test(h)) {
    return { type: 'UUID', rule: '' };
  }

  // If it's a Set/Enum with confidential client tags -> anonymize values into generic categories
  if (pattern.type === 'Set/Enum') {
    // Check if category values look sensitive (e.g. real client codes, medical terms)
    if (/diagnos|condition|medic|disease|client|vendor|department/i.test(h)) {
      const parts = pattern.rule.split(',');
      const anonymized = parts.map((p, idx) => {
        const weight = p.split(':')[1]?.trim() || '10';
        return `Category_${String.fromCharCode(65 + idx)}:${weight}`;
      }).join(', ');
      return { type: 'Set/Enum', rule: anonymized };
    }
  }

  // If it's financial / salary amount -> round bounds to prevent leaking exact numbers
  if (pattern.type === 'Float' || pattern.type === 'Int') {
    const parts = pattern.rule.split(',');
    const min = parseFloat(parts[0]) || 0;
    const max = parseFloat(parts[1]) || 100;
    // Broaden slightly by 10% rounded
    const broadenedMin = Math.max(0, Math.floor(min * 0.9));
    const broadenedMax = Math.ceil(max * 1.1);
    if (pattern.type === 'Float') {
      return { type: 'Float', rule: `${broadenedMin}.00, ${broadenedMax}.00, 2` };
    }
    return { type: 'Int', rule: `${broadenedMin}, ${broadenedMax}` };
  }

  // Default fallback
  return { type: pattern.type, rule: pattern.rule };
}

function isLikelyDateTime(header: string, values: string[]): { isMatch: boolean; format: string } {
  const isHeaderDate = /date|time|created|updated|timestamp|birth|expire|due/i.test(header);
  let dateMatches = 0;
  let detectedFormat = 'YYYY-MM-DD HH:mm:ss';

  for (const val of values.slice(0, 25)) {
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(val)) {
      dateMatches++;
      detectedFormat = 'YYYY-MM-DD HH:mm:ss';
    } else if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      dateMatches++;
      detectedFormat = 'YYYY-MM-DD';
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
      dateMatches++;
      detectedFormat = 'MM/DD/YYYY';
    } else if (!isNaN(Date.parse(val)) && val.length >= 8 && /\d/.test(val)) {
      dateMatches++;
    }
  }

  const sampleSize = Math.min(25, values.length);
  const ratio = dateMatches / (sampleSize || 1);

  return {
    isMatch: ratio >= 0.6 || (isHeaderDate && ratio >= 0.3),
    format: detectedFormat,
  };
}

function detectFloatPrecision(values: string[]): number {
  let maxDecimals = 2;
  for (const v of values.slice(0, 30)) {
    const parts = v.split('.');
    if (parts.length === 2) {
      maxDecimals = Math.max(maxDecimals, Math.min(4, parts[1].length));
    }
  }
  return maxDecimals;
}

function detectCommonPattern(values: string[]): string | null {
  const sample = values.slice(0, 20);
  if (sample.length < 3) return null;

  // Check [A-Z]{2,4}-\d{3,5}
  if (sample.every((s) => /^[A-Z]{2,4}-\d{3,6}$/.test(s))) {
    const letters = sample[0].split('-')[0].length;
    const digits = sample[0].split('-')[1].length;
    return `[A-Z]{${letters}}-\\d{${digits}}`;
  }

  // Check 5-digit postal code
  if (sample.every((s) => /^\d{5}$/.test(s))) {
    return '\\d{5}';
  }

  return null;
}
