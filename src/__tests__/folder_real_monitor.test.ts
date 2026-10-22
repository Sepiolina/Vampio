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

  it('prioritizes real extracted columns over presets even if folder name contains "log"', () => {
    const csvContent = 'Time,Work_Count,Model,Operator,Status\n2026-10-12 11:07:37,42,X200,OpA,PASS\n';
    const files: DiscoveredFolderFile[] = [
      {
        name: 'vampio_suite_data_20261012_110737.csv',
        size: csvContent.length,
        lastModified: Date.now(),
        sampleContent: csvContent,
      },
    ];

    const analysis = analyzeFolderFiles(files, 'Carrier log');
    expect(analysis.extractedColumns).toHaveLength(5);
    expect(analysis.extractedColumns.map((c) => c.name)).toEqual([
      'Time',
      'Work_Count',
      'Model',
      'Operator',
      'Status',
    ]);
    expect(analysis.suggestedTemplate.type).toBe('custom_extracted');
    expect(analysis.suggestedTemplate.presetName).toContain('vampio_suite_data');
    expect(analysis.suggestedTemplate.presetName).not.toContain('Web Server Access Logs');
    expect(analysis.suggestedTemplate.columns.map((c) => c.name)).toEqual([
      'Time',
      'Work_Count',
      'Model',
      'Operator',
      'Status',
    ]);
  });

  it('deduplicates repetitive CSV column headers and guarantees unique column IDs', () => {
    const csvWithDups = 'Wait,SYSTEM_STOP,Wait,Measurement_Select_Switch,SYSTEM_STOP,Check_RY30_3_OFF\n1,0,2,1,0,1\n';
    const files: DiscoveredFolderFile[] = [
      {
        name: 'test_sequence.csv',
        size: csvWithDups.length,
        lastModified: Date.now(),
        sampleContent: csvWithDups,
      },
    ];

    const analysis = analyzeFolderFiles(files, 'test_bench');
    const colNames = analysis.suggestedTemplate.columns.map((c) => c.name);
    expect(colNames).toEqual([
      'Wait',
      'SYSTEM_STOP',
      'Wait_1',
      'Measurement_Select_Switch',
      'SYSTEM_STOP_1',
      'Check_RY30_3_OFF',
    ]);
    const ids = analysis.suggestedTemplate.columns.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('preserves existing workspace columns if monitored folder has no structured files', () => {
    const existingCols = [
      { id: 'c1', name: 'Serial_Num', type: 'Sequence' as const, rule: '100', skip_pct: 0, condition: '' },
      { id: 'c2', name: 'Pressure_Bar', type: 'Float' as const, rule: '1.0, 5.0', skip_pct: 0, condition: '' },
    ];
    const emptyFiles: DiscoveredFolderFile[] = [];
    const analysis = analyzeFolderFiles(emptyFiles, 'empty_target', existingCols);
    expect(analysis.suggestedTemplate.type).toBe('custom_extracted');
    expect(analysis.suggestedTemplate.presetName).toBe('Current Active Workspace Columns');
    expect(analysis.suggestedTemplate.columns).toEqual(existingCols);
  });
});
