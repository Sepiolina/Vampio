import { describe, it, expect } from 'vitest';
import {
  validateCsvHeaders,
  sanitizeAllHeaders,
  sanitizeHeaderName,
  toNamingConvention,
  detectCsvDelimiter,
  applySanitizedHeadersToWorkbook,
  ParsedWorkbook,
} from '../utils/schemaExtractor';

describe('CSV Header Format Validation & Anomaly Detection', () => {
  it('passes validation for clean snake_case headers', () => {
    const headers = ['user_id', 'first_name', 'email_address', 'signup_date', 'is_active'];
    const report = validateCsvHeaders(headers, { expectedConvention: 'snake_case' });

    expect(report.isValid).toBe(true);
    expect(report.hasErrors).toBe(false);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.totalHeaders).toBe(5);
  });

  it('detects duplicate headers and case-insensitive collisions', () => {
    const headers = ['id', 'email', 'status', 'id', 'Status'];
    const report = validateCsvHeaders(headers, { expectedConvention: 'auto' });

    expect(report.isValid).toBe(false);
    expect(report.hasErrors).toBe(true);
    expect(report.criticalCount).toBeGreaterThanOrEqual(2);

    const dupIssues = report.issues.filter((i) => i.type === 'duplicate_header');
    expect(dupIssues.length).toBeGreaterThanOrEqual(1);

    const caseIssues = report.issues.filter((i) => i.type === 'case_conflict');
    expect(caseIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('detects empty and blank headers', () => {
    const headers = ['id', '', '   ', 'email'];
    const report = validateCsvHeaders(headers);

    expect(report.isValid).toBe(false);
    expect(report.criticalCount).toBe(2);

    const emptyIssues = report.issues.filter((i) => i.type === 'empty_header');
    expect(emptyIssues).toHaveLength(2);
    expect(emptyIssues[0].columnIndex).toBe(1);
    expect(emptyIssues[1].columnIndex).toBe(2);
  });

  it('detects delimiter squashing anomalies when CSV has semicolon or tab separators', () => {
    const squashedHeaders = ['id;username;first_name;last_name;email'];
    const report = validateCsvHeaders(squashedHeaders);

    expect(report.isValid).toBe(false);
    const delimIssue = report.issues.find((i) => i.type === 'delimiter_anomaly');
    expect(delimIssue).toBeDefined();
    expect(delimIssue?.severity).toBe('critical');
    expect(delimIssue?.message).toContain('delimiter mismatch');
  });

  it('detects data rows mistaken as header labels', () => {
    const dataAsHeaders = [
      '1001',
      '2024-03-15',
      'alice@example.com',
      '550e8400-e29b-41d4-a716-446655440000',
      'true',
      '192.168.1.1',
    ];
    const report = validateCsvHeaders(dataAsHeaders);

    expect(report.hasWarnings).toBe(true);
    const dataIssues = report.issues.filter((i) => i.type === 'data_in_header');
    expect(dataIssues.length).toBe(6);
  });

  it('flags headers with spaces, special characters, and leading numbers', () => {
    const dirtyHeaders = ['1st_choice', 'User Full Name', 'order#id', 'amount$'];
    const report = validateCsvHeaders(dirtyHeaders, { expectedConvention: 'snake_case' });

    expect(report.hasWarnings).toBe(true);
    expect(report.issues.some((i) => i.type === 'leading_number')).toBe(true);
    expect(report.issues.some((i) => i.type === 'invalid_characters')).toBe(true);
  });

  it('validates naming conventions correctly (snake_case, camelCase, PascalCase, UPPER_CASE)', () => {
    const headers = ['userId', 'FirstName', 'order_status', 'TOTAL_PRICE'];

    const snakeReport = validateCsvHeaders(headers, { expectedConvention: 'snake_case' });
    expect(snakeReport.issues.some((i) => i.column === 'userId' && i.type === 'naming_convention')).toBe(true);
    expect(snakeReport.issues.some((i) => i.column === 'FirstName' && i.type === 'naming_convention')).toBe(true);

    const camelReport = validateCsvHeaders(headers, { expectedConvention: 'camelCase' });
    expect(camelReport.issues.some((i) => i.column === 'order_status' && i.type === 'naming_convention')).toBe(true);

    const upperReport = validateCsvHeaders(headers, { expectedConvention: 'UPPER_CASE' });
    expect(upperReport.issues.some((i) => i.column === 'order_status' && i.type === 'naming_convention')).toBe(true);
    expect(upperReport.issues.some((i) => i.column === 'TOTAL_PRICE' && i.type === 'naming_convention')).toBe(false);
  });

  it('compares with target expected schema and reports matched, missing, and extra headers', () => {
    const rawHeaders = ['id', 'user_email', 'status', 'extra_note'];
    const expectedHeaders = ['id', 'user_email', 'status', 'created_at', 'amount'];

    const report = validateCsvHeaders(rawHeaders, { expectedHeaders });

    expect(report.matchedExpected).toEqual(['id', 'user_email', 'status']);
    expect(report.missingExpected).toEqual(['created_at', 'amount']);
    expect(report.unexpectedExtra).toEqual(['extra_note']);

    const missingIssue = report.issues.find((i) => i.type === 'missing_expected');
    expect(missingIssue).toBeDefined();
    expect(missingIssue?.message).toContain('Missing 2 expected column(s)');

    const extraIssue = report.issues.find((i) => i.type === 'unexpected_extra');
    expect(extraIssue).toBeDefined();
  });

  it('auto-sanitizes problematic headers into clean unique identifiers', () => {
    const dirtyHeaders = [
      '  user id  ',
      '',
      'status',
      'status',
      '1st_payment',
      'Order & Invoice #',
    ];

    const sanitized = sanitizeAllHeaders(dirtyHeaders, 'snake_case');

    expect(sanitized[0]).toBe('user_id');
    expect(sanitized[1]).toBe('field_2');
    expect(sanitized[2]).toBe('status');
    expect(sanitized[3]).toBe('status_2'); // deduplicated
    expect(sanitized[4]).toBe('col_1st_payment'); // prefixed leading digit
    expect(sanitized[5]).toBe('order_invoice'); // stripped punctuation

    // Ensure all sanitized headers are unique
    const uniqueSet = new Set(sanitized.map((h) => h.toLowerCase()));
    expect(uniqueSet.size).toBe(dirtyHeaders.length);
  });

  it('converts to different target conventions', () => {
    expect(toNamingConvention('User Full Name', 'snake_case')).toBe('user_full_name');
    expect(toNamingConvention('User Full Name', 'camelCase')).toBe('userFullName');
    expect(toNamingConvention('user_full_name', 'PascalCase')).toBe('UserFullName');
    expect(toNamingConvention('user_full_name', 'UPPER_CASE')).toBe('USER_FULL_NAME');
    expect(toNamingConvention('User Full Name', 'kebab-case')).toBe('user-full-name');
  });

  it('detects CSV delimiter accurately from text sample', () => {
    expect(detectCsvDelimiter('id,name,email\n1,alice,a@b.com')).toBe(',');
    expect(detectCsvDelimiter('id;name;email\n1;alice;a@b.com')).toBe(';');
    expect(detectCsvDelimiter('id\tname\temail\n1\talice\ta@b.com')).toBe('\t');
    expect(detectCsvDelimiter('id|name|email\n1|alice|a@b.com')).toBe('|');
  });

  it('applies sanitized headers to ParsedWorkbook without mutating data rows', () => {
    const mockWb: ParsedWorkbook = {
      filename: 'sample.csv',
      fileFormat: 'csv',
      sheetNames: ['Sheet1'],
      sheets: {
        Sheet1: {
          sheetName: 'Sheet1',
          headers: ['User ID', 'User Email', ''],
          rows: [
            ['101', 'a@b.com', 'foo'],
            ['102', 'c@d.com', 'bar'],
          ],
          totalRows: 2,
          totalCols: 3,
        },
      },
    };

    const sanitizedHeaders = ['user_id', 'user_email', 'field_3'];
    const updated = applySanitizedHeadersToWorkbook(mockWb, 'Sheet1', sanitizedHeaders);

    expect(updated.sheets.Sheet1.headers).toEqual(sanitizedHeaders);
    expect(updated.sheets.Sheet1.rows).toHaveLength(2);
    expect(updated.sheets.Sheet1.rows[0]).toEqual(['101', 'a@b.com', 'foo']);
  });
});
