import { AsyncQueuer } from "@tanstack/pacer";

export async function processWithQueue<T, R>(
  items: T[],
  processor: (item: T) => Promise<R> | R,
  options: {
    concurrency?: number;
    wait?: number;
  } = {}
): Promise<{ results: R[]; errors: string[] }> {
  const { concurrency = 2, wait = 200 } = options;

  const results: R[] = [];
  const errors: string[] = [];

  if (items.length === 0) {
    return { results, errors };
  }

  const { promise, resolve } = Promise.withResolvers<{
    results: R[];
    errors: string[];
  }>();

  const queue = new AsyncQueuer<T>(
    async (item) => {
      const result = await processor(item);
      results.push(result);
    },
    {
      concurrency,
      wait,
      started: true,
    }
  );

  queue.setOptions({
    onError: (error: unknown) => {
      console.error(error);
      errors.push(error instanceof Error ? error.message : String(error));
    },
    onSettled: (item, queuer) => {
      if (queuer.store.state.settledCount === items.length) {
        resolve({ results, errors });
      }
    },
  });

  for (const item of items) {
    queue.addItem(item, "back");
  }

  return promise;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key as K))
  ) as Omit<T, K>;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => keys.includes(key as K))
  ) as Pick<T, K>;
}
