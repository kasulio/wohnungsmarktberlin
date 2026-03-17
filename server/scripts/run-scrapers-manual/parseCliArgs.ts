/**
 * Parse CLI arguments for test-cases scripts
 *
 * Supports:
 * - `--provider=<name>`: Filter by specific provider. If not specified, all providers are included.
 * - `--limit=<number>`: Limit the number of files/items to process. If not specified, no limit is applied.
 *
 * @example
 * // Run with specific provider and limit
 * bun test-cases/testFromHtmlFiles.ts --provider=deuwo --limit=5
 *
 * // Run with all providers and no limit
 * bun test-cases/testFromHtmlFiles.ts
 *
 * // Run with specific provider, no limit
 * bun test-cases/testFromHtmlFiles.ts --provider=deuwo
 */
export function parseCliArgs() {
  const args = process.argv.slice(2);
  const providerArg = args.find((arg) => arg.startsWith("--provider="))?.split("=")[1];
  const limitArg = args.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  return {
    provider: providerArg,
    limit,
  };
}
