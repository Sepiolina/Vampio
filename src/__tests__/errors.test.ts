import { describe, it, expect } from 'vitest';
import {
  AppError,
  FileSystemError,
  GeneratorError,
  ApiPrefetchError,
  ValidationError,
  ok,
  err,
  tryCatchAsync,
  tryCatchSync,
} from '../utils/errors';

describe('Typed Error Boundaries & Result Envelopes', () => {
  it('creates AppError and domain-specific subclasses correctly', () => {
    const fsErr = new FileSystemError('Permission denied', 'FS_PERM_DENIED');
    expect(fsErr.domain).toBe('file_system');
    expect(fsErr.code).toBe('FS_PERM_DENIED');
    expect(fsErr.message).toBe('Permission denied');
    expect(fsErr.recoverable).toBe(true);
    expect(fsErr instanceof AppError).toBe(true);

    const genErr = new GeneratorError('Invalid rule syntax', 'GEN_SYNTAX');
    expect(genErr.domain).toBe('generator');
    expect(genErr.code).toBe('GEN_SYNTAX');

    const apiErr = new ApiPrefetchError('Rate limit exceeded', 'RATE_LIMIT', 429);
    expect(apiErr.domain).toBe('api_prefetch');
    expect(apiErr.status).toBe(429);

    const valErr = new ValidationError('Columns cannot be empty', 'columns');
    expect(valErr.domain).toBe('validation');
    expect(valErr.field).toBe('columns');
  });

  it('handles functional ok and err Result structures', () => {
    const successResult = ok({ rows: 100 });
    expect(successResult.success).toBe(true);
    if (successResult.success) {
      expect(successResult.data.rows).toBe(100);
    }

    const failureResult = err(new GeneratorError('Out of bounds'));
    expect(failureResult.success).toBe(false);
    if (!failureResult.success) {
      expect(failureResult.error.message).toBe('Out of bounds');
    }
  });

  it('safely wraps synchronous exceptions with tryCatchSync', () => {
    const success = tryCatchSync(() => 42 * 2);
    expect(success.success).toBe(true);
    if (success.success) {
      expect(success.data).toBe(84);
    }

    const failure = tryCatchSync(() => {
      throw new Error('Boom');
    }, 'CALC_FAILED', 'generator');

    expect(failure.success).toBe(false);
    if (!failure.success) {
      expect(failure.error.code).toBe('CALC_FAILED');
      expect(failure.error.domain).toBe('generator');
    }
  });

  it('safely wraps asynchronous exceptions with tryCatchAsync', async () => {
    const success = await tryCatchAsync(async () => 'resolved data');
    expect(success.success).toBe(true);
    if (success.success) {
      expect(success.data).toBe('resolved data');
    }

    const failure = await tryCatchAsync(async () => {
      throw new Error('Network timeout');
    }, 'FETCH_TIMEOUT', 'api_prefetch');

    expect(failure.success).toBe(false);
    if (!failure.success) {
      expect(failure.error.code).toBe('FETCH_TIMEOUT');
      expect(failure.error.domain).toBe('api_prefetch');
    }
  });
});
