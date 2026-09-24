export interface NavigationEpoch {
  readonly signal: AbortSignal;
  readonly value: number;
  advance(): number;
}

export function createNavigationEpoch(): NavigationEpoch {
  let value = 0;
  let controller = new AbortController();

  return {
    get signal() {
      return controller.signal;
    },
    get value() {
      return value;
    },
    advance() {
      controller.abort();
      controller = new AbortController();
      value += 1;
      return value;
    },
  };
}
