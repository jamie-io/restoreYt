export type DiagnosticLevel = 'info' | 'warning' | 'error';

export interface DiagnosticInput {
  feature: string;
  level: DiagnosticLevel;
  message: string;
  details?: unknown;
}

export interface DiagnosticEntry extends DiagnosticInput {
  timestamp: number;
}

export interface DiagnosticsBufferOptions {
  capacity?: number;
  now?: () => number;
}

export interface DiagnosticsBuffer {
  record(input: DiagnosticInput): DiagnosticEntry;
  snapshot(): DiagnosticEntry[];
  clear(): void;
}

export function createDiagnosticsBuffer(options: DiagnosticsBufferOptions = {}): DiagnosticsBuffer {
  const capacity = options.capacity ?? 100;
  const now = options.now ?? Date.now;
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
  const entries: DiagnosticEntry[] = [];

  return {
    record(input) {
      const entry: DiagnosticEntry = { ...input, timestamp: now() };
      entries.push(entry);
      if (entries.length > capacity) entries.splice(0, entries.length - capacity);
      return { ...entry };
    },
    snapshot() {
      return entries.map(entry => ({ ...entry }));
    },
    clear() {
      entries.length = 0;
    },
  };
}
