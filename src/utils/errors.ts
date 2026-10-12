/**
 * Typed Error Boundaries & Result Envelope System
 * Provides predictable, domain-specific errors and functional Result patterns
 * across data generation, file system operations, and remote API calls.
 */

export type ErrorSeverity = 'fatal' | 'warning' | 'info';

export type ErrorDomain = 'file_system' | 'generator' | 'api_prefetch' | 'validation';

export interface AppErrorDetails {
  code: string;
  domain: ErrorDomain;
  message: string;
  cause?: unknown;
  severity?: ErrorSeverity;
  recoverable?: boolean;
}

export class AppError extends Error {
  readonly code: string;
  readonly domain: ErrorDomain;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  override readonly cause?: unknown;

  constructor(details: AppErrorDetails) {
    super(details.message);
    this.name = 'AppError';
    this.code = details.code;
    this.domain = details.domain;
    this.severity = details.severity ?? 'fatal';
    this.recoverable = details.recoverable ?? true;
    this.cause = details.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FileSystemError extends AppError {
  constructor(message: string, code: string = 'FS_ERROR', cause?: unknown, recoverable: boolean = true) {
    super({
      domain: 'file_system',
      code,
      message,
      cause,
      recoverable,
    });
    this.name = 'FileSystemError';
  }
}

export class GeneratorError extends AppError {
  constructor(message: string, code: string = 'GEN_ERROR', cause?: unknown) {
    super({
      domain: 'generator',
      code,
      message,
      cause,
      recoverable: true,
    });
    this.name = 'GeneratorError';
  }
}

export class ApiPrefetchError extends AppError {
  readonly status?: number;

  constructor(message: string, code: string = 'API_PREFETCH_ERROR', status?: number, cause?: unknown) {
    super({
      domain: 'api_prefetch',
      code,
      message,
      cause,
      recoverable: true,
    });
    this.name = 'ApiPrefetchError';
    this.status = status;
  }
}

export class ValidationError extends AppError {
  readonly field?: string;

  constructor(message: string, field?: string, code: string = 'VALIDATION_ERROR') {
    super({
      domain: 'validation',
      code,
      message,
      recoverable: true,
    });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Functional Result type
 */
export type Result<T, E = AppError> =
  | { success: true; data: T; error?: never }
  | { success: false; error: E; data?: never };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Safely executes an async function, wrapping exceptions in a Result envelope.
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  fallbackCode: string = 'UNKNOWN_ERROR',
  domain: ErrorDomain = 'generator'
): Promise<Result<T, AppError>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (caught: unknown) {
    if (caught instanceof AppError) {
      return err(caught);
    }
    const message = caught instanceof Error ? caught.message : String(caught);
    return err(
      new AppError({
        domain,
        code: fallbackCode,
        message,
        cause: caught,
      })
    );
  }
}

/**
 * Safely executes a synchronous function, wrapping exceptions in a Result envelope.
 */
export function tryCatchSync<T>(
  fn: () => T,
  fallbackCode: string = 'UNKNOWN_ERROR',
  domain: ErrorDomain = 'generator'
): Result<T, AppError> {
  try {
    const data = fn();
    return ok(data);
  } catch (caught: unknown) {
    if (caught instanceof AppError) {
      return err(caught);
    }
    const message = caught instanceof Error ? caught.message : String(caught);
    return err(
      new AppError({
        domain,
        code: fallbackCode,
        message,
        cause: caught,
      })
    );
  }
}
