<script setup lang="ts">
useHead({ title: "Admin Dashboard" });

const { $client } = useNuxtApp();

const propertyManagements = await $client.propertyManagement.getAll.useQuery();

const scrapingStatus = ref<{ slugs?: string[]; isActive: boolean }>({
  isActive: false,
});

const { data: scraperOverviewData, refresh: refreshScraperOverview } =
  $client.propertyManagement.getScraperOverview.useQuery(undefined, {
    refetchInterval: computed(() =>
      scrapingStatus.value.isActive ? 3000 : false,
    ),
  } as Record<string, unknown>);

const lastRunSummary = ref<string | null>(null);
const lastRunIsError = ref(false);

const formatAgo = (d: Date | string | number | null | undefined) => {
  if (d == null) return "—";
  const date = d instanceof Date ? d : new Date(d);
  const t = date.getTime();
  if (Number.isNaN(t)) return "—";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 48) return `vor ${h} Std.`;
  const days = Math.floor(h / 24);
  return `vor ${days} Tagen`;
};

type PmJobs = NonNullable<
  Awaited<
    ReturnType<typeof $client.propertyManagement.getScraperOverview.query>
  >
>["perPropertyManagement"][number];

const jobsForPm = (slug: string): PmJobs | undefined =>
  scraperOverviewData.value?.perPropertyManagement.find((p) => p.slug === slug);

const queueStatus = (
  j: Pick<PmJobs, "pending" | "failed" | "completed"> | undefined,
) => {
  if (!j) return { tone: "muted" as const, label: "—" };
  if (j.failed > 0) return { tone: "danger" as const, label: "Fehler" };
  if (j.pending > 12) return { tone: "warn" as const, label: "Viel offen" };
  if (j.pending > 0) return { tone: "busy" as const, label: "Warteschlange" };
  return { tone: "ok" as const, label: "Leer" };
};

const statusDotClass: Record<ReturnType<typeof queueStatus>["tone"], string> = {
  ok: "bg-green-600",
  busy: "bg-amber-500",
  warn: "bg-orange-500",
  danger: "bg-red-600",
  muted: "bg-gray-400",
};

const sortedManagements = computed(() => {
  const list = propertyManagements.data.value ?? [];
  return [...list].sort((a, b) => {
    const ja = jobsForPm(a.slug);
    const jb = jobsForPm(b.slug);
    const sa = (ja?.pending ?? 0) + (ja?.failed ?? 0) * 20;
    const sb = (jb?.pending ?? 0) + (jb?.failed ?? 0) * 20;
    return sb - sa;
  });
});

const globalQueue = computed(() => scraperOverviewData.value?.global);

const updatePropertyManagements = async (slugs?: string[]) => {
  if (scrapingStatus.value.isActive) return;

  scrapingStatus.value = { slugs, isActive: true };
  lastRunSummary.value = null;
  lastRunIsError.value = false;

  try {
    const res = await $client.propertyManagement.update.mutate({ slugs });
    const parts = [
      `${res.syncResults.length} Verwaltung(en) synchronisiert`,
      `${res.extractionStats.flatsExtracted} URLs extrahiert`,
      res.extractionStats.flatsFailed > 0
        ? `${res.extractionStats.flatsFailed} Extraktionen fehlgeschlagen`
        : null,
      `${res.pendingRemaining} noch in der Warteschlange (Rest über Cron)`,
    ].filter(Boolean);
    lastRunSummary.value = parts.join(" · ");
  } catch (e) {
    lastRunIsError.value = true;
    lastRunSummary.value =
      e instanceof Error ? e.message : "Anfrage fehlgeschlagen.";
  } finally {
    scrapingStatus.value = { isActive: false };
    await propertyManagements.refresh();
    await refreshScraperOverview();
  }
};

const totalFlatCount = computed(
  () =>
    propertyManagements.data.value?.reduce((sum, p) => sum + p.flatCount, 0) ??
    0,
);
const totalActiveFlatCount = computed(
  () =>
    propertyManagements.data.value?.reduce(
      (sum, p) => sum + p.activeFlatCount,
      0,
    ) ?? 0,
);

const runKindLabel = (kind: string) => {
  const map: Record<string, string> = {
    "admin-scrape": "Admin",
    "update-flats": "Sync",
    "extract-flats": "Extraktion",
  };
  return map[kind] ?? kind;
};

const triggerLabel = (t: string) => (t === "admin" ? "Manuell" : "Geplant");
</script>

<template>
  <!-- z-index + padding: footer building illustration uses absolute positioning and can overlap content -->
  <div class="relative z-10 flex flex-col gap-10 pb-36 md:pb-44">
    <div
      v-if="lastRunSummary"
      role="status"
      class="text-sm rounded-2xl border border-black px-4 py-3 leading-relaxed"
      :class="
        lastRunIsError
          ? 'border-red-600 bg-red-50 text-red-900'
          : 'border-green-800/35 bg-green-100/90 text-green-950'
      "
    >
      {{ lastRunSummary }}
    </div>

    <div
      class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <h1 class="text-xl text-main">Übersicht · Scraper</h1>
      <FatButton
        :action="() => void updatePropertyManagements()"
        :disabled="scrapingStatus.isActive"
        class="inline-flex shrink-0 items-center gap-3 self-start md:self-auto"
      >
        Alle Verwaltungen synchronisieren
        <LoadingSpinner
          v-if="scrapingStatus.isActive && !scrapingStatus.slugs"
        />
      </FatButton>
    </div>

    <section
      v-if="scraperOverviewData"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div class="rounded-3xl border border-black bg-white px-5 py-4 text-left">
        <p class="text-sm text-gray-500">Wohnungen (aktiv)</p>
        <p class="text-2xl mt-1 font-semibold tabular-nums text-main">
          {{ totalActiveFlatCount }}
        </p>
      </div>
      <div class="rounded-3xl border border-black bg-white px-5 py-4 text-left">
        <p class="text-sm text-gray-500">Wohnungen (gesamt)</p>
        <p class="text-2xl mt-1 font-semibold tabular-nums text-main">
          {{ totalFlatCount }}
        </p>
      </div>
      <div class="rounded-3xl border border-black bg-white px-5 py-4 text-left">
        <p class="text-sm text-gray-500">Jobs offen</p>
        <p class="text-2xl mt-1 font-semibold tabular-nums text-main">
          {{ globalQueue?.pending ?? 0 }}
        </p>
      </div>
      <div
        class="rounded-3xl border border-black bg-white px-5 py-4 text-left"
        :class="(globalQueue?.failed ?? 0) > 0 ? 'border-2 border-red-600' : ''"
      >
        <p class="text-sm text-gray-500">Jobs fehlgeschlagen</p>
        <p
          class="text-2xl mt-1 font-semibold tabular-nums"
          :class="(globalQueue?.failed ?? 0) > 0 ? 'text-red-600' : 'text-main'"
        >
          {{ globalQueue?.failed ?? 0 }}
        </p>
      </div>
    </section>

    <p
      v-if="globalQueue?.oldestPending"
      class="text-sm text-gray-600"
    >
      Ältester offener Job:
      <span class="font-medium text-main">{{
        formatAgo(globalQueue.oldestPending.createdAt)
      }}</span>
    </p>

    <section class="space-y-4">
      <h2 class="text-l font-semibold text-main">Verwaltungen</h2>
      <ul
        class="grid gap-4 lg:grid-cols-2"
        role="list"
      >
        <li
          v-for="pm in sortedManagements"
          :key="pm.slug"
          class="flex flex-col overflow-hidden rounded-3xl border border-black bg-white"
        >
          <div
            class="flex items-start justify-between gap-3 border-b border-black/10 px-5 pb-4 pt-5"
          >
            <div class="min-w-0 flex-1">
              <StyledNuxtLink
                v-if="pm.website"
                :to="pm.website"
                class="text-l font-semibold text-primary"
              >
                {{ pm.name }}
              </StyledNuxtLink>
              <h3
                v-else
                class="text-l font-semibold text-main"
              >
                {{ pm.name }}
              </h3>
              <p class="mt-0.5 truncate text-xs lowercase text-gray-500">
                {{ pm.slug }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :class="statusDotClass[queueStatus(jobsForPm(pm.slug)).tone]"
                :title="queueStatus(jobsForPm(pm.slug)).label"
              />
              <span
                class="rounded-full border border-black bg-white px-2.5 py-0.5 text-xs font-medium text-main"
              >
                {{ queueStatus(jobsForPm(pm.slug)).label }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 px-5 py-4 text-center">
            <div>
              <p
                class="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Aktiv
              </p>
              <p class="text-m font-semibold tabular-nums text-main">
                {{ pm.activeFlatCount }}
              </p>
            </div>
            <div>
              <p
                class="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Gesamt
              </p>
              <p class="text-m font-semibold tabular-nums text-main">
                {{ pm.flatCount }}
              </p>
            </div>
            <div>
              <p
                class="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Queue
              </p>
              <p class="text-m font-semibold tabular-nums text-main">
                <template v-if="jobsForPm(pm.slug)">
                  {{ jobsForPm(pm.slug)!.pending }}·{{
                    jobsForPm(pm.slug)!.failed
                  }}·{{ jobsForPm(pm.slug)!.completed }}
                </template>
                <template v-else>—</template>
              </p>
              <p class="text-[0.65rem] text-gray-400">offen·fail·fertig</p>
            </div>
          </div>

          <div
            v-if="jobsForPm(pm.slug)?.failedSamples?.length"
            class="border-t border-black/10 px-5 py-3"
          >
            <p
              class="mb-2 text-xs font-bold uppercase tracking-wide text-red-700"
            >
              Fehlgeschlagene URLs
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="(s, i) in jobsForPm(pm.slug)!.failedSamples"
                :key="i"
                class="truncate text-xs"
              >
                <a
                  :href="s.url"
                  class="text-primary underline decoration-black/20 underline-offset-2 hover:decoration-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ s.url }}</a
                >
              </li>
            </ul>
          </div>

          <div class="mt-auto border-t border-black/10 bg-background/40 p-4">
            <FatButton
              :action="() => void updatePropertyManagements([pm.slug])"
              :disabled="scrapingStatus.isActive"
              class="flex w-full items-center justify-center gap-3"
            >
              Diese Verwaltung synchronisieren
              <LoadingSpinner
                v-if="
                  scrapingStatus.isActive &&
                  scrapingStatus.slugs?.includes(pm.slug)
                "
              />
            </FatButton>
          </div>
        </li>
      </ul>
    </section>

    <section
      v-if="scraperOverviewData?.recentRuns?.length"
      class="space-y-4"
    >
      <h2 class="text-l font-semibold text-main">Letzte Läufe</h2>
      <div class="overflow-hidden rounded-3xl border border-black bg-white">
        <ul role="list">
          <li
            v-for="run in scraperOverviewData.recentRuns"
            :key="run.id"
            class="flex flex-col gap-2 border-b border-black/10 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <div class="flex shrink-0 items-center gap-2 sm:w-40">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :class="run.success ? 'bg-green-600' : 'bg-red-600'"
              />
              <span class="text-xs text-gray-600">{{
                formatAgo(run.createdAt)
              }}</span>
            </div>
            <div
              class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-700"
            >
              <span class="font-semibold text-main">{{
                runKindLabel(run.kind)
              }}</span>
              <span class="text-gray-400">·</span>
              <span>{{ triggerLabel(run.trigger) }}</span>
              <span
                v-if="run.propertyManagementId"
                class="text-gray-500"
                >· {{ run.propertyManagementId }}</span
              >
              <span
                v-if="run.durationMs != null"
                class="tabular-nums text-gray-500"
                >· {{ run.durationMs }} ms</span
              >
            </div>
            <p
              class="max-w-full truncate text-xs text-gray-500 sm:max-w-[14rem] md:max-w-md"
              :title="run.statsSummary"
            >
              {{ run.statsSummary }}
            </p>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
