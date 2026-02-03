import ky, { type KyInstance, type Options as KyOptions } from "ky";

/**
 * Creates a configured HTTP client with retries and timeout
 */
function createHttpClient(options: KyOptions = {}): KyInstance {
  return ky.create({
    timeout: 30000, // 30 seconds
    retry: {
      limit: 2,
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
    },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    ...options,
  });
}

/**
 * Default HTTP client instance
 */
const httpClient = createHttpClient();

/**
 * Fetches HTML content from a URL with retry logic
 */
export async function fetchHtml(
  url: string,
  options?: KyOptions,
): Promise<string> {
  return await httpClient.get(url, options).text();
}

/**
 * Fetches JSON content from a URL with retry logic
 */
export async function fetchJson<T = any>(
  url: string,
  options?: KyOptions,
): Promise<T> {
  return await httpClient.get(url, options).json<T>();
}
