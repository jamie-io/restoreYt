import { createAbortError } from './errors.js';

export interface RequestQueueOptions {
  concurrency?: number;
}

type RequestTask<Value> = (signal: AbortSignal) => Value | PromiseLike<Value>;

interface QueueEntry<Value> {
  task: RequestTask<Value>;
  signal: AbortSignal;
  resolve: (value: Value | PromiseLike<Value>) => void;
  reject: (reason: unknown) => void;
  started: boolean;
  onAbort: () => void;
}

export interface RequestQueue {
  run<Value>(task: RequestTask<Value>, signal?: AbortSignal): Promise<Value>;
}

export function createRequestQueue(options: RequestQueueOptions = {}): RequestQueue {
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('concurrency must be a positive integer');

  let active = 0;
  const pending: QueueEntry<unknown>[] = [];

  const pump = (): void => {
    while (active < concurrency && pending.length > 0) {
      const entry = pending.shift();
      if (!entry) return;
      entry.started = true;
      entry.signal.removeEventListener('abort', entry.onAbort);
      if (entry.signal.aborted) {
        entry.reject(createAbortError());
        continue;
      }

      active += 1;
      Promise.resolve()
        .then(() => {
          if (entry.signal.aborted) throw createAbortError();
          return entry.task(entry.signal);
        })
        .then(entry.resolve, entry.reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };

  return {
    run<Value>(task: RequestTask<Value>, signal?: AbortSignal): Promise<Value> {
      const taskSignal = signal ?? new AbortController().signal;
      if (taskSignal.aborted) return Promise.reject(createAbortError());

      return new Promise<Value>((resolve, reject) => {
        const entry: QueueEntry<Value> = {
          task,
          signal: taskSignal,
          resolve,
          reject,
          started: false,
          onAbort: () => {
            if (entry.started) return;
            const index = pending.indexOf(entry as QueueEntry<unknown>);
            if (index < 0) return;
            pending.splice(index, 1);
            taskSignal.removeEventListener('abort', entry.onAbort);
            reject(createAbortError());
          },
        };
        pending.push(entry as QueueEntry<unknown>);
        taskSignal.addEventListener('abort', entry.onAbort, { once: true });
        pump();
      });
    },
  };
}
