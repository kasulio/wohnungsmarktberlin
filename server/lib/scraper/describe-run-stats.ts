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

const addressStats = z.object({
  addressesImproved: z.number(),
  addressesFailed: z.number(),
  addressesTransientFailed: z.number().optional(),
  addressesPending: z.number(),
});

const notifyStats = z.object({
  stamped: z.number(),
  subscribers: z.number(),
  candidates: z.number(),
  sent: z.number(),
  failed: z.number().optional(),
  deactivated: z.number(),
});

const mapPreviewStats = z.object({
  regenerated: z.boolean(),
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

  const address = addressStats.safeParse(value);
  if (address.success) {
    const a = address.data;
    const transient = a.addressesTransientFailed ?? 0;
    return [
      `${a.addressesImproved} geocodiert`,
      ...(a.addressesFailed > 0 ? [`${a.addressesFailed} nicht gefunden`] : []),
      ...(transient > 0 ? [`${transient} vorübergehend fehlgeschlagen`] : []),
      `${a.addressesPending} offen`,
    ].join(" · ");
  }

  const notify = notifyStats.safeParse(value);
  if (notify.success) {
    const n = notify.data;
    const failed = n.failed ?? 0;
    return [
      `${n.sent} gesendet`,
      ...(n.stamped > 0 ? [`${n.stamped} neu sichtbar`] : []),
      ...(failed > 0 ? [`${failed} Fehler`] : []),
      ...(n.deactivated > 0 ? [`${n.deactivated} deaktiviert`] : []),
    ].join(" · ");
  }

  const mapPreview = mapPreviewStats.safeParse(value);
  if (mapPreview.success) {
    return mapPreview.data.regenerated
      ? "Kartenbild aktualisiert"
      : "Unverändert";
  }

  return raw.slice(0, 120);
}
