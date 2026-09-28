import { describe, it, expect } from 'vitest';
import {
  detectEncoding,
  detectLanguages,
  detectDelimiter,
  detectFileLock,
  detectFileForensics,
  generateWorkspaceProfileBundle,
  exportWorkspaceProfileBundleJson,
  validateAndParseWorkspaceBundle,
  analyzeFolderFiles,
  DiscoveredFolderFile
} from '../utils/folderBehaviorAnalyzer';

describe('Folder Behavior Profiler & Forensic Engine', () => {
  describe('Encoding Detection', () => {
    it('should detect UTF-8 with BOM', () => {
      const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x62, 0x63]);
      const res = detectEncoding(bomBytes);
      expect(res.encoding).toBe('UTF-8 with BOM');
      expect(res.confidence).toBe(100);
    });

    it('should detect UTF-16 LE and BE BOMs', () => {
      const le = new Uint8Array([0xff, 0xfe, 0x61, 0x00]);
      expect(detectEncoding(le).encoding).toBe('UTF-16 LE');

      const be = new Uint8Array([0xfe, 0xff, 0x00, 0x61]);
      expect(detectEncoding(be).encoding).toBe('UTF-16 BE');
    });

    it('should detect pure ASCII', () => {
      const asciiBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const res = detectEncoding(asciiBytes);
      expect(res.encoding).toBe('ASCII');
      expect(res.confidence).toBeGreaterThanOrEqual(90);
    });

    it('should detect Thai TIS-620 / Windows-874 byte range', () => {
      // In TIS-620: ก = 0xA1, ข = 0xA2, ค = 0xA3
      const tis620Bytes = new Uint8Array([
        0x50, 0x41, 0x54, 0x48, 0x3a, // "PATH:"
        0xa1, 0xa2, 0xa3, 0xa4, 0xa5, // Thai characters
      ]);
      const res = detectEncoding(tis620Bytes);
      expect(res.encoding).toBe('TIS-620 / Windows-874');
      expect(res.confidence).toBeGreaterThanOrEqual(90);
    });

    it('should detect UTF-8 when Thai Unicode characters are present in text', () => {
      const text = 'บันทึกข้อมูลการผลิตสถานีที่ 4';
      const res = detectEncoding(undefined, text);
      expect(res.encoding).toBe('UTF-8');
    });
  });

  describe('Language & Script Detection', () => {
    it('should detect Thai language text', () => {
      const languages = detectLanguages('เครื่องวัดอุณหภูมิ LINE-04: 25.4 C');
      expect(languages).toContain('Thai');
      expect(languages).toContain('English');
    });

    it('should detect English text', () => {
      const languages = detectLanguages('TRANSACTION_ID,AMOUNT,STATUS');
      expect(languages).toContain('English');
      expect(languages).not.toContain('Thai');
    });

    it('should detect CJK characters', () => {
      const languages = detectLanguages('製品コード: 99401');
      expect(languages).toContain('CJK');
    });
  });

  describe('Delimiter Detection', () => {
    it('should detect comma delimiter', () => {
      const lines = [
        'id,name,department,salary',
        '1001,John Doe,Engineering,85000',
        '1002,Jane Smith,Design,78000'
      ];
      const res = detectDelimiter(lines);
      expect(res.delimiter).toBe(',');
      expect(res.delimiterName).toBe('Comma (,)');
    });

    it('should detect pipe delimiter', () => {
      const lines = [
        '2026-09-25 | SENSOR_01 | 24.5 | STATUS_OK',
        '2026-09-25 | SENSOR_02 | 26.1 | STATUS_WARN',
        '2026-09-25 | SENSOR_03 | 24.8 | STATUS_OK'
      ];
      const res = detectDelimiter(lines);
      expect(res.delimiter).toBe('|');
      expect(res.delimiterName).toBe('Pipe (|)');
    });

    it('should detect tab delimiter', () => {
      const lines = [
        'col1\tcol2\tcol3',
        'val1\tval2\tval3',
        'val4\tval5\tval6'
      ];
      const res = detectDelimiter(lines);
      expect(res.delimiter).toBe('\t');
      expect(res.delimiterName).toBe('Tab (\\t)');
    });

    it('should detect bracketed log formatting', () => {
      const lines = [
        '[2026-09-25 10:15:00] [INFO] System initialized',
        '[2026-09-25 10:15:01] [DEBUG] Worker thread spawned'
      ];
      const res = detectDelimiter(lines);
      expect(res.delimiterName).toBe('Bracketed Space / Log');
    });
  });

  describe('File Lock & Concurrency Detection', () => {
    it('should detect clean state when no locks exist', () => {
      const files: DiscoveredFolderFile[] = [
        { name: 'log1.txt', size: 1024, lastModified: Date.now() - 3600000 }
      ];
      const res = detectFileLock(files, 'static_batch_dump');
      expect(res.fileLockStatus).toBe('no_lock_detected');
    });

    it('should flag active lock conflict when file has lockReason', () => {
      const files: DiscoveredFolderFile[] = [
        {
          name: 'active_stream.log',
          size: 2048,
          lastModified: Date.now(),
          isLocked: true,
          lockReason: 'EBUSY: resource locked by PLC service'
        }
      ];
      const res = detectFileLock(files, 'high_frequency_stream');
      expect(res.fileLockStatus).toBe('file_in_use_error');
      expect(res.lockDetails).toContain('active_stream.log');
      expect(res.hasContinuousAppend).toBe(true);
    });

    it('should suspect active stream append when files are modified seconds ago', () => {
      const files: DiscoveredFolderFile[] = [
        { name: 'live_output.csv', size: 4096, lastModified: Date.now() - 2000 }
      ];
      const res = detectFileLock(files, 'high_frequency_stream');
      expect(res.fileLockStatus).toBe('active_lock_suspected');
      expect(res.hasContinuousAppend).toBe(true);
    });
  });

  describe('Workspace Profile Bundle Generation & Validation', () => {
    const mockFiles: DiscoveredFolderFile[] = [
      {
        name: 'sensor_line4_001.log',
        size: 512,
        lastModified: Date.now() - 10000,
        sampleContent: 'timestamp|station|temp_celsius|status\n2026-09-25 10:00:00|STN_04|24.5|RUNNING\n2026-09-25 10:00:02|STN_04|24.6|RUNNING'
      },
      {
        name: 'sensor_line4_002.log',
        size: 530,
        lastModified: Date.now() - 5000,
        sampleContent: 'timestamp|station|temp_celsius|status\n2026-09-25 10:00:04|STN_04|24.8|RUNNING'
      }
    ];

    it('should analyze files and package a complete profile bundle', () => {
      const analysis = analyzeFolderFiles(mockFiles, 'production_line_4');
      expect(analysis.metrics.totalFiles).toBe(2);
      expect(analysis.forensics.delimiter).toBe('|');
      expect(analysis.forensics.dominantExtension).toBe('.txt'); // .log maps to txt format

      const bundle = generateWorkspaceProfileBundle(analysis, '/var/log/production_line_4');
      expect(bundle.$schema).toBe('https://vampio.dev/schema/workspace-profile-v1.json');
      expect(bundle.version).toBe('1.0.0');
      expect(bundle.source.folderName).toBe('production_line_4');
      expect(bundle.source.folderPath).toBe('/var/log/production_line_4');
      expect(bundle.vampioWorkspace.columns.length).toBeGreaterThan(0);

      const jsonStr = exportWorkspaceProfileBundleJson(analysis, '/var/log/production_line_4');
      expect(typeof jsonStr).toBe('string');
      expect(jsonStr).toContain('production_line_4');
      expect(jsonStr).toContain('vampioWorkspace');
    });

    it('should successfully validate and parse an exported bundle', () => {
      const analysis = analyzeFolderFiles(mockFiles, 'test_station');
      const jsonStr = exportWorkspaceProfileBundleJson(analysis);

      const validation = validateAndParseWorkspaceBundle(jsonStr);
      expect(validation.valid).toBe(true);
      expect(validation.bundle).toBeDefined();
      expect(validation.bundle?.source.folderName).toBe('test_station');
      expect(validation.bundle?.vampioWorkspace.columns.length).toBe(analysis.suggestedTemplate.columns.length);
    });

    it('should reject invalid or corrupt JSON bundles', () => {
      const malformed = '{"not": "a real bundle"}';
      const validation = validateAndParseWorkspaceBundle(malformed);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Missing vampioWorkspace');

      const brokenSyntax = '{bad json:';
      const syntaxVal = validateAndParseWorkspaceBundle(brokenSyntax);
      expect(syntaxVal.valid).toBe(false);
      expect(syntaxVal.error).toContain('JSON Parse error');
    });
  });
});
