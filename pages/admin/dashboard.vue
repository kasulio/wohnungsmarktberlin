<script setup lang="ts">
import { type AdminScrapeMode } from "~/components/Admin/RefreshMenu.vue";

useHead({ title: "Admin Dashboard" });

const { $client } = useNuxtApp();

const propertyManagements = await $client.propertyManagement.getAll.useQuery();

const scrapingStatus = ref<{
  isActive: boolean;
  slugs?: string[];
  mode?: AdminScrapeMode;
}>({ isActive: false });

const { data: scraperOverviewData, refresh: refreshScraperOverview } =
  $client.propertyManagement.getScraperOverview.useQuery(undefined, {
    refetchInterval: computed(() =>
      scrapingStatus.value.isActive ? 3000 : false,
    ),
  } as Record<string, unknown>);

const lastRunSummary = ref<string | null>(null);
const lastRunIsError = ref(false);
const retryingUrl = ref<string | null>(null);

const PENDING_WARN_THRESHOLD = 12;
const STALE_PENDING_MS = 24 * 60 * 60 * 1000;
const RUNS_PREVIEW = 5;

type PmJobs = NonNullable<
  Awaited<
    ReturnType<typeof $client.propertyManagement.getScraperOverview.query>
  >
>["perPropertyManagement"][number];

type Health = {
  tone: "red" | "yellow" | "green";
  label: string;
  title: string;
};

const isStalePending = (j: PmJobs) => {
  if (j.oldestPendingAt == null || j.pending === 0) return false;
  const t = new Date(j.oldestPendingAt).getTime();
  return !Number.isNaN(t) && Date.now() - t > STALE_PENDING_MS;
};

const healthOf = (j: PmJobs | undefined): Health => {
  if (!j) return { tone: "green", label: "OK", title: "Keine Jobs" };
  if (j.failed > 0) {
    return {
      tone: "red",
      label: `${j.failed} Fehler`,
      title: "Fehlgeschlagene Jobs in der Warteschlange",
    };
  }
  if (isStalePending(j)) {
    return {
      tone: "red",
      label: "Hängt",
      title: "Offener Job älter als 24 Std.",
    };
  }
  if (j.pending > PENDING_WARN_THRESHOLD) {
    return {
      tone: "yellow",
      label: `${j.pending} offen`,
      title: "Viele offene Jobs",
    };
  }
  return { tone: "green", label: "OK", title: "Warteschlange unauffällig" };
};

const pillClass: Record<Health["tone"], string> = {
  red: "bg-red-100 text-red-900",
  yellow: "bg-amber-100 text-amber-900",
  green: "bg-green-100 text-green-900",
};
const dotClass: Record<Health["tone"], string> = {
  red: "bg-red-600",
  yellow: "bg-amber-500",
  green: "bg-green-600",
};

const jobsBySlug = computed(
  () =>
    new Map<string, PmJobs>(
      (scraperOverviewData.value?.perPropertyManagement ?? []).map((p) => [
        p.slug,
        p,
      ]),
    ),
);

const rows = computed(() => {
  const toneRank = { red: 0, yellow: 1, green: 2 };
  return (propertyManagements.data.value ?? [])
    .map((pm) => {
      const jobs = jobsBySlug.value.get(pm.slug);
      return { pm, jobs, health: healthOf(jobs) };
    })
    .sort(
      (a, b) =>
        toneRank[a.health.tone] - toneRank[b.health.tone] ||
        (b.jobs?.pending ?? 0) - (a.jobs?.pending ?? 0) ||
        a.pm.name.localeCompare(b.pm.name),
    );
});

const problemRows = computed(() =>
  rows.value.filter((r) => r.health.tone !== "green"),
);
const okRows = computed(() =>
  rows.value.filter((r) => r.health.tone === "green"),
);
const showOkRows = ref(false);
const visibleRows = computed(() =>
  problemRows.value.length === 0 || showOkRows.value
    ? rows.value
    : problemRows.value,
);

const queueSegments = (j: PmJobs | undefined) => {
  const total = (j?.pending ?? 0) + (j?.failed ?? 0) + (j?.completed ?? 0);
  if (!j || total === 0) return [];
  return [
    { cls: "bg-amber-500", pct: (j.pending / total) * 100 },
    { cls: "bg-red-600", pct: (j.failed / total) * 100 },
    { cls: "bg-green-600", pct: (j.completed / total) * 100 },
  ].filter((s) => s.pct > 0);
};

const queueText = (j: PmJobs | undefined) => {
  if (!j || (j.pending === 0 && j.failed === 0)) return "leer";
  const parts = [];
  if (j.pending > 0) parts.push(`${j.pending} offen`);
  if (j.failed > 0) parts.push(`${j.failed} Fehler`);
  return parts.join(" · ");
};

const loadingModeFor = (slugs: string[] | undefined) => {
  const s = scrapingStatus.value;
  if (!s.isActive) return null;
  const same =
    slugs == null
      ? s.slugs == null
      : s.slugs?.length === 1 && s.slugs[0] === slugs[0];
  return same ? (s.mode ?? null) : null;
};

const globalQueue = computed(() => scraperOverviewData.value?.global);

const updatePropertyManagements = async (
  slugs: string[] | undefined,
  mode: AdminScrapeMode,
) => {
  if (scrapingStatus.value.isActive) return;

  scrapingStatus.value = { slugs, mode, isActive: true };
  lastRunSummary.value = null;
  lastRunIsError.value = false;

  try {
    const res = await $client.propertyManagement.update.mutate({ slugs, mode });
    const parts: string[] = [];
    if (res.mode === "full" || res.mode === "sync_only") {
      parts.push(`${res.syncResults.length} Verwaltung(en) synchronisiert`);
    }
    if (res.mode === "full" || res.mode === "extract_only") {
      parts.push(`${res.extractionStats.flatsExtracted} URLs extrahiert`);
      if (res.extractionStats.flatsFailed > 0) {
        parts.push(
          `${res.extractionStats.flatsFailed} Extraktionen fehlgeschlagen`,
        );
      }
    }
    parts.push(
      res.mode === "sync_only"
        ? `${res.pendingRemaining} noch in der Warteschlange`
        : `${res.pendingRemaining} noch in der Warteschlange (Rest über Cron)`,
    );
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

const retryFailedJob = async (url: string) => {
  if (retryingUrl.value != null) return;
  retryingUrl.value = url;
  lastRunSummary.value = null;
  lastRunIsError.value = false;
  try {
    await $client.propertyManagement.retryFlatUrlJob.mutate({ url });
    lastRunSummary.value = "Job erneut eingereiht.";
  } catch (e) {
    lastRunIsError.value = true;
    lastRunSummary.value =
      e instanceof Error ? e.message : "Anfrage fehlgeschlagen.";
  } finally {
    retryingUrl.value = null;
    await refreshScraperOverview();
  }
};

const truncateErr = (s: string | null | undefined, n = 140) => {
  if (s == null || s === "") return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

const shortUrl = (url: string) => {
  try {
    const u = new URL(url);
    const path =
      u.pathname.length > 32 ? `…${u.pathname.slice(-30)}` : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
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

const pmName = (slug: string | null) =>
  propertyManagements.data.value?.find((p) => p.slug === slug)?.name ?? slug;

const runKindLabel = (kind: string) => {
  const map: Record<string, string> = {
    "admin-scrape": "Admin",
    "update-flats": "Sync",
    "extract-flats": "Extraktion",
  };
  return map[kind] ?? kind;
};

const showAllRuns = ref(false);
const visibleRuns = computed(() => {
  const runs = scraperOverviewData.value?.recentRuns ?? [];
  return showAllRuns.value ? runs : runs.slice(0, RUNS_PREVIEW);
});
const latestRun = computed(() => scraperOverviewData.value?.recentRuns?.[0]);

const formatNumber = (n: number) => n.toLocaleString("de-DE");
</script>

<template>
  <!-- z-index + padding: footer building illustration uses absolute positioning and can overlap content -->
  <div class="relative z-10 flex flex-col gap-8 pb-36 md:pb-44">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-xl text-main">Admin</h1>
        <p
          v-if="latestRun"
          class="text-xs text-gray-600"
        >
          Letzter Lauf {{ formatAgo(latestRun.createdAt) }} ·
          {{ runKindLabel(latestRun.kind) }}
          <template v-if="latestRun.propertyManagementId">
            · {{ pmName(latestRun.propertyManagementId) }}
          </template>
        </p>
      </div>
      <AdminRefreshMenu
        class="self-start sm:self-auto"
        prominent
        label="Alle aktualisieren"
        :disabled="scrapingStatus.isActive"
        :loading-mode="loadingModeFor(undefined)"
        @run="(mode) => updatePropertyManagements(undefined, mode)"
      />
    </div>

    <div
      v-if="lastRunSummary"
      role="status"
      class="text-sm -mt-4 rounded-2xl border px-4 py-3 leading-relaxed"
      :class="
        lastRunIsError
          ? 'border-red-600 bg-red-50 text-red-900'
          : 'border-green-800/35 bg-green-100/90 text-green-950'
      "
    >
      {{ lastRunSummary }}
    </div>

    <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-3xl border border-black bg-white px-4 py-3">
        <p class="text-xs text-gray-500">Sichtbar</p>
        <p class="text-l font-semibold tabular-nums text-main">
          {{ formatNumber(totalActiveFlatCount) }}
        </p>
      </div>
      <div class="rounded-3xl border border-black bg-white px-4 py-3">
        <p class="text-xs text-gray-500">Gesamt</p>
        <p class="text-l font-semibold tabular-nums text-main">
          {{ formatNumber(totalFlatCount) }}
        </p>
      </div>
      <div class="rounded-3xl border border-black bg-white px-4 py-3">
        <p class="text-xs text-gray-500">Warteschlange</p>
        <p class="text-l font-semibold tabular-nums text-main">
          {{ formatNumber(globalQueue?.pending ?? 0) }}
        </p>
      </div>
      <div
        class="rounded-3xl bg-white px-4 py-3"
        :class="
          (globalQueue?.failed ?? 0) > 0
            ? 'border-2 border-red-600'
            : 'border border-black'
        "
      >
        <p class="text-xs text-gray-500">Fehler</p>
        <p
          class="text-l font-semibold tabular-nums"
          :class="(globalQueue?.failed ?? 0) > 0 ? 'text-red-600' : 'text-main'"
        >
          {{ formatNumber(globalQueue?.failed ?? 0) }}
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-l font-semibold text-main">Verwaltungen</h2>
      <div class="rounded-3xl border border-black bg-white text-s">
        <div
          class="pm-row hidden border-b border-black/10 px-4 py-2 text-xs font-semibold text-gray-500 md:grid"
          aria-hidden="true"
        >
          <span class="[grid-area:name]">Verwaltung</span>
          <span class="[grid-area:status]">Status</span>
          <span class="text-right [grid-area:visible]">Sichtbar</span>
          <span class="[grid-area:queue]">Warteschlange</span>
          <span class="[grid-area:last]">Letzter Lauf</span>
        </div>
        <div
          v-for="{ pm, jobs, health } in visibleRows"
          :key="pm.slug"
          class="pm-row grid border-b border-black/10 px-4 py-3 last:border-b-0"
        >
          <div class="min-w-0 [grid-area:name]">
            <StyledNuxtLink
              v-if="pm.website"
              :to="pm.website"
              class="font-semibold text-primary"
            >
              {{ pm.name }}
            </StyledNuxtLink>
            <span
              v-else
              class="font-semibold text-main"
              >{{ pm.name }}</span
            >
          </div>
          <div
            class="self-start justify-self-end [grid-area:status] md:justify-self-start"
          >
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="pillClass[health.tone]"
              :title="health.title"
            >
              <span
                class="h-2 w-2 rounded-full"
                :class="dotClass[health.tone]"
              />
              {{ health.label }}
            </span>
          </div>
          <div class="[grid-area:queue]">
            <div
              class="flex h-1.5 overflow-hidden rounded-full bg-black/10"
              :title="
                jobs
                  ? `${jobs.pending} offen · ${jobs.failed} Fehler · ${jobs.completed} erledigt`
                  : undefined
              "
            >
              <span
                v-for="seg in queueSegments(jobs)"
                :key="seg.cls"
                :class="seg.cls"
                :style="{ width: `${seg.pct}%` }"
              />
            </div>
            <p class="mt-0.5 text-xs tabular-nums text-gray-500">
              {{ queueText(jobs) }}
            </p>
          </div>
          <div
            class="flex gap-1 text-xs text-gray-500 [grid-area:meta] md:contents"
          >
            <span
              class="tabular-nums md:text-right md:text-s md:text-main md:[grid-area:visible]"
              ><span class="md:hidden">{{ pm.activeFlatCount }} sichtbar ·</span
              ><span class="hidden md:inline">{{
                pm.activeFlatCount
              }}</span></span
            >
            <span class="md:[grid-area:last]">{{
              formatAgo(jobs?.lastRunAt)
            }}</span>
          </div>
          <div class="justify-self-end [grid-area:action]">
            <AdminRefreshMenu
              :disabled="scrapingStatus.isActive"
              :loading-mode="loadingModeFor([pm.slug])"
              @run="(mode) => updatePropertyManagements([pm.slug], mode)"
            />
          </div>
          <ul
            v-if="jobs?.failedSamples?.length"
            class="mt-2 space-y-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs [grid-area:errors]"
          >
            <li
              v-for="s in jobs.failedSamples"
              :key="s.url"
              class="flex items-start gap-2"
            >
              <div class="min-w-0 flex-1">
                <a
                  :href="s.url"
                  class="font-mono break-all text-primary underline decoration-black/20 underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="s.url"
                  >{{ shortUrl(s.url) }}</a
                >
                <p
                  v-if="s.lastError"
                  class="break-words text-red-800/90"
                  :title="s.lastError"
                >
                  {{ truncateErr(s.lastError) }}
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-black/30 bg-white px-2 py-0.5 font-medium text-main hover:bg-black/5 disabled:opacity-50"
                :disabled="retryingUrl != null || scrapingStatus.isActive"
                @click="retryFailedJob(s.url)"
              >
                Erneut
              </button>
            </li>
          </ul>
        </div>
        <button
          v-if="problemRows.length > 0 && okRows.length > 0"
          type="button"
          class="w-full px-4 py-2.5 text-left text-xs text-gray-600 hover:bg-black/[0.02]"
          @click="showOkRows = !showOkRows"
        >
          {{
            showOkRows
              ? "Unauffällige ausblenden ▴"
              : `+ ${okRows.length} weitere, alle OK ▾`
          }}
        </button>
      </div>
    </section>

    <AdminRecipients />

    <section
      v-if="scraperOverviewData?.recentRuns?.length"
      class="space-y-3"
    >
      <h2 class="text-l font-semibold text-main">Letzte Läufe</h2>
      <ul
        role="list"
        class="overflow-hidden rounded-3xl border border-black bg-white text-xs"
      >
        <li
          v-for="run in visibleRuns"
          :key="run.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-black/10 px-4 py-2.5 last:border-b-0"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :class="run.success ? 'bg-green-600' : 'bg-red-600'"
          />
          <span class="w-24 shrink-0 text-gray-600">{{
            formatAgo(run.createdAt)
          }}</span>
          <span class="w-20 shrink-0 font-semibold text-main">{{
            runKindLabel(run.kind)
          }}</span>
          <span class="text-gray-600">
            <template v-if="run.propertyManagementId"
              >{{ pmName(run.propertyManagementId) }} ·
            </template>
            <template v-if="run.durationMs != null"
              >{{ (run.durationMs / 1000).toFixed(1) }} s ·
            </template>
            {{ run.statsSummary }}
          </span>
        </li>
        <li v-if="(scraperOverviewData.recentRuns.length ?? 0) > RUNS_PREVIEW">
          <button
            type="button"
            class="w-full px-4 py-2.5 text-left text-gray-600 hover:bg-black/[0.02]"
            @click="showAllRuns = !showAllRuns"
          >
            {{
              showAllRuns
                ? "Weniger anzeigen ▴"
                : `Alle ${scraperOverviewData.recentRuns.length} anzeigen ▾`
            }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.pm-row {
  column-gap: 0.75rem;
  row-gap: 0.25rem;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "name status"
    "queue queue"
    "meta action"
    "errors errors";
}

@media (min-width: 768px) {
  .pm-row {
    grid-template-columns:
      minmax(8rem, 1.3fr) 7rem 4.5rem minmax(7rem, 1fr)
      6.5rem auto;
    grid-template-areas:
      "name status visible queue last action"
      "errors errors errors errors errors errors";
  }
}
</style>
