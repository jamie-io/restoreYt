import { createAbortError, createTimeoutError } from './errors.js';

export interface TimeoutOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export const DEFAULT_TIMEOUT_MS = 8_000;

export function withTimeout<Value>(
  operation: (signal: AbortSignal) => Value | PromiseLike<Value>,
  options: TimeoutOptions = {},
): Promise<Value> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) return Promise.reject(new RangeError('timeoutMs must be non-negative'));
  if (options.signal?.aborted) return Promise.reject(createAbortError());

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener = (): void => {};
  const cancellation = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(createTimeoutError(timeoutMs));
    }, timeoutMs);

    if (options.signal) {
      const onAbort = (): void => {
        controller.abort();
        reject(createAbortError());
      };
      options.signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => options.signal?.removeEventListener('abort', onAbort);
    }
  });

  const work = Promise.resolve().then(() => {
    if (controller.signal.aborted) throw createAbortError();
    return operation(controller.signal);
  });
  return Promise.race([work, cancellation]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    removeAbortListener();
  });
}
