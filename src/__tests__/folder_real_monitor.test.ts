import { describe, it, expect } from 'vitest';
import {
  analyzeFolderFiles,
  readFilesFromHtmlFileList,
  DiscoveredFolderFile,
} from '../utils/folderBehaviorAnalyzer';

describe('Target Folder Real Monitor Engine (Zero Mock / No Simulation)', () => {
  it('reads genuine files from File array and sniffs real schema and content', async () => {
    const csvContent = 'device_id,temperature,humidity,status\nsensor-01,24.5,58.2,OK\nsensor-02,26.1,52.9,OK\n';
    const fakeFile = new File([csvContent], 'sensors_001.csv', {
      type: 'text/csv',
      lastModified: 1700000000000,
    });

    const discovered = await readFilesFromHtmlFileList([fakeFile]);
    expect(discovered).toHaveLength(1);
    expect(discovered[0].name).toBe('sensors_001.csv');
    expect(discovered[0].size).toBe(csvContent.length);
    expect(discovered[0].sampleContent).toContain('sensor-01');

    const analysis = analyzeFolderFiles(discovered, 'iot_production');
    expect(analysis.folderName).toBe('iot_production');
    expect(analysis.metrics.totalFiles).toBe(1);
    expect(analysis.metrics.dominantFormat).toBe('csv');
    expect(analysis.extractedColumns.map((c) => c.name)).toEqual([
      'device_id',
      'temperature',
      'humidity',
      'status',
    ]);
  });

  it('correctly detects partition naming patterns from real filenames', async () => {
    const files: DiscoveredFolderFile[] = [
      { name: 'log_2026_001.jsonl', size: 1024, lastModified: Date.now() - 3000 },
      { name: 'log_2026_002.jsonl', size: 1024, lastModified: Date.now() - 2000 },
      { name: 'log_2026_003.jsonl', size: 1024, lastModified: Date.now() - 1000 },
    ];

    const analysis = analyzeFolderFiles(files, 'logs_folder');
    expect(analysis.metrics.totalFiles).toBe(3);
    expect(analysis.metrics.dominantFormat).toBe('jsonl');
    expect(analysis.suggestedMode.outputStrategy).toBe('multi_file');
    expect(analysis.suggestedMode.format).toBe('jsonl');
  });

  it('handles empty folder cleanly with zero files and no mock injection', () => {
    const emptyFiles: DiscoveredFolderFile[] = [];
    const analysis = analyzeFolderFiles(emptyFiles, 'empty_dir');
    expect(analysis.metrics.totalFiles).toBe(0);
    expect(analysis.metrics.totalSizeBytes).toBe(0);
    expect(analysis.extractedColumns).toHaveLength(0);
  });
});
