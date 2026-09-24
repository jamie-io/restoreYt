export function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

export function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`Operation timed out after ${timeoutMs}ms`);
  error.name = 'TimeoutError';
  return error;
}
