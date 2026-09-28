import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultWorkspace,
  loadAllWorkspaces,
  saveWorkspaceToStorage,
  deleteWorkspaceFromStorage,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  exportWorkspacesAsJson,
  getRandomColorTag,
  DEFAULT_SETTINGS
} from '../utils/workspaceStorage';
import { WorkspaceSession } from '../types';

class LocalStorageMock {
  private store: Record<string, string> = {};
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new LocalStorageMock();
}

describe('Multi-Project Workspace Storage & Session Manager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should generate a valid default workspace session', () => {
    const ws = createDefaultWorkspace({ name: 'Alpha Project' });
    expect(ws.name).toBe('Alpha Project');
    expect(ws.id).toMatch(/^ws_/);
    expect(ws.columns).toBeInstanceOf(Array);
    expect(ws.columns.length).toBe(0);
    expect(ws.format).toBe('csv');
    expect(ws.isDirty).toBe(false);
    expect(ws.colorTag).toBeDefined();
  });

  it('should save and load workspaces from storage', async () => {
    const ws1 = createDefaultWorkspace({
      name: 'Project 1 - Telemetry',
      tableName: 'sensor_data',
      format: 'json',
      columns: [
        { id: 'c1', name: 'temp', type: 'Float', rule: '{"min":20,"max":35}', skip_pct: 0, condition: '' }
      ]
    });

    const ws2 = createDefaultWorkspace({
      name: 'Project 2 - User Orders',
      tableName: 'orders',
      format: 'csv',
      columns: [
        { id: 'c2', name: 'order_id', type: 'UUID', rule: '', skip_pct: 0, condition: '' }
      ]
    });

    await saveWorkspaceToStorage(ws1);
    await saveWorkspaceToStorage(ws2);

    const loaded = await loadAllWorkspaces();
    expect(loaded.length).toBeGreaterThanOrEqual(2);

    const found1 = loaded.find((w) => w.id === ws1.id);
    expect(found1).toBeDefined();
    expect(found1?.tableName).toBe('sensor_data');
    expect(found1?.columns[0].name).toBe('temp');

    const found2 = loaded.find((w) => w.id === ws2.id);
    expect(found2).toBeDefined();
    expect(found2?.tableName).toBe('orders');
    expect(found2?.columns[0].name).toBe('order_id');
  });

  it('should delete a workspace from storage', async () => {
    const ws = createDefaultWorkspace({ name: 'Disposable Project' });
    await saveWorkspaceToStorage(ws);

    let loaded = await loadAllWorkspaces();
    expect(loaded.some((w) => w.id === ws.id)).toBe(true);

    await deleteWorkspaceFromStorage(ws.id);
    loaded = await loadAllWorkspaces();
    expect(loaded.some((w) => w.id === ws.id)).toBe(false);
  });

  it('should persist and load workspace settings (save policy & layout mode)', async () => {
    const initialSettings = await loadWorkspaceSettings();
    expect(initialSettings.savePolicy).toBe('auto');
    expect(initialSettings.displayMode).toBe('top-bar');

    await saveWorkspaceSettings({
      savePolicy: 'prompt',
      displayMode: 'sidebar',
      autoSaveDelayMs: 500,
    });

    const updated = await loadWorkspaceSettings();
    expect(updated.savePolicy).toBe('prompt');
    expect(updated.displayMode).toBe('sidebar');
    expect(updated.autoSaveDelayMs).toBe(500);
  });

  it('should export all workspaces as valid JSON bundle', () => {
    const workspaces: WorkspaceSession[] = [
      createDefaultWorkspace({ name: 'Project A', tableName: 'table_a' }),
      createDefaultWorkspace({ name: 'Project B', tableName: 'table_b' }),
    ];

    const jsonStr = exportWorkspacesAsJson(workspaces);
    expect(jsonStr).toBeTypeOf('string');

    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe('1.0');
    expect(parsed.totalWorkspaces).toBe(2);
    expect(parsed.workspaces[0].name).toBe('Project A');
    expect(parsed.workspaces[1].name).toBe('Project B');
  });

  it('should assign valid rotating color tags', () => {
    const tag1 = getRandomColorTag(0);
    const tag2 = getRandomColorTag(1);
    expect(tag1).toBe('emerald');
    expect(tag2).toBe('indigo');
  });
});
