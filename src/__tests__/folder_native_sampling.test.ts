import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ open: vi.fn(), readDir: vi.fn(), stat: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => native);
import { readFolderFromDirectoryHandle } from '../utils/folderBehaviorAnalyzer';

beforeEach(() => {
  vi.clearAllMocks();
  native.readDir.mockResolvedValue([{ name: 'service.log', isFile: true }, { name: 'other.jsonl', isFile: true }]);
  native.stat.mockResolvedValue({ size: 1_000_000, mtime: new Date(0) });
});

describe('bounded native sampling', () => {
  it('opens read-only, handles short reads, obeys limits and closes the handle', async () => {
    const sizes: number[] = [];
    const close = vi.fn().mockResolvedValue(undefined);
    native.open.mockResolvedValue({ read: vi.fn(async (buffer: Uint8Array) => { sizes.push(buffer.length); const count = Math.min(3, buffer.length); buffer.fill(65, 0, count); return count; }), close });
    const files = await readFolderFromDirectoryHandle({ kind: 'tauri-dir', path: '/logs' }, 8, 1);
    expect(native.open).toHaveBeenCalledExactlyOnceWith('/logs/service.log', { read: true });
    expect(sizes).toEqual([8, 5, 2]);
    expect(files[0].sampledBytes).toBe(8);
    expect(files[0].truncated).toBe(true);
    expect(files[1].readStatus).toBe('skipped');
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the native handle on read error and retains access-error evidence', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    native.open.mockResolvedValue({ read: vi.fn().mockRejectedValue(new Error('Permission denied')), close });
    const [file] = await readFolderFromDirectoryHandle({ kind: 'tauri-dir', path: '/logs' }, 8, 1);
    expect(close).toHaveBeenCalledOnce();
    expect(file.readStatus).toBe('read_error');
    expect(file.readError).toBe('Permission denied');
    expect(file.isLocked).toBe(false);
  });
});
