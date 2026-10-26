import { MAX_INFERENCE_RECORDS } from './columnInference';

export type DetectedLogFormat = 'jsonl' | 'json' | 'apache_nginx' | 'timestamp_level' | 'key_value' | 'delimited' | 'generic_text' | 'spreadsheet' | 'binary' | 'unknown';
export interface LogSample {
  format: DetectedLogFormat;
  records: Record<string, unknown>[];
  evidence: string[];
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Recognize records before header inference, so a first log event never becomes a CSV header. */
export function analyzeLogSample(text: string): LogSample {
  const cleaned = text.trim();
  const lines = cleaned.split(/\r\n|\n|\r/).filter(Boolean).slice(0, MAX_INFERENCE_RECORDS);
  if (!cleaned) return { format: 'unknown', records: [], evidence: [] };
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (isRecord(parsed)) return { format: 'json', records: [parsed], evidence: ['Parsed JSON object'] };
    if (Array.isArray(parsed) && parsed.length && parsed.every(isRecord)) return { format: 'json', records: parsed.slice(0, MAX_INFERENCE_RECORDS), evidence: ['Parsed JSON object array'] };
  } catch { /* JSONL can include an incomplete final sampled line. */ }
  const jsonLines = lines.map(line => { try { const v = JSON.parse(line); return isRecord(v) ? v : null; } catch { return null; } });
  if (jsonLines.filter(Boolean).length && jsonLines.slice(0, -1).every(Boolean) && (jsonLines.at(-1) || lines.at(-1)?.trim().startsWith('{')) && (lines.length > 1 || jsonLines[0])) {
    return { format: 'jsonl', records: jsonLines.filter(isRecord), evidence: ['Complete sampled lines parse as JSON objects; final partial line ignored'] };
  }
  const access = /^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+([^" ]+)(?:\s+([^" ]+))?"\s+(\d{3})\s+(\d+|-)(?:\s+"([^"]*)"\s+"([^"]*)")?/;
  const accessRows = lines.map(line => {
    const m = line.match(access); if (!m) return null;
    return { client_ip: m[1], user: m[2], timestamp: m[3], method: m[4], path: m[5], protocol: m[6] || '', status: Number(m[7]), bytes: m[8] === '-' ? 0 : Number(m[8]), ...(m[9] !== undefined ? { referer: m[9], user_agent: m[10] } : {}) };
  }).filter(isRecord);
  if (accessRows.length >= Math.ceil(lines.length * 0.6)) return { format: 'apache_nginx', records: accessRows, evidence: ['Matched common/combined access-log fields'] };
  const level = /^\[?(\d{4}-\d{2}-\d{2}[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*(?:[-|]\s*)?\[?(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\]?\s*[:|\-]?\s*(.*)$/i;
  const levelRows: Record<string, unknown>[] = [];
  for (const line of lines) {
    const m = line.match(level);
    if (m) levelRows.push({ timestamp: m[1], level: m[2], message: m[3] });
    else if (/^\s|^Caused by:|^at\s/.test(line) && levelRows.length) levelRows[levelRows.length - 1].message += `\n${line}`;
  }
  if (levelRows.length) return { format: 'timestamp_level', records: levelRows, evidence: ['Matched timestamp, severity and message; continuation lines retained'] };
  const kvRows = lines.map(line => {
    const row: Record<string, unknown> = {};
    for (const m of line.matchAll(/(?:^|\s)([\w.\-]+)=(?:"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+))/g)) row[m[1]] = m[2] ?? m[3] ?? m[4];
    return Object.keys(row).length >= 2 ? row : null;
  }).filter(isRecord);
  if (kvRows.length >= Math.ceil(lines.length * 0.6)) return { format: 'key_value', records: kvRows, evidence: ['Matched two or more key=value fields per record'] };
  return { format: 'generic_text', records: [], evidence: ['No recognized structured log record format'] };
}
