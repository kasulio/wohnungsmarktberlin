<script setup lang="ts">
import { describeFlatFilter } from "~/lib/describe-flat-filter";

useHead({ title: "Admin Dashboard" });

const { $client } = useNuxtApp();

type AdminScrapeMode = "full" | "sync_only" | "extract_only";

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

const isStalePending = (
  oldest: Date | string | number | null | undefined,
  pending: number,
) => {
  if (oldest == null || pending === 0) return false;
  const t = new Date(oldest).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > STALE_PENDING_MS;
};

type AmpelTone = "red" | "yellow" | "green" | "muted";

const ampelDotClass: Record<AmpelTone, string> = {
  red: "bg-red-600",
  yellow: "bg-amber-500",
  green: "bg-green-600",
  muted: "bg-gray-400",
};

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

const ampelForPm = (
  j: PmJobs | undefined,
): { tone: AmpelTone; label: string; title: string } => {
  if (!j) return { tone: "muted", label: "—", title: "Keine Job-Daten" };
  const stale = isStalePending(j.oldestPendingAt, j.pending);
  if (j.failed > 0 || stale) {
    return {
      tone: "red",
      label: "Fehler",
      title: stale
        ? "Offener Job älter als 24h oder fehlgeschlagen"
        : "Fehlgeschlagene Jobs in Queue",
    };
  }
  if (j.pending > PENDING_WARN_THRESHOLD) {
    return {
      tone: "yellow",
      label: "Hoch",
      title: "Viele offene Jobs",
    };
  }
  return { tone: "green", label: "OK", title: "Queue unauffällig" };
};

const scrapeGlobalLoading = (mode: AdminScrapeMode) =>
  scrapingStatus.value.isActive &&
  scrapingStatus.value.slugs == null &&
  scrapingStatus.value.mode === mode;

const scrapePmLoading = (slug: string, mode: AdminScrapeMode) =>
  scrapingStatus.value.isActive &&
  scrapingStatus.value.slugs?.length === 1 &&
  scrapingStatus.value.slugs[0] === slug &&
  scrapingStatus.value.mode === mode;

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

const updatePropertyManagements = async (
  slugs: string[] | undefined,
  mode: AdminScrapeMode = "full",
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

// --- Notification subscribers ---------------------------------------------
const subscribers = await $client.notification.listSubscribers.useQuery();

const testingSubscriberId = ref<string | null>(null);
const notifyFeedback = ref<{ id: string; ok: boolean; msg: string } | null>(
  null,
);

const sendTestNotification = async (subscriberId: string) => {
  if (testingSubscriberId.value) return;
  testingSubscriberId.value = subscriberId;
  notifyFeedback.value = null;
  try {
    const res = await $client.notification.sendTest.mutate({ subscriberId });
    notifyFeedback.value = {
      id: subscriberId,
      ok: res.ok,
      msg: res.ok
        ? `Testbenachrichtigung gesendet (Wohnung ${res.flatId}).`
        : res.blocked
          ? "Empfänger blockiert oder nicht erreichbar."
          : "Senden fehlgeschlagen (siehe Server-Logs).",
    };
  } catch (e) {
    notifyFeedback.value = {
      id: subscriberId,
      ok: false,
      msg: e instanceof Error ? e.message : "Anfrage fehlgeschlagen.",
    };
  } finally {
    testingSubscriberId.value = null;
    await subscribers.refresh();
  }
};
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
      class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <h1 class="text-xl text-main">Scraper</h1>
      <div
        class="flex w-full flex-col gap-2 sm:max-w-md md:w-auto md:shrink-0 lg:max-w-none lg:flex-row lg:flex-wrap lg:justify-end"
      >
        <FatButton
          :action="() => void updatePropertyManagements(undefined, 'full')"
          :disabled="scrapingStatus.isActive"
          class="inline-flex items-center justify-center gap-3"
        >
          Alle · Sync + Extraktion
          <LoadingSpinner v-if="scrapeGlobalLoading('full')" />
        </FatButton>
        <FatButton
          :action="() => void updatePropertyManagements(undefined, 'sync_only')"
          :disabled="scrapingStatus.isActive"
          class="inline-flex items-center justify-center gap-3"
        >
          Alle · Sync
          <LoadingSpinner v-if="scrapeGlobalLoading('sync_only')" />
        </FatButton>
        <FatButton
          :action="
            () => void updatePropertyManagements(undefined, 'extract_only')
          "
          :disabled="scrapingStatus.isActive"
          class="inline-flex items-center justify-center gap-3"
        >
          Alle · Extraktion
          <LoadingSpinner v-if="scrapeGlobalLoading('extract_only')" />
        </FatButton>
      </div>
    </div>

    <section
      v-if="scraperOverviewData"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div class="rounded-3xl border border-black bg-white px-5 py-4 text-left">
        <p class="text-sm text-gray-500">Aktiv</p>
        <p class="text-2xl mt-1 font-semibold tabular-nums text-main">
          {{ totalActiveFlatCount }}
        </p>
      </div>
      <div class="rounded-3xl border border-black bg-white px-5 py-4 text-left">
        <p class="text-sm text-gray-500">Gesamt</p>
        <p class="text-2xl mt-1 font-semibold tabular-nums text-main">
          {{ totalFlatCount }}
        </p>
      </div>
      <div class="rounded-3xl border border-black bg-white px-5 py-4 text-left">
        <p class="text-sm text-gray-500">Offen</p>
        <p class="text-2xl mt-1 font-semibold tabular-nums text-main">
          {{ globalQueue?.pending ?? 0 }}
        </p>
      </div>
      <div
        class="rounded-3xl border border-black bg-white px-5 py-4 text-left"
        :class="(globalQueue?.failed ?? 0) > 0 ? 'border-2 border-red-600' : ''"
      >
        <p class="text-sm text-gray-500">Fehler</p>
        <p
          class="text-2xl mt-1 font-semibold tabular-nums"
          :class="(globalQueue?.failed ?? 0) > 0 ? 'text-red-600' : 'text-main'"
        >
          {{ globalQueue?.failed ?? 0 }}
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-l font-semibold text-main">Verwaltungen</h2>
      <div class="overflow-x-auto rounded-3xl border border-black bg-white">
        <table class="text-sm w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr class="border-b border-black bg-background/50">
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Name
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Status
              </th>
              <th
                scope="col"
                class="px-3 py-3 text-right font-semibold tabular-nums text-main"
              >
                Aktiv
              </th>
              <th
                scope="col"
                class="px-3 py-3 text-right font-semibold tabular-nums text-main"
              >
                Gesamt
              </th>
              <th
                scope="col"
                class="px-3 py-3 text-right font-semibold tabular-nums text-main"
              >
                Queue
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Aktion
              </th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="pm in sortedManagements"
              :key="pm.slug"
            >
              <tr class="border-b border-black/10 last:border-b-0">
                <td class="max-w-[14rem] px-3 py-3 align-top">
                  <StyledNuxtLink
                    v-if="pm.website"
                    :to="pm.website"
                    class="font-medium text-primary"
                  >
                    {{ pm.name }}
                  </StyledNuxtLink>
                  <span
                    v-else
                    class="font-medium text-main"
                    >{{ pm.name }}</span
                  >
                  <p class="truncate text-xs text-gray-500">
                    {{ pm.slug }}
                  </p>
                </td>
                <td class="px-3 py-3 align-top">
                  <span
                    class="inline-flex items-center gap-1.5"
                    :title="ampelForPm(jobsForPm(pm.slug)).title"
                  >
                    <span
                      class="h-2 w-2 shrink-0 rounded-full"
                      :class="
                        ampelDotClass[ampelForPm(jobsForPm(pm.slug)).tone]
                      "
                    />
                    <span class="text-xs font-medium text-main">{{
                      ampelForPm(jobsForPm(pm.slug)).label
                    }}</span>
                  </span>
                </td>
                <td
                  class="px-3 py-3 text-right align-top tabular-nums text-main"
                >
                  {{ pm.activeFlatCount }}
                </td>
                <td
                  class="px-3 py-3 text-right align-top tabular-nums text-main"
                >
                  {{ pm.flatCount }}
                </td>
                <td
                  class="px-3 py-3 text-right align-top tabular-nums text-main"
                >
                  <template v-if="jobsForPm(pm.slug)">
                    {{ jobsForPm(pm.slug)!.pending }}/{{
                      jobsForPm(pm.slug)!.failed
                    }}/{{ jobsForPm(pm.slug)!.completed }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-3 py-3 align-top">
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      title="Sync + Extraktion"
                      class="inline-flex items-center gap-1 rounded-lg border border-black/80 bg-white px-2 py-1.5 text-xs font-medium text-main shadow-sm hover:bg-black/[0.03] disabled:opacity-50"
                      :disabled="scrapingStatus.isActive"
                      @click="
                        () => void updatePropertyManagements([pm.slug], 'full')
                      "
                    >
                      S+E
                      <LoadingSpinner
                        v-if="scrapePmLoading(pm.slug, 'full')"
                        class="!h-4 !w-4"
                      />
                    </button>
                    <button
                      type="button"
                      title="Nur Sync"
                      class="inline-flex items-center gap-1 rounded-lg border border-black/80 bg-white px-2 py-1.5 text-xs font-medium text-main shadow-sm hover:bg-black/[0.03] disabled:opacity-50"
                      :disabled="scrapingStatus.isActive"
                      @click="
                        () =>
                          void updatePropertyManagements([pm.slug], 'sync_only')
                      "
                    >
                      Sync
                      <LoadingSpinner
                        v-if="scrapePmLoading(pm.slug, 'sync_only')"
                        class="!h-4 !w-4"
                      />
                    </button>
                    <button
                      type="button"
                      title="Nur Extraktion"
                      class="inline-flex items-center gap-1 rounded-lg border border-black/80 bg-white px-2 py-1.5 text-xs font-medium text-main shadow-sm hover:bg-black/[0.03] disabled:opacity-50"
                      :disabled="scrapingStatus.isActive"
                      @click="
                        () =>
                          void updatePropertyManagements(
                            [pm.slug],
                            'extract_only',
                          )
                      "
                    >
                      Extr.
                      <LoadingSpinner
                        v-if="scrapePmLoading(pm.slug, 'extract_only')"
                        class="!h-4 !w-4"
                      />
                    </button>
                  </div>
                </td>
              </tr>
              <tr
                v-if="jobsForPm(pm.slug)?.failedSamples?.length"
                class="border-b border-black/10 bg-red-50/40 last:border-b-0"
              >
                <td
                  colspan="6"
                  class="px-3 py-2"
                >
                  <ul class="space-y-2 text-xs">
                    <li
                      v-for="(s, i) in jobsForPm(pm.slug)!.failedSamples"
                      :key="i"
                    >
                      <div class="flex flex-wrap items-start gap-2">
                        <a
                          :href="s.url"
                          class="min-w-0 flex-1 break-all text-primary underline decoration-black/20 underline-offset-2"
                          target="_blank"
                          rel="noopener noreferrer"
                          >{{ s.url }}</a
                        >
                        <button
                          type="button"
                          class="shrink-0 rounded border border-black/30 bg-white px-2 py-0.5 font-medium text-main hover:bg-black/5 disabled:opacity-50"
                          :disabled="
                            retryingUrl != null || scrapingStatus.isActive
                          "
                          @click="() => void retryFailedJob(s.url)"
                        >
                          Erneut
                        </button>
                      </div>
                      <p
                        v-if="s.lastError"
                        class="mt-0.5 break-words text-red-800/90"
                        :title="s.lastError"
                      >
                        {{ truncateErr(s.lastError) }}
                      </p>
                    </li>
                  </ul>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="scraperOverviewData?.recentRuns?.length"
      class="space-y-3"
    >
      <h2 class="text-l font-semibold text-main">Läufe</h2>
      <div class="overflow-hidden rounded-3xl border border-black bg-white">
        <ul role="list">
          <li
            v-for="run in scraperOverviewData.recentRuns"
            :key="run.id"
            class="flex flex-col gap-1 border-b border-black/10 px-4 py-2.5 text-xs last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full sm:mt-0.5"
              :class="run.success ? 'bg-green-600' : 'bg-red-600'"
            />
            <span class="shrink-0 text-gray-600">{{
              formatAgo(run.createdAt)
            }}</span>
            <span class="font-medium text-main">{{
              runKindLabel(run.kind)
            }}</span>
            <span
              v-if="run.propertyManagementId"
              class="text-gray-500"
              >{{ run.propertyManagementId }}</span
            >
            <span
              v-if="run.durationMs != null"
              class="tabular-nums text-gray-500"
              >{{ run.durationMs }} ms</span
            >
            <span
              class="min-w-0 truncate text-gray-500 sm:ml-auto sm:max-w-[50%]"
              :title="run.statsSummary"
              >{{ run.statsSummary }}</span
            >
          </li>
        </ul>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-l font-semibold text-main">Benachrichtigungen</h2>
      <div
        v-if="notifyFeedback"
        role="status"
        class="text-sm rounded-2xl border px-4 py-3"
        :class="
          notifyFeedback.ok
            ? 'border-green-800/35 bg-green-100/90 text-green-950'
            : 'border-red-600 bg-red-50 text-red-900'
        "
      >
        {{ notifyFeedback.msg }}
      </div>
      <div class="overflow-x-auto rounded-3xl border border-black bg-white">
        <table class="text-sm w-full min-w-[48rem] border-collapse text-left">
          <thead>
            <tr class="border-b border-black bg-background/50">
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Kanal / Ziel
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Filter
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Status
              </th>
              <th
                scope="col"
                class="px-3 py-3 text-right font-semibold tabular-nums text-main"
              >
                Gesendet
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Erstellt
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-semibold text-main"
              >
                Aktion
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sub in subscribers.data.value ?? []"
              :key="sub.id"
              class="border-b border-black/10 last:border-b-0"
            >
              <td class="max-w-[16rem] px-3 py-3 align-top">
                <span class="font-medium text-main">{{ sub.channel }}</span>
                <span
                  class="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-main"
                  >{{ sub.source }}</span
                >
                <p
                  class="truncate text-xs text-gray-500"
                  :title="sub.target"
                >
                  {{ sub.target }}
                </p>
              </td>
              <td class="max-w-[18rem] px-3 py-3 align-top text-main">
                {{ describeFlatFilter(sub.filter) }}
              </td>
              <td class="px-3 py-3 align-top">
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="h-2 w-2 shrink-0 rounded-full"
                    :class="sub.active ? 'bg-green-600' : 'bg-gray-400'"
                  />
                  <span class="text-xs font-medium text-main">{{
                    sub.active ? "Aktiv" : "Inaktiv"
                  }}</span>
                </span>
              </td>
              <td class="px-3 py-3 text-right align-top tabular-nums text-main">
                {{ sub.sentCount }}
              </td>
              <td class="px-3 py-3 align-top text-gray-600">
                {{ formatAgo(sub.createdAt) }}
              </td>
              <td class="px-3 py-3 align-top">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-black/80 bg-white px-2 py-1.5 text-xs font-medium text-main shadow-sm hover:bg-black/[0.03] disabled:opacity-50"
                  :disabled="testingSubscriberId != null"
                  @click="() => void sendTestNotification(sub.id)"
                >
                  Test senden
                  <LoadingSpinner
                    v-if="testingSubscriberId === sub.id"
                    class="!h-4 !w-4"
                  />
                </button>
              </td>
            </tr>
            <tr v-if="!(subscribers.data.value ?? []).length">
              <td
                colspan="6"
                class="px-3 py-6 text-center text-gray-500"
              >
                Keine Abonnenten.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
