import { describe, it, expect, beforeEach } from 'vitest';
import { 
  recordLatencyMetric, 
  getLatencyStats, 
  prefetchRestApiBatch, 
  setCachedApiResponse, 
  serializeRestApiConfig 
} from '../utils/restApiManager';

describe('REST API Latency Metrics & Sparkline History', () => {
  beforeEach(() => {
    setCachedApiResponse('https://dummyjson.com/users?limit=20', {
      users: [{ id: 1, email: 'test@example.com' }]
    });
  });

  it('should record latency metric and compute moving average and history', () => {
    const colId = 'col-latency-1';
    const url = 'https://api.example.com/items';

    recordLatencyMetric({ columnId: colId, url, method: 'GET', latencyMs: 120, success: true });
    let stats = getLatencyStats(colId, url);
    expect(stats).not.toBeNull();
    expect(stats?.lastLatencyMs).toBe(120);
    expect(stats?.avgLatencyMs).toBe(120);
    expect(stats?.history).toEqual([120]);

    recordLatencyMetric({ columnId: colId, url, method: 'GET', latencyMs: 160, success: true });
    stats = getLatencyStats(colId, url);
    expect(stats?.lastLatencyMs).toBe(160);
    expect(stats?.avgLatencyMs).toBe(140); // (120 + 160) / 2
    expect(stats?.history).toEqual([120, 160]);
    expect(stats?.minLatencyMs).toBe(120);
    expect(stats?.maxLatencyMs).toBe(160);
  });

  it('should limit history buffer to 10 samples', () => {
    const colId = 'col-latency-buffer';
    const url = 'https://api.example.com/buffer';

    for (let i = 1; i <= 15; i++) {
      recordLatencyMetric({ columnId: colId, url, method: 'GET', latencyMs: i * 10, success: true });
    }

    const stats = getLatencyStats(colId, url);
    expect(stats?.history.length).toBe(10);
    expect(stats?.history[stats.history.length - 1]).toBe(150);
    expect(stats?.lastLatencyMs).toBe(150);
    expect(stats?.minLatencyMs).toBe(60);
    expect(stats?.maxLatencyMs).toBe(150);
  });

  it('should record latency during prefetchRestApiBatch', async () => {
    const colId = 'col-prefetch-test';
    const rule = serializeRestApiConfig({
      url: 'https://dummyjson.com/users?limit=20',
      method: 'GET',
      jsonPath: 'users[].email',
      retrievalMode: 'pool'
    });

    await prefetchRestApiBatch([{ id: colId, type: 'REST_API', rule }]);
    const stats = getLatencyStats(colId, 'https://dummyjson.com/users?limit=20');
    expect(stats).not.toBeNull();
    expect(stats?.avgLatencyMs).toBeGreaterThanOrEqual(1);
    expect(stats?.history.length).toBeGreaterThanOrEqual(1);
  });
});
