import { describe, expect, it } from 'vitest';
import { createSerialScanner, diffFolderSnapshots, monitorSourceKind, resolveSchemaSource } from '../utils/folderMonitorState';
import type { DiscoveredFolderFile } from '../utils/folderBehaviorAnalyzer';

const file = (name: string, size = 10, extra: Partial<DiscoveredFolderFile> = {}): DiscoveredFolderFile => ({ name, size, lastModified: 1000, ...extra });

describe('folder monitor snapshots', () => {
  it('reports every addition, removal, growth, truncation and same-size modification', () => {
    const before = [file('gone'), file('grow'), file('shrink'), file('edit')];
    const after = [file('new'), file('grow', 20), file('shrink', 5), file('edit', 10, { lastModified: 2000 })];
    expect(diffFolderSnapshots(before, after).map(change => change.type)).toEqual(['file_added', 'file_grown', 'file_truncated', 'file_modified', 'file_removed']);
  });
  it('distinguishes identical filenames using relative paths', () => {
    const before = [file('log.txt', 10, { relativePath: 'one/log.txt' }), file('log.txt', 10, { relativePath: 'two/log.txt' })];
    expect(diffFolderSnapshots(before, [before[0]])).toEqual([{ type: 'file_removed', message: 'File removed: two/log.txt' }]);
  });
  it('reports read failures and recovery without inventing truncations or growth from placeholders', () => {
    const readable = file('log.txt');
    const failed = file('log.txt', 0, { isLocked: true, lockReason: 'Permission denied' });
    expect(diffFolderSnapshots([readable], [failed]).map(change => change.type)).toEqual(['access_changed']);
    expect(diffFolderSnapshots([failed], [readable]).map(change => change.type)).toEqual(['access_changed']);
    expect(diffFolderSnapshots([failed], [failed])).toEqual([]);
    const denied = file('log.txt', 0, { readStatus: 'read_error', readError: 'Permission denied', isLocked: false });
    expect(diffFolderSnapshots([readable], [denied]).map(change => change.type)).toEqual(['access_changed']);
  });
  it('detects sampled content replacement even if size and timestamp are unchanged', () => {
    expect(diffFolderSnapshots([file('log', 10, { sampleContent: 'old' })], [file('log', 10, { sampleContent: 'new' })])[0].type).toBe('file_modified');
  });
  it('normalizes schema selection to a path and clears removed sources', () => {
    const files = [file('one.csv', 10, { relativePath: 'folder/one.csv' }), file('two.csv')];
    expect(resolveSchemaSource(files, 'one.csv')).toBe('folder/one.csv');
    expect(resolveSchemaSource(files, 'folder/one.csv')).toBe('folder/one.csv');
    expect(resolveSchemaSource([files[1]], 'folder/one.csv')).toBeNull();
    expect(resolveSchemaSource(files, null)).toBeNull();
  });
  it('handles stable empty sources and explicitly marks uploaded files as snapshots', () => {
    expect(diffFolderSnapshots([], [])).toEqual([]);
    expect(monitorSourceKind({ kind: 'virtual-dir', files: [] })).toBe('snapshot');
    expect(monitorSourceKind({ kind: 'tauri-dir' })).toBe('directory');
    expect(monitorSourceKind(null)).toBe('none');
  });
});

describe('serial scanner', () => {
  it('waits for the previous source read and skips canceled queued scans', async () => {
    const scan = createSerialScanner();
    let release!: (value: string) => void;
    const order: string[] = [];
    const old = scan(() => true, () => { order.push('old'); return new Promise<string>(resolve => { release = resolve; }); });
    let current = true;
    const canceled = scan(() => current, async () => { order.push('canceled'); return 'canceled'; });
    const next = scan(() => true, async () => { order.push('new'); return 'new'; });
    await Promise.resolve();
    expect(order).toEqual(['old']);
    current = false;
    release('old');
    expect(await old).toBe('old');
    expect(await canceled).toBeUndefined();
    expect(await next).toBe('new');
    expect(order).toEqual(['old', 'new']);
  });
  it('recovers the queue after a read error', async () => {
    const scan = createSerialScanner();
    await expect(scan(() => true, async () => { throw new Error('denied'); })).rejects.toThrow('denied');
    await expect(scan(() => true, async () => [])).resolves.toEqual([]);
  });
});
