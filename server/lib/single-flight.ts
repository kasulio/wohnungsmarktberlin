/**
 * Single-flight execution helpers to prevent overlapping scheduled task ticks
 * and concurrent notification sweeps.
 */

export type SkipResult<T> = { skipped: true } | { skipped: false; value: T };

/**
 * Runs `fn` exclusively. If another invocation is already running, returns
 * `{ skipped: true }` immediately without starting a second run.
 */
export function createSkipIfRunning<T>() {
  let running = false;

  return {
    isRunning: () => running,
    run: async (fn: () => Promise<T>): Promise<SkipResult<T>> => {
      if (running) return { skipped: true };
      running = true;
      try {
        const value = await fn();
        return { skipped: false, value };
      } finally {
        running = false;
      }
    },
  };
}

/**
 * Ensures at most one execution of `fn` runs at a time. Callers arriving while
 * a run is in-flight share it, and if `rerunWhenKicked` is true, one follow-up
 * pass is scheduled immediately after the current pass finishes so new work
 * arriving mid-flight is not delayed until the next cron tick.
 */
export function createCoalescedRunner<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  options: { rerunWhenKicked?: boolean } = {},
) {
  let inFlight: Promise<T> | null = null;
  let pendingArgs: Args | null = null;

  const start = (...args: Args): Promise<T> => {
    const run = fn(...args).finally(() => {
      if (options.rerunWhenKicked && pendingArgs !== null) {
        const nextArgs = pendingArgs;
        pendingArgs = null;
        inFlight = start(...nextArgs);
      } else {
        inFlight = null;
      }
    });
    return run;
  };

  return (...args: Args): Promise<T> => {
    if (inFlight) {
      if (options.rerunWhenKicked) pendingArgs = args;
      return inFlight;
    }
    inFlight = start(...args);
    return inFlight;
  };
}
