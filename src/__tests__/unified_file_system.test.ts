import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pickDirectory,
  pickFiles,
  scanDataTransfer,
  traverseFileSystemEntry,
  createVirtualDirectoryHandle,
  pickDirectoryViaHtmlInput,
  saveFileToDiskOrDownload,
} from '../utils/fileSystem';

// Minimal DOM mock for Node vitest runner
class MockHtmlElement {
  tagName: string;
  type: string = '';
  style: any = {};
  attributes: Record<string, string> = {};
  files: File[] | null = null;
  multiple: boolean = false;
  accept: string = '';
  listeners: Record<string, Array<(e?: any) => void>> = {};
  parentNode: any = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(k: string, v: string) {
    this.attributes[k.toLowerCase()] = v;
  }
  getAttribute(k: string) {
    return this.attributes[k.toLowerCase()];
  }
  hasAttribute(k: string) {
    return k.toLowerCase() in this.attributes;
  }
  addEventListener(event: string, cb: (e?: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  removeEventListener(event: string, cb: (e?: any) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((l) => l !== cb);
    }
  }
  dispatchEvent(event: { type: string }) {
    const list = [...(this.listeners[event.type] || [])];
    for (const cb of list) cb(event);
    return true;
  }
  click() {
    // simulated input click
  }
}

class MockBody {
  children: MockHtmlElement[] = [];

  appendChild(el: MockHtmlElement) {
    el.parentNode = this;
    this.children.push(el);
    return el;
  }

  removeChild(el: MockHtmlElement) {
    el.parentNode = null;
    this.children = this.children.filter((c) => c !== el);
    return el;
  }
}

describe('Unified Single Source of Truth for File & Folder Selection (DRY Mandate)', () => {
  let mockBody: MockBody;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockBody = new MockBody();

    const mockDocument = {
      body: mockBody,
      createElement: (tag: string) => new MockHtmlElement(tag),
      querySelector: (selector: string) => {
        if (selector.includes(':not([webkitdirectory])')) {
          return mockBody.children.find((c) => !c.hasAttribute('webkitdirectory')) || null;
        }
        if (selector.includes('webkitdirectory')) {
          return mockBody.children.find((c) => c.hasAttribute('webkitdirectory')) || null;
        }
        return mockBody.children[0] || null;
      },
    };

    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      self: {},
      top: {},
    };
    (mockWindow as any).self = mockWindow;
    (mockWindow as any).top = mockWindow;

    (globalThis as any).document = mockDocument;
    (globalThis as any).window = mockWindow;
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
    vi.restoreAllMocks();
  });

  describe('createVirtualDirectoryHandle', () => {
    it('creates virtual directory handles and stores file lists', async () => {
      const mockFile = { name: 'sample.csv', size: 100 } as File;
      const handle = createVirtualDirectoryHandle('invoices', '/path/to/invoices', [mockFile]);

      expect(handle.kind).toBe('virtual-dir');
      expect(handle.name).toBe('invoices');
      expect(handle.path).toBe('/path/to/invoices');
      expect(handle.files).toHaveLength(1);
      expect(handle.files[0].name).toBe('sample.csv');

      const files = await handle.getFiles!();
      expect(files).toHaveLength(1);
    });

    it('sanitizes directory names with leading slashes', () => {
      const handle = createVirtualDirectoryHandle('/output//');
      expect(handle.name).toBe('output//');
    });
  });

  describe('traverseFileSystemEntry & scanDataTransfer', () => {
    it('traverses file entries recursively', async () => {
      const mockFile = { name: 'data.csv', size: 50 } as File;
      const fileEntry = {
        isFile: true,
        isDirectory: false,
        name: 'data.csv',
        file: (cb: (f: File) => void) => cb(mockFile),
      };

      const outFiles: File[] = [];
      await traverseFileSystemEntry(fileEntry, outFiles);
      expect(outFiles).toHaveLength(1);
      expect(outFiles[0].name).toBe('data.csv');
    });

    it('traverses directory entries and nested files recursively', async () => {
      const mockFile1 = { name: 'file1.csv', size: 10 } as File;
      const mockFile2 = { name: 'file2.csv', size: 20 } as File;

      let readCount = 0;
      const dirEntry = {
        isFile: false,
        isDirectory: true,
        name: 'batch_folder',
        createReader: () => ({
          readEntries: (success: (entries: any[]) => void) => {
            if (readCount === 0) {
              readCount++;
              success([
                {
                  isFile: true,
                  isDirectory: false,
                  name: 'file1.csv',
                  file: (cb: (f: File) => void) => cb(mockFile1),
                },
                {
                  isFile: true,
                  isDirectory: false,
                  name: 'file2.csv',
                  file: (cb: (f: File) => void) => cb(mockFile2),
                },
              ]);
            } else {
              success([]);
            }
          },
        }),
      };

      const outFiles: File[] = [];
      await traverseFileSystemEntry(dirEntry, outFiles);
      expect(outFiles).toHaveLength(2);
      expect(outFiles.map((f) => f.name)).toEqual(['file1.csv', 'file2.csv']);
    });

    it('scans DataTransfer containing Chromium getAsFileSystemHandle', async () => {
      const mockHandle = {
        kind: 'directory',
        name: 'direct_chromium_dir',
      };

      const fakeDataTransfer = {
        items: [
          {
            getAsFileSystemHandle: vi.fn().mockResolvedValue(mockHandle),
          },
        ],
        files: [],
      } as unknown as DataTransfer;

      const result = await scanDataTransfer(fakeDataTransfer);
      expect(result.isDirectory).toBe(true);
      expect(result.folderName).toBe('direct_chromium_dir');
      expect(result.directoryHandle).toBe(mockHandle);
    });

    it('scans DataTransfer containing webkitGetAsEntry directory', async () => {
      const mockFile = { name: 'measurements.csv', size: 40 } as File;
      let readCount = 0;
      const fakeDataTransfer = {
        items: [
          {
            kind: 'file',
            webkitGetAsEntry: () => ({
              isFile: false,
              isDirectory: true,
              name: 'telemetry_data',
              createReader: () => ({
                readEntries: (success: (entries: any[]) => void) => {
                  if (readCount === 0) {
                    readCount++;
                    success([
                      {
                        isFile: true,
                        isDirectory: false,
                        name: 'measurements.csv',
                        file: (cb: (f: File) => void) => cb(mockFile),
                      },
                    ]);
                  } else {
                    success([]);
                  }
                },
              }),
            }),
          },
        ],
        files: [],
      } as unknown as DataTransfer;

      const result = await scanDataTransfer(fakeDataTransfer);
      expect(result.isDirectory).toBe(true);
      expect(result.folderName).toBe('telemetry_data');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('measurements.csv');
    });

    it('scans plain file drops without directory structure', async () => {
      const mockFile = { name: 'notes.txt', size: 15 } as File;
      const fakeDataTransfer = {
        items: [],
        files: [mockFile],
      } as unknown as DataTransfer;

      const result = await scanDataTransfer(fakeDataTransfer);
      expect(result.isDirectory).toBe(false);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('notes.txt');
    });
  });

  describe('pickDirectoryViaHtmlInput', () => {
    it('creates ephemeral directory input and captures files on selection', async () => {
      const mockFile = { name: 'file.csv', size: 100, webkitRelativePath: 'my_reports/file.csv' } as any;

      const promise = pickDirectoryViaHtmlInput();

      const input = document.querySelector('input[type="file"][webkitdirectory]') as any;
      expect(input).not.toBeNull();

      input.files = [mockFile];
      input.dispatchEvent({ type: 'change' });

      const result = await promise;
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my_reports');
      expect(result?.isVirtual).toBe(true);
      expect(result?.files).toHaveLength(1);
      expect(result?.handle.kind).toBe('virtual-dir');

      expect(document.querySelector('input[type="file"][webkitdirectory]')).toBeNull();
    });

    it('resolves null when user cancels selection', async () => {
      const promise = pickDirectoryViaHtmlInput();
      const input = document.querySelector('input[type="file"][webkitdirectory]') as any;
      expect(input).not.toBeNull();

      input.dispatchEvent({ type: 'cancel' });

      const result = await promise;
      expect(result).toBeNull();
      expect(document.querySelector('input[type="file"][webkitdirectory]')).toBeNull();
    });
  });

  describe('pickFiles', () => {
    it('creates ephemeral file input and returns selected File array', async () => {
      const mockFile1 = { name: 'one.csv' } as File;
      const mockFile2 = { name: 'two.csv' } as File;

      const promise = pickFiles({ accept: '.csv,.json', multiple: true });

      const input = document.querySelector('input[type="file"]:not([webkitdirectory])') as any;
      expect(input).not.toBeNull();
      expect(input.accept).toBe('.csv,.json');
      expect(input.multiple).toBe(true);

      input.files = [mockFile1, mockFile2];
      input.dispatchEvent({ type: 'change' });

      const files = await promise;
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('one.csv');
      expect(files[1].name).toBe('two.csv');
    });

    it('returns empty array when user cancels file picker', async () => {
      const promise = pickFiles({ accept: '.txt' });
      const input = document.querySelector('input[type="file"]:not([webkitdirectory])') as any;
      expect(input).not.toBeNull();

      input.dispatchEvent({ type: 'cancel' });

      const files = await promise;
      expect(files).toEqual([]);
    });
  });

  describe('pickDirectory fallback integration', () => {
    it('uses fallback HTML directory picker when File System Access API is unavailable or throws', async () => {
      delete (globalThis as any).window.showDirectoryPicker;

      const mockFile = { name: 'sheet.xlsx', webkitRelativePath: 'finance_dept/sheet.xlsx' } as any;

      const promise = pickDirectory({ allowFallback: true });

      const input = document.querySelector('input[type="file"][webkitdirectory]') as any;
      expect(input).not.toBeNull();

      input.files = [mockFile];
      input.dispatchEvent({ type: 'change' });

      const result = await promise;
      expect(result).not.toBeNull();
      expect(result?.name).toBe('finance_dept');
      expect(result?.isVirtual).toBe(true);
    });
  });

  describe('saveFileToDiskOrDownload', () => {
    it('downloads file via browser download in standard web environment', async () => {
      delete (globalThis as any).window.__TAURI_INTERNALS__;
      delete (globalThis as any).window.__TAURI__;
      delete (globalThis as any).window.isTauri;

      const result = await saveFileToDiskOrDownload('test.json', '{"hello":"world"}', 'application/json');
      expect(result.success).toBe(true);
      expect(result.downloaded).toBe(true);
    });

    it('uses native save dialog and writeTextFile in Tauri desktop (.exe) environment', async () => {
      const invokeMock = vi.fn().mockImplementation(async (cmd: string, args: any) => {
        if (cmd === 'plugin:dialog|save') {
          return 'C:\\data\\test.json';
        }
        if (cmd.startsWith('plugin:fs|write')) {
          return undefined;
        }
        return undefined;
      });

      (globalThis as any).window.__TAURI_INTERNALS__ = { invoke: invokeMock };

      const result = await saveFileToDiskOrDownload('test.json', '{"hello":"world"}', 'application/json');
      expect(invokeMock.mock.calls[0][0]).toBe('plugin:dialog|save');
      expect(result.success).toBe(true);
      expect(result.path).toBe('C:\\data\\test.json');

      delete (globalThis as any).window.__TAURI_INTERNALS__;
    });

    it('returns cancelled when user cancels native save dialog in Tauri', async () => {
      const invokeMock = vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd === 'plugin:dialog|save') {
          return null; // user cancelled dialog
        }
        return undefined;
      });

      (globalThis as any).window.__TAURI_INTERNALS__ = { invoke: invokeMock };

      const result = await saveFileToDiskOrDownload('test.json', '{"hello":"world"}', 'application/json');
      expect(invokeMock.mock.calls[0][0]).toBe('plugin:dialog|save');
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);

      delete (globalThis as any).window.__TAURI_INTERNALS__;
    });
  });
});
