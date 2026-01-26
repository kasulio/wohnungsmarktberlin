/**
 * Queue utilities for rate-limited concurrent processing
 */

/**
 * Options for queue processing
 */
export interface QueueOptions {
  /** Maximum number of concurrent operations */
  concurrency: number;
  /** Delay in milliseconds between operations */
  wait: number;
}

/**
 * Process items with rate limiting and concurrency control
 * Prevents overwhelming servers with too many simultaneous requests
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Queue configuration (concurrency limit and wait time)
 * @returns Array of processed results
 */
export async function processWithQueue<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: QueueOptions,
): Promise<R[]> {
  const results: R[] = [];
  const { concurrency, wait } = options;

  // Process items in batches respecting concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processor(item);
        } catch (error) {
          console.error("Error processing item:", error);
          throw error;
        }
      }),
    );

    results.push(...batchResults);

    // Wait between batches (except for the last batch)
    if (i + concurrency < items.length && wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  return results;
}

/**
 * Simple delay utility
 * @param ms - Milliseconds to wait
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
