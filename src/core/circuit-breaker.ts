export interface CircuitBreakerOptions {
  failureThreshold?: number;
}

export interface FeatureState {
  failures: number;
  consecutiveFailures: number;
  disabled: boolean;
  lastFailure: string | null;
}

export interface FeatureCircuitBreaker {
  run<Value>(feature: string, operation: () => Value | PromiseLike<Value>): Promise<Value>;
  getState(feature: string): FeatureState;
  reset(feature: string): void;
}

function createCircuitOpenError(feature: string): Error {
  const error = new Error(`Feature circuit is open: ${feature}`);
  error.name = 'CircuitOpenError';
  return error;
}

export function createFeatureCircuitBreaker(options: CircuitBreakerOptions = {}): FeatureCircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 3;
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1) {
    throw new RangeError('failureThreshold must be a positive integer');
  }

  const states = new Map<string, FeatureState>();
  const stateFor = (feature: string): FeatureState => {
    let state = states.get(feature);
    if (!state) {
      state = { failures: 0, consecutiveFailures: 0, disabled: false, lastFailure: null };
      states.set(feature, state);
    }
    return state;
  };

  return {
    async run<Value>(feature: string, operation: () => Value | PromiseLike<Value>): Promise<Value> {
      const state = stateFor(feature);
      if (state.disabled) throw createCircuitOpenError(feature);
      try {
        const result = await operation();
        state.consecutiveFailures = 0;
        state.lastFailure = null;
        return result;
      } catch (error) {
        state.failures += 1;
        state.consecutiveFailures += 1;
        state.lastFailure = error instanceof Error ? error.message : String(error);
        state.disabled = state.consecutiveFailures >= failureThreshold;
        throw error;
      }
    },
    getState(feature) {
      return { ...stateFor(feature) };
    },
    reset(feature) {
      states.set(feature, { failures: 0, consecutiveFailures: 0, disabled: false, lastFailure: null });
    },
  };
}
