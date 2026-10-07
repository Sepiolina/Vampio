import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTauri,
  isEmbeddedIframe,
  isFileSystemAccessSupported,
  createVirtualDirectoryHandle,
  writeBatchToDirectory,
  writeMultipleFilesToDirectory,
  createStreamFileWriter,
  createMultiFileStreamWriter,
} from '../utils/fileSystem';
import * as exportUtils from '../utils/export';

describe('Directory Selection & File System Access Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {
      self: {},
      top: {},
    };
    (globalThis as any).window.self = (globalThis as any).window;
    (globalThis as any).window.top = (globalThis as any).window;
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('detects Tauri environment accurately via __TAURI_INTERNALS__, __TAURI__, or isTauri', () => {
    // Default mock environment (non-Tauri)
    expect(isTauri()).toBe(false);

    // With __TAURI_INTERNALS__
    (globalThis as any).window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
    expect(isTauri()).toBe(true);

    delete (globalThis as any).window.__TAURI_INTERNALS__;
    (globalThis as any).window.__TAURI__ = {};
    expect(isTauri()).toBe(true);

    delete (globalThis as any).window.__TAURI__;
    (globalThis as any).window.isTauri = true;
    expect(isTauri()).toBe(true);
  });

  it('detects embedded iframes correctly', () => {
    // When window.self !== window.top
    const fakeTop = {};
    const fakeSelf = {};
    (globalThis as any).window.self = fakeSelf;
    (globalThis as any).window.top = fakeTop;

    expect(isEmbeddedIframe()).toBe(true);

    // When window.self === window.top
    (globalThis as any).window.top = fakeSelf;
    expect(isEmbeddedIframe()).toBe(false);
  });

  it('evaluates isFileSystemAccessSupported correctly in desktop, iframe, and browser', () => {
    const fakeSelf = {};
    (globalThis as any).window.self = fakeSelf;
    (globalThis as any).window.top = fakeSelf;

    // In desktop (Tauri)
    (globalThis as any).window.__TAURI_INTERNALS__ = {};
    expect(isFileSystemAccessSupported()).toBe(true);

    // In browser with showDirectoryPicker
    delete (globalThis as any).window.__TAURI_INTERNALS__;
    (globalThis as any).window.showDirectoryPicker = vi.fn();
    expect(isFileSystemAccessSupported()).toBe(true);

    // In browser inside an iframe (even if showDirectoryPicker exists)
    (globalThis as any).window.top = {}; // different from self
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it('creates clean Virtual Directory handles', () => {
    const handle = createVirtualDirectoryHandle('my_exports_folder');
    expect(handle.kind).toBe('virtual-dir');
    expect(handle.name).toBe('my_exports_folder');
    expect(handle.path).toBe('my_exports_folder');

    // Strips leading slashes
    const handle2 = createVirtualDirectoryHandle('//clean_name//');
    expect(handle2.name).toBe('clean_name//');
  });

  it('writes batches to virtual directory by downloading file', async () => {
    const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});
    const virtualHandle = createVirtualDirectoryHandle('test_folder');

    const result = await writeBatchToDirectory(virtualHandle, 'dataset.csv', 'id,name\n1,alice');
    expect(result.filename).toBe('dataset.csv');
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(downloadSpy).toHaveBeenCalledWith(expect.any(Blob), 'dataset.csv', 'text/csv');
  });

  it('bundles multi-file writes into a single ZIP archive for virtual directory', async () => {
    const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});
    const zipSpy = vi.spyOn(exportUtils, 'createZipArchive').mockResolvedValue(new Blob(['mock-zip']));

    const virtualHandle = createVirtualDirectoryHandle('batch_folder');
    const files = [
      { filename: 'file_001.json', content: '{"id": 1}' },
      { filename: 'file_002.json', content: '{"id": 2}' },
    ];

    const result = await writeMultipleFilesToDirectory(virtualHandle, files);
    expect(result.fileCount).toBe(2);
    expect(zipSpy).toHaveBeenCalled();
    expect(downloadSpy).toHaveBeenCalledWith(expect.any(Blob), 'batch_folder_bundle.zip', 'application/zip');
  });

  it('supports stream file writing to virtual directories without throwing', async () => {
    const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});
    const virtualHandle = createVirtualDirectoryHandle('stream_virtual');

    const writer = await createStreamFileWriter(
      virtualHandle,
      'stream_data.csv',
      [{ id: '1', name: 'user_id', type: 'Int', rule: '', skip_pct: 0, condition: '' }],
      'csv',
      'users'
    );

    await writer.writeRow({ user_id: 101 }, 0);
    await writer.writeRow({ user_id: 102 }, 1);
    await writer.flush();
    await writer.close();

    expect(downloadSpy).toHaveBeenCalledWith(expect.any(Blob), 'stream_data.csv', 'text/csv');
  });

  it('supports multi-file stream writer for virtual directories, downloading ZIP on close', async () => {
    const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {});
    vi.spyOn(exportUtils, 'createZipArchive').mockResolvedValue(new Blob(['mock-zip-stream']));
    const virtualHandle = createVirtualDirectoryHandle('multi_stream_folder');

    const writer = await createMultiFileStreamWriter(
      virtualHandle,
      'data_{index}.json',
      [{ id: '1', name: 'val', type: 'Int', rule: '', skip_pct: 0, condition: '' }],
      'json',
      1,
      'items'
    );

    await writer.writeRow({ val: 1 });
    await writer.writeRow({ val: 2 });
    await writer.close();

    expect(writer.getFilesCount()).toBe(2);
    expect(downloadSpy).toHaveBeenCalledWith(expect.any(Blob), 'multi_stream_folder_bundle.zip', 'application/zip');
  });
});
