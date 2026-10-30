/**
 * Standard typed error hierarchy for Web-to-Figma extension.
 * Provides stable error codes, user-facing descriptions, and recoverable indicators.
 */

export type ExtensionErrorCode =
  | 'UNKNOWN_ERROR'
  | 'PERMISSION_DENIED'
  | 'RESTRICTED_URL'
  | 'SCRIPT_INJECTION_FAILED'
  | 'PORT_DISCONNECTED'
  | 'JOB_TIMEOUT'
  | 'WORKER_RESTARTED'
  | 'INVALID_MESSAGE_PAYLOAD'
  | 'JOB_NOT_FOUND'
  | 'ACTIVE_TAB_UNAVAILABLE';

export interface SerializedExtensionError {
  code: ExtensionErrorCode;
  message: string;
  recoverable: boolean;
  details?: unknown;
}

export class ExtensionError extends Error {
  readonly code: ExtensionErrorCode;
  readonly recoverable: boolean;
  readonly details?: unknown;

  constructor(
    message: string,
    code: ExtensionErrorCode = 'UNKNOWN_ERROR',
    recoverable = false,
    details?: unknown
  ) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.recoverable = recoverable;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SerializedExtensionError {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      details: this.details
    };
  }
}

export class PermissionDeniedError extends ExtensionError {
  constructor(origin: string, reason?: string) {
    super(
      `Permission denied for origin "${origin}". ${reason ?? 'User declined the permission request.'}`,
      'PERMISSION_DENIED',
      true,
      { origin }
    );
    this.name = 'PermissionDeniedError';
  }
}

export class RestrictedUrlError extends ExtensionError {
  constructor(url: string) {
    super(
      `Cannot capture restricted URL "${url}". Browser system pages, Web Store, and PDF viewer pages cannot be injected.`,
      'RESTRICTED_URL',
      false,
      { url }
    );
    this.name = 'RestrictedUrlError';
  }
}

export class ScriptInjectionError extends ExtensionError {
  constructor(tabId: number, details?: string) {
    super(
      `Failed to inject content script into tab ${tabId}.${details ? ` Details: ${details}` : ''}`,
      'SCRIPT_INJECTION_FAILED',
      true,
      { tabId }
    );
    this.name = 'ScriptInjectionError';
  }
}

export class PortDisconnectedError extends ExtensionError {
  constructor(portName: string, reason?: string) {
    super(
      `Port "${portName}" disconnected unexpectedly.${reason ? ` Reason: ${reason}` : ''}`,
      'PORT_DISCONNECTED',
      true,
      { portName }
    );
    this.name = 'PortDisconnectedError';
  }
}

export class JobTimeoutError extends ExtensionError {
  constructor(jobId: string, durationMs: number) {
    super(
      `Capture job ${jobId} timed out after ${durationMs}ms.`,
      'JOB_TIMEOUT',
      true,
      { jobId, durationMs }
    );
    this.name = 'JobTimeoutError';
  }
}

export class WorkerRestartError extends ExtensionError {
  constructor(jobId: string) {
    super(
      `Background worker suspended or restarted during job ${jobId}. Resuming from durable state.`,
      'WORKER_RESTARTED',
      true,
      { jobId }
    );
    this.name = 'WorkerRestartError';
  }
}

export class InvalidPayloadError extends ExtensionError {
  constructor(message: string, details?: unknown) {
    super(
      `Invalid message payload: ${message}`,
      'INVALID_MESSAGE_PAYLOAD',
      false,
      details
    );
    this.name = 'InvalidPayloadError';
  }
}

/**
 * Converts any caught error into a serialized typed extension error object.
 */
export function serializeError(err: unknown): SerializedExtensionError {
  if (err instanceof ExtensionError) {
    return err.toJSON();
  }
  if (err instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: err.message,
      recoverable: false,
      details: { stack: err.stack }
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: String(err),
    recoverable: false
  };
}

/**
 * Re-hydrates a serialized error object into an ExtensionError instance.
 */
export function deserializeError(serialized: SerializedExtensionError): ExtensionError {
  return new ExtensionError(
    serialized.message,
    serialized.code,
    serialized.recoverable,
    serialized.details
  );
}
