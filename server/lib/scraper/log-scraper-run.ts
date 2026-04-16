import { db } from "~/server/db/client";
import { scraperRun } from "~/server/db/schema";

export type ScraperRunTrigger = "scheduled" | "admin";

export async function logScraperRun(params: {
  kind: string;
  propertyManagementId?: string | null;
  success: boolean;
  stats: unknown;
  errorMessage?: string | null;
  durationMs: number;
  trigger: ScraperRunTrigger;
}): Promise<void> {
  await db.insert(scraperRun).values({
    kind: params.kind,
    propertyManagementId: params.propertyManagementId ?? null,
    success: params.success,
    statsJson: JSON.stringify(params.stats),
    errorMessage: params.errorMessage ?? null,
    durationMs: params.durationMs,
    trigger: params.trigger,
    createdAt: new Date(),
  });
}
