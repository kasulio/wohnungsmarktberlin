import { z } from "zod";

const syncStats = z.object({
  extractedUrls: z.number(),
  newJobsCreated: z.number(),
  flatsDeleted: z.number().optional(),
});

const extractStats = z.object({
  flatsExtracted: z.number(),
  flatsFailed: z.number(),
  flatsPending: z.number(),
});

const adminStats = z.object({
  mode: z.string(),
  syncResults: z.array(
    z.object({ success: z.boolean(), stats: syncStats.partial().optional() }),
  ),
  extractionStats: extractStats,
});

const describeExtract = (s: z.infer<typeof extractStats>) => [
  `${s.flatsExtracted} extrahiert`,
  ...(s.flatsFailed > 0 ? [`${s.flatsFailed} Fehler`] : []),
  `${s.flatsPending} offen`,
];

/** One German line for a `scraperRun.statsJson`, whatever kind of run wrote it. */
export function describeRunStats(raw: string): string {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return raw.slice(0, 120);
  }

  const admin = adminStats.safeParse(value);
  if (admin.success) {
    const { mode, syncResults, extractionStats } = admin.data;
    const parts: string[] = [];
    if (mode !== "extract_only") {
      const ok = syncResults.filter((r) => r.success).length;
      const newJobs = syncResults.reduce(
        (sum, r) => sum + (r.stats?.newJobsCreated ?? 0),
        0,
      );
      parts.push(
        `${ok}/${syncResults.length} synchronisiert`,
        `${newJobs} neu`,
      );
    }
    if (mode !== "sync_only") parts.push(...describeExtract(extractionStats));
    return parts.join(" · ");
  }

  const sync = syncStats.safeParse(value);
  if (sync.success) {
    const s = sync.data;
    return [
      `${s.extractedUrls} Inserate gefunden`,
      `${s.newJobsCreated} neu`,
      ...(s.flatsDeleted ? [`${s.flatsDeleted} entfernt`] : []),
    ].join(" · ");
  }

  const extract = extractStats.safeParse(value);
  if (extract.success) return describeExtract(extract.data).join(" · ");

  return raw.slice(0, 120);
}
