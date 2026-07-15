<script setup lang="ts">
/**
 * Filters — query-composer intent bar.
 * Primary: price · rooms · place. Secondary (area/tags/PMs/telegram) behind Mehr.
 * Live URL commit. One open popover/sheet at a time.
 */
import {
  UNKNOWN_DISTRICT_ID,
  berlinDistricts,
  unknownDistrict,
} from "~/data/districts";
import { propertyManagementConfigs } from "~/data/propertyManagements/configs";
import { tags } from "~/data/tags";
import { type FlatFilter } from "~/lib/flat-filters";

const props = withDefaults(
  defineProps<{
    resultCount?: number | null;
    totalCount?: number | null;
    /** When false, count stays off the bar (page title owns it). Sheet footer still uses it. */
    showBarCount?: boolean;
    /** Mobile/tablet sort chip in the bar (desktop table owns sort). */
    showSort?: boolean;
  }>(),
  { resultCount: null, totalCount: null, showBarCount: true, showSort: false },
);

const { updateQueryState, urlState } = useFlatFilterUrlState();
const { $client } = useNuxtApp();
const config = useRuntimeConfig();
const telegramEnabled = computed(() => !!config.public.telegramBotUsername);

const districtCountsQuery = await $client.flat.getDistrictCounts.useQuery();
const districtCounts = computed(
  () => districtCountsQuery.data.value ?? ({} as Record<string, number>),
);

type Segment = "price" | "rooms" | "place" | "more";

const preferences = reactive({
  priceMin: null as number | null,
  priceMax: null as number | null,
  roomsMin: null as number | null,
  roomsMax: null as number | null,
  areaMin: null as number | null,
  areaMax: null as number | null,
  tags: [] as string[],
  districts: [] as string[],
  propertyManagements: [] as string[],
});

const onlyNew = ref(false);
const rangeInputFocused = ref(false);
const openSegment = ref<Segment | null>(null);
const districtSearch = ref("");
const telegramLoading = ref(false);
const telegramError = ref<string | null>(null);

type PreferenceKey = keyof typeof preferences;

const FILTER_KEYS = [
  "priceMin",
  "priceMax",
  "roomsMin",
  "roomsMax",
  "areaMin",
  "areaMax",
  "tags",
  "districts",
  "propertyManagements",
] as const;

const NUMBER_KEYS = [
  "priceMin",
  "priceMax",
  "roomsMin",
  "roomsMax",
  "areaMin",
  "areaMax",
] as const;

const filterMetadata = {
  price: { min: 100, max: 10000 },
  rooms: { min: 1, max: 10 },
  area: { min: 1, max: 1000 },
} as const;

const pricePresets = [
  { label: "bis 800", max: 800 },
  { label: "bis 1200", max: 1200 },
  { label: "bis 1500", max: 1500 },
] as const;

const roomPresets = [
  { label: "1–2", min: 1, max: 2 },
  { label: "2–3", min: 2, max: 3 },
  { label: "3–4", min: 3, max: 4 },
] as const;

const areaPresets = [
  { label: "ab 40", min: 40 },
  { label: "ab 60", min: 60 },
  { label: "ab 80", min: 80 },
] as const;

const titleTagEntries = Object.entries(tags).filter(([id]) => id !== "new");

const districtEntries = [
  ...Object.entries(berlinDistricts)
    .map(([id, { name, shortName }]) => ({ id, title: name, shortName }))
    .sort((a, b) => a.title.localeCompare(b.title, "de")),
  {
    id: UNKNOWN_DISTRICT_ID,
    title: unknownDistrict.name,
    shortName: unknownDistrict.shortName,
  },
];

const propertyManagementEntries = Object.values(propertyManagementConfigs).map(
  ({ slug, name }) => ({ id: slug, title: name }),
);

const syncStateWithUrl = (includeNumbers = true) => {
  onlyNew.value = urlState.value.tags?.includes("new") ?? false;
  preferences.tags = urlState.value.tags?.filter((t) => t !== "new") ?? [];
  preferences.districts = urlState.value.districts ?? [];
  preferences.propertyManagements = urlState.value.propertyManagements ?? [];
  if (includeNumbers) {
    for (const key of NUMBER_KEYS) {
      preferences[key] = urlState.value[key]?.[0] ?? null;
    }
  }
};

syncStateWithUrl();

watch(urlState, () => {
  syncStateWithUrl(!rangeInputFocused.value);
});

const getFilterMetadata = (key: string) => {
  for (const [metaKey, meta] of Object.entries(filterMetadata)) {
    if (key.startsWith(metaKey)) return meta;
  }
  return null;
};

/** Meta min/max alone are no-ops (e.g. roomsMax=10) — treat as unset. */
const effectiveRange = (
  kind: keyof typeof filterMetadata,
  min: number | null,
  max: number | null,
) => {
  const meta = filterMetadata[kind];
  return {
    min: min != null && min > meta.min ? min : null,
    max: max != null && max < meta.max ? max : null,
  };
};

const hasMeaningfulRange = (
  kind: keyof typeof filterMetadata,
  min: number | null,
  max: number | null,
) => {
  const e = effectiveRange(kind, min, max);
  return e.min != null || e.max != null;
};

const isBoundaryValue = (key: string, value: number) => {
  const meta = getFilterMetadata(key);
  if (!meta) return false;
  if (key.endsWith("Min")) return value <= meta.min;
  if (key.endsWith("Max")) return value >= meta.max;
  return false;
};

const clampPreference = (key: string, value: number): number => {
  const meta = getFilterMetadata(key);
  return meta ? Math.min(Math.max(value, meta.min), meta.max) : value;
};

const parsePreferenceNumber = (
  key: PreferenceKey,
  value: number | string | null,
): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return null;
  const clamped = clampPreference(key, n);
  return isBoundaryValue(key, clamped) ? null : clamped;
};

const districtFilterCount = computed(() => {
  const n = preferences.districts.length;
  if (n === 0 || n === districtEntries.length) return 0;
  return n;
});

const moreActiveCount = computed(() => {
  let n = 0;
  if (hasMeaningfulRange("area", preferences.areaMin, preferences.areaMax))
    n += 1;
  if (onlyNew.value) n += 1;
  n += preferences.tags.length;
  n += preferences.propertyManagements.length;
  return n;
});

const activePrefsCount = computed(() => {
  let n = 0;
  if (hasMeaningfulRange("price", preferences.priceMin, preferences.priceMax))
    n += 1;
  if (hasMeaningfulRange("rooms", preferences.roomsMin, preferences.roomsMax))
    n += 1;
  n += districtFilterCount.value;
  n += moreActiveCount.value;
  return n;
});

const formatRange = (min: number | null, max: number | null, unit: string) => {
  if (min != null && max != null) return `${min}–${max} ${unit}`;
  if (min != null) return `ab ${min} ${unit}`;
  if (max != null) return `bis ${max} ${unit}`;
  return "";
};

const priceLabel = computed(() => {
  const e = effectiveRange("price", preferences.priceMin, preferences.priceMax);
  if (e.min == null && e.max == null) return "Warmmiete";
  return formatRange(e.min, e.max, "€");
});

const roomsLabel = computed(() => {
  const e = effectiveRange("rooms", preferences.roomsMin, preferences.roomsMax);
  if (e.min == null && e.max == null) return "Zimmer";
  return formatRange(e.min, e.max, "Zi.");
});

const placeLabel = computed(() => {
  const n = preferences.districts.length;
  if (n === 0 || n === districtEntries.length) return "Ort";
  if (n === 1) {
    const id = preferences.districts[0]!;
    if (id === UNKNOWN_DISTRICT_ID) return unknownDistrict.shortName;
    return (
      berlinDistricts[id as keyof typeof berlinDistricts]?.shortName ?? "Ort"
    );
  }
  return `${n} Orte`;
});

const moreLabel = computed(() =>
  moreActiveCount.value ? `Mehr · ${moreActiveCount.value}` : "Mehr",
);

const resultLabel = computed(() => {
  const filtered = props.resultCount;
  const total = props.totalCount;
  if (filtered == null) return null;
  if (filtered === 0) return "Keine";
  if (total != null && filtered !== total) return `${filtered} von ${total}`;
  return `${filtered}`;
});

const panelTitle = computed(() => {
  switch (openSegment.value) {
    case "price":
      return "Warmmiete";
    case "rooms":
      return "Zimmer";
    case "place":
      return "Ort";
    case "more":
      return "Weitere Filter";
    default:
      return "";
  }
});

const filteredDistrictEntries = computed(() => {
  const query = districtSearch.value.trim().toLocaleLowerCase("de");
  if (!query) return districtEntries;
  return districtEntries.filter(({ title, shortName }) =>
    `${title} ${shortName}`.toLocaleLowerCase("de").includes(query),
  );
});

const commitFilters = () => {
  const query: Record<string, number | number[] | string[] | null | string> =
    {};
  for (const key of NUMBER_KEYS) {
    const parsed = parsePreferenceNumber(key, preferences[key]);
    query[key] = parsed != null ? [parsed] : null;
  }
  const allTags = [...preferences.tags, ...(onlyNew.value ? ["new"] : [])];
  query.tags = allTags.length ? allTags : null;
  query.districts = preferences.districts.length ? preferences.districts : null;
  query.propertyManagements = preferences.propertyManagements.length
    ? preferences.propertyManagements
    : null;
  updateQueryState(query);
};

let numberCommitTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleNumberCommit = () => {
  if (numberCommitTimer) clearTimeout(numberCommitTimer);
  numberCommitTimer = setTimeout(() => {
    numberCommitTimer = null;
    commitFilters();
  }, 350);
};

const flushNumberCommit = () => {
  if (numberCommitTimer) {
    clearTimeout(numberCommitTimer);
    numberCommitTimer = null;
  }
  commitFilters();
};

const resetFilters = () => {
  if (numberCommitTimer) {
    clearTimeout(numberCommitTimer);
    numberCommitTimer = null;
  }
  for (const key of NUMBER_KEYS) preferences[key] = null;
  preferences.tags = [];
  preferences.districts = [];
  preferences.propertyManagements = [];
  onlyNew.value = false;
  const query: Record<string, null> = {};
  for (const key of FILTER_KEYS) query[key] = null;
  updateQueryState(query);
  openSegment.value = null;
};

const toggleChip = (list: string[], id: string) => {
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  commitFilters();
};

const applyPricePreset = (max: number) => {
  if (preferences.priceMin == null && preferences.priceMax === max) {
    preferences.priceMin = null;
    preferences.priceMax = null;
  } else {
    preferences.priceMin = null;
    preferences.priceMax = max;
  }
  flushNumberCommit();
};

const applyRoomPreset = (min: number, max: number) => {
  if (preferences.roomsMin === min && preferences.roomsMax === max) {
    preferences.roomsMin = null;
    preferences.roomsMax = null;
  } else {
    preferences.roomsMin = min;
    preferences.roomsMax = max;
  }
  flushNumberCommit();
};

const applyAreaPreset = (min: number) => {
  if (preferences.areaMin === min && preferences.areaMax == null) {
    preferences.areaMin = null;
    preferences.areaMax = null;
  } else {
    preferences.areaMin = min;
    preferences.areaMax = null;
  }
  flushNumberCommit();
};

const buildFilterFromPrefs = (): FlatFilter => {
  const num = (key: (typeof NUMBER_KEYS)[number]) =>
    parsePreferenceNumber(key, preferences[key]) ?? undefined;
  const allTags = [...preferences.tags, ...(onlyNew.value ? ["new"] : [])];
  return {
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    roomsMin: num("roomsMin"),
    roomsMax: num("roomsMax"),
    areaMin: num("areaMin"),
    areaMax: num("areaMax"),
    tags: allTags.length ? allTags : undefined,
    districts: preferences.districts.length ? preferences.districts : undefined,
    propertyManagements: preferences.propertyManagements.length
      ? (preferences.propertyManagements as FlatFilter["propertyManagements"])
      : undefined,
  };
};

const notifyOnTelegram = async () => {
  telegramError.value = null;
  telegramLoading.value = true;
  const popup = window.open("about:blank", "_blank");
  try {
    const { url } = await $client.notification.createTelegramLink.mutate(
      buildFilterFromPrefs(),
    );
    if (popup) {
      popup.opener = null;
      popup.location.replace(url);
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    popup?.close();
    const code =
      e && typeof e === "object" && "data" in e
        ? (e as { data?: { code?: string } }).data?.code
        : undefined;
    telegramError.value =
      (code === "TOO_MANY_REQUESTS" || code === "PRECONDITION_FAILED") &&
      e instanceof Error
        ? e.message
        : "Konnte den Telegram-Link nicht erstellen.";
  } finally {
    telegramLoading.value = false;
  }
};

const openPanel = (segment: Segment) => {
  if (openSegment.value === segment) {
    closePanel();
    return;
  }
  if (segment === "place") districtSearch.value = "";
  openSegment.value = segment;
};

const closePanel = () => {
  openSegment.value = null;
  flushNumberCommit();
};

const onRangeFocus = () => {
  rangeInputFocused.value = true;
};

const onRangeBlur = () => {
  rangeInputFocused.value = false;
  flushNumberCommit();
};

const onWindowKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && openSegment.value) closePanel();
};

watch(openSegment, (open) => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = open ? "hidden" : "";
});

const stripNoOpRangeBoundsFromUrl = () => {
  let dirty = false;
  for (const key of NUMBER_KEYS) {
    const raw = preferences[key];
    if (raw != null && isBoundaryValue(key, raw)) {
      preferences[key] = null;
      dirty = true;
    }
  }
  if (dirty) commitFilters();
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
  stripNoOpRangeBoundsFromUrl();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onWindowKeydown);
  if (numberCommitTimer) clearTimeout(numberCommitTimer);
  if (typeof document !== "undefined") document.body.style.overflow = "";
});

const segmentBtn = (active: boolean, filled: boolean) =>
  [
    "inline-flex shrink-0 items-center gap-1 text-s text-black",
    active || filled ? "font-semibold" : "font-medium",
  ].join(" ");

const segmentChevronClass = (open: boolean) =>
  ["size-4 transition-transform", open ? "rotate-180" : ""].join(" ");

const fieldClass =
  "w-full min-w-0 rounded-xl border border-black bg-white py-2 text-s text-main placeholder:text-main/45 outline-none ring-0 focus:border-black";

const inputClass = `filter-num ${fieldClass} pl-2.5 pr-7 text-center tabular-nums`;

/** Same language as Apartment/Provider + Tag pills. */
const pillClass = (active: boolean) =>
  [
    "py-0.25 inline-flex shrink-0 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
    active
      ? "border-main/40 bg-main/10 text-main"
      : "border-main/20 bg-transparent text-main/60 hover:border-main/35 hover:text-main",
  ].join(" ");

const labelClass = "mb-1.5 block text-xs font-medium text-main";
const metaClass = "text-xs text-main/50";

const sortSelectOptions = [
  { value: "main", label: "Neueste" },
  { value: "coldRentPrice", label: "Kaltmiete" },
  { value: "warmRentPrice", label: "Warmmiete" },
  { value: "rentPricePerSquareMeter", label: "€/m²" },
  { value: "roomCount", label: "Zimmer" },
  { value: "usableArea", label: "Fläche" },
] as const;

type SortValue = (typeof sortSelectOptions)[number]["value"];

const currentSortBy = computed(
  (): SortValue => (urlState.value.orderBy?.[0] as SortValue) ?? "main",
);
const currentSortOrder = computed(
  () =>
    urlState.value.order?.[0] ??
    (currentSortBy.value === "main" ? "desc" : "asc"),
);
const sortFilled = computed(() => currentSortBy.value !== "main");
const currentSortLabel = computed(
  () =>
    sortSelectOptions.find((o) => o.value === currentSortBy.value)?.label ??
    "Neueste",
);

const setSortBy = (value: string) => {
  const orderBy = value as SortValue;
  updateQueryState({
    orderBy: [orderBy],
    order: [orderBy === "main" ? "desc" : "asc"],
  });
};

const toggleSortOrder = () => {
  updateQueryState({
    orderBy: [currentSortBy.value],
    order: [currentSortOrder.value === "asc" ? "desc" : "asc"],
  });
};
</script>

<template>
  <div class="filters-root mb-8">
    <div
      class="sticky top-0 z-10 overflow-hidden rounded-xl border border-black bg-background"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:gap-4 sm:px-2.5 sm:py-2.5"
      >
        <!-- Row 1: filter segments (scroll on narrow) -->
        <div
          class="min-w-0 flex-1 overflow-x-auto px-2.5 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden"
        >
          <div class="flex w-max min-w-full items-center gap-x-5">
            <span class="sr-only">Filter</span>
            <button
              type="button"
              :class="
                segmentBtn(
                  openSegment === 'price',
                  hasMeaningfulRange(
                    'price',
                    preferences.priceMin,
                    preferences.priceMax,
                  ),
                )
              "
              :aria-expanded="openSegment === 'price'"
              @click="openPanel('price')"
            >
              {{ priceLabel }}
              <Icon
                name="lucide:chevron-down"
                :class="segmentChevronClass(openSegment === 'price')"
              />
            </button>
            <button
              type="button"
              :class="
                segmentBtn(
                  openSegment === 'rooms',
                  hasMeaningfulRange(
                    'rooms',
                    preferences.roomsMin,
                    preferences.roomsMax,
                  ),
                )
              "
              :aria-expanded="openSegment === 'rooms'"
              @click="openPanel('rooms')"
            >
              {{ roomsLabel }}
              <Icon
                name="lucide:chevron-down"
                :class="segmentChevronClass(openSegment === 'rooms')"
              />
            </button>
            <button
              type="button"
              :class="
                segmentBtn(openSegment === 'place', districtFilterCount > 0)
              "
              :aria-expanded="openSegment === 'place'"
              @click="openPanel('place')"
            >
              {{ placeLabel }}
              <Icon
                name="lucide:chevron-down"
                :class="segmentChevronClass(openSegment === 'place')"
              />
            </button>
            <button
              type="button"
              :class="segmentBtn(openSegment === 'more', moreActiveCount > 0)"
              :aria-expanded="openSegment === 'more'"
              @click="openPanel('more')"
            >
              {{ moreLabel }}
              <Icon
                name="lucide:chevron-down"
                :class="segmentChevronClass(openSegment === 'more')"
              />
            </button>
          </div>
        </div>

        <!-- Row 2 (mobile) / right cluster (desktop): count · sort · actions -->
        <div
          v-if="showBarCount || showSort || activePrefsCount"
          class="flex items-center gap-3 border-t border-black px-2.5 py-2.5 sm:shrink-0 sm:border-0 sm:px-0 sm:py-0"
        >
          <div
            v-if="(showBarCount && resultLabel) || showSort"
            class="flex min-w-0 items-center gap-3"
          >
            <p
              v-if="showBarCount && resultLabel"
              class="text-xs tabular-nums leading-none text-black"
            >
              {{ resultLabel }} Wohnungen
            </p>
            <div
              v-if="showSort"
              class="inline-flex shrink-0 items-center gap-1 text-s text-black"
              :class="sortFilled ? 'font-semibold' : 'font-medium'"
            >
              <button
                type="button"
                class="inline-flex size-6 shrink-0 items-center justify-center"
                :aria-label="
                  currentSortOrder === 'asc'
                    ? 'Aufsteigend, umkehren'
                    : 'Absteigend, umkehren'
                "
                :title="
                  currentSortOrder === 'asc' ? 'Aufsteigend' : 'Absteigend'
                "
                @click="toggleSortOrder"
                @mouseenter="
                  (e) => {
                    const icon = (e.currentTarget as HTMLElement).querySelector(
                      'lord-icon',
                    ) as any;
                    if (
                      icon?.playerInstance &&
                      !icon.playerInstance.isPlaying
                    ) {
                      icon.playerInstance.playFromBeginning();
                    }
                  }
                "
              >
                <lord-icon
                  icon="arrow"
                  src="/icons/arrow.json"
                  state="hover-pinch"
                  class="block -rotate-90 text-black transition-all duration-500"
                  :class="{
                    '-scale-x-100': currentSortOrder === 'desc',
                  }"
                  style="width: 22px; height: 22px"
                />
              </button>
              <label
                class="sr-only"
                for="filter-bar-sort"
                >Sortierung</label
              >
              <span class="relative inline-grid">
                <span
                  class="invisible col-start-1 row-start-1 whitespace-nowrap"
                  aria-hidden="true"
                  >{{ currentSortLabel }}</span
                >
                <select
                  id="filter-bar-sort"
                  class="col-start-1 row-start-1 w-full cursor-pointer appearance-none bg-transparent text-s text-black focus:outline-none"
                  :class="sortFilled ? 'font-semibold' : 'font-medium'"
                  :value="currentSortBy"
                  @change="
                    setSortBy(($event.target as HTMLSelectElement).value)
                  "
                >
                  <option
                    v-for="opt in sortSelectOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </span>
            </div>
          </div>
          <div
            v-if="activePrefsCount"
            class="ml-auto flex shrink-0 items-center gap-1"
          >
            <button
              type="button"
              class="inline-flex size-6 shrink-0 items-center justify-center"
              aria-label="Filter zurücksetzen"
              title="Filter zurücksetzen"
              @click="resetFilters"
            >
              <lord-icon
                icon="trash"
                src="/icons/trash.json"
                trigger="hover"
                class="current-color block text-black md:hover:animate-zoombounce"
                style="width: 24px; height: 24px"
              />
            </button>
            <button
              v-if="telegramEnabled"
              type="button"
              class="inline-flex size-6 shrink-0 items-center justify-center disabled:opacity-60"
              :disabled="telegramLoading"
              :aria-label="
                telegramLoading
                  ? 'Link wird erstellt'
                  : 'Per Telegram benachrichtigen'
              "
              title="Per Telegram benachrichtigen"
              @click="notifyOnTelegram"
            >
              <lord-icon
                icon="notification-bell"
                src="/icons/notification-bell.json"
                trigger="hover"
                class="current-color block text-black md:hover:animate-zoombounce"
                style="width: 24px; height: 24px"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <p
      v-if="telegramError && !openSegment"
      class="mt-1.5 text-xs text-red-600"
    >
      {{ telegramError }}
    </p>

    <Teleport to="body">
      <div
        v-if="openSegment"
        class="fixed inset-0 z-50 flex items-end justify-center bg-main/25 sm:items-start sm:justify-center sm:px-4 sm:pt-28"
        @click.self="closePanel"
      >
        <div
          class="flex max-h-[85vh] w-full flex-col rounded-t-xl border border-black bg-white sm:max-h-[min(70vh,32rem)] sm:w-full sm:max-w-md sm:rounded-xl"
          role="dialog"
          aria-modal="true"
          :aria-label="panelTitle"
        >
          <div
            class="flex items-center justify-between gap-3 px-5 pb-1 pt-4 sm:px-6"
          >
            <p class="text-m font-semibold text-main">{{ panelTitle }}</p>
            <button
              type="button"
              class="shrink-0 text-black"
              aria-label="Schließen"
              @click="closePanel"
            >
              <Icon
                name="lucide:x"
                class="size-6 stroke-[2.5]"
              />
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <!-- Price -->
            <div
              v-if="openSegment === 'price'"
              class="flex flex-col gap-3"
            >
              <div class="flex items-center gap-1.5">
                <div class="relative min-w-0 flex-1">
                  <input
                    v-model="preferences.priceMin"
                    type="number"
                    inputmode="numeric"
                    :class="inputClass"
                    placeholder="ab"
                    :min="filterMetadata.price.min"
                    :max="filterMetadata.price.max"
                    aria-label="Warmmiete mindestens"
                    @focus="onRangeFocus"
                    @input="scheduleNumberCommit"
                    @blur="onRangeBlur"
                  />
                  <span
                    class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-main/40"
                    aria-hidden="true"
                    >€</span
                  >
                </div>
                <span
                  class="text-main/40"
                  aria-hidden="true"
                  >–</span
                >
                <div class="relative min-w-0 flex-1">
                  <input
                    v-model="preferences.priceMax"
                    type="number"
                    inputmode="numeric"
                    :class="inputClass"
                    placeholder="bis"
                    :min="filterMetadata.price.min"
                    :max="filterMetadata.price.max"
                    aria-label="Warmmiete höchstens"
                    @focus="onRangeFocus"
                    @input="scheduleNumberCommit"
                    @blur="onRangeBlur"
                  />
                  <span
                    class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-main/40"
                    aria-hidden="true"
                    >€</span
                  >
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="p in pricePresets"
                  :key="p.label"
                  type="button"
                  :class="
                    pillClass(
                      preferences.priceMin == null &&
                        preferences.priceMax === p.max,
                    )
                  "
                  @click="applyPricePreset(p.max)"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>

            <!-- Rooms -->
            <div
              v-else-if="openSegment === 'rooms'"
              class="flex flex-col gap-3"
            >
              <div class="flex items-center gap-1.5">
                <div class="relative min-w-0 flex-1">
                  <input
                    v-model="preferences.roomsMin"
                    type="number"
                    inputmode="numeric"
                    :class="inputClass"
                    placeholder="ab"
                    :min="filterMetadata.rooms.min"
                    :max="filterMetadata.rooms.max"
                    aria-label="Zimmer mindestens"
                    @focus="onRangeFocus"
                    @input="scheduleNumberCommit"
                    @blur="onRangeBlur"
                  />
                  <span
                    class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-main/40"
                    aria-hidden="true"
                    >Zi.</span
                  >
                </div>
                <span
                  class="text-main/40"
                  aria-hidden="true"
                  >–</span
                >
                <div class="relative min-w-0 flex-1">
                  <input
                    v-model="preferences.roomsMax"
                    type="number"
                    inputmode="numeric"
                    :class="inputClass"
                    placeholder="bis"
                    :min="filterMetadata.rooms.min"
                    :max="filterMetadata.rooms.max"
                    aria-label="Zimmer höchstens"
                    @focus="onRangeFocus"
                    @input="scheduleNumberCommit"
                    @blur="onRangeBlur"
                  />
                  <span
                    class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-main/40"
                    aria-hidden="true"
                    >Zi.</span
                  >
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="p in roomPresets"
                  :key="p.label"
                  type="button"
                  :class="
                    pillClass(
                      preferences.roomsMin === p.min &&
                        preferences.roomsMax === p.max,
                    )
                  "
                  @click="applyRoomPreset(p.min, p.max)"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>

            <!-- Place -->
            <div
              v-else-if="openSegment === 'place'"
              class="flex flex-col gap-3"
            >
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="text-xs text-main/55 underline-offset-2 hover:text-accent hover:underline disabled:opacity-30"
                  :disabled="
                    preferences.districts.length === districtEntries.length
                  "
                  @click="
                    preferences.districts = districtEntries.map(({ id }) => id);
                    commitFilters();
                  "
                >
                  Alle
                </button>
                <button
                  type="button"
                  class="text-xs text-main/55 underline-offset-2 hover:text-accent hover:underline disabled:opacity-30"
                  :disabled="preferences.districts.length === 0"
                  @click="
                    preferences.districts = [];
                    commitFilters();
                  "
                >
                  Keine
                </button>
                <span
                  v-if="districtFilterCount"
                  :class="[metaClass, 'ml-auto']"
                >
                  {{ districtFilterCount }} gewählt
                </span>
              </div>
              <label class="relative block">
                <Icon
                  name="lucide:search"
                  class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-main/45"
                />
                <input
                  v-model="districtSearch"
                  type="search"
                  :class="[fieldClass, 'pl-9 pr-3']"
                  placeholder="Bezirk suchen…"
                  aria-label="Bezirk suchen"
                />
              </label>
              <div class="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                <button
                  v-for="{ id, title } in filteredDistrictEntries"
                  :key="id"
                  type="button"
                  class="grid grid-cols-[minmax(0,1fr)_2.75rem_1rem] items-center gap-x-2 rounded-md px-2.5 py-2 text-left text-s hover:bg-main/5"
                  :aria-pressed="preferences.districts.includes(id)"
                  @click="toggleChip(preferences.districts, id)"
                >
                  <span class="truncate text-main">{{ title }}</span>
                  <span
                    :class="[metaClass, 'text-right tabular-nums']"
                    :aria-label="`${districtCounts[id] ?? 0} Wohnungen`"
                  >
                    {{ districtCounts[id] ?? 0 }}
                  </span>
                  <span class="flex size-4 items-center justify-center">
                    <Icon
                      v-if="preferences.districts.includes(id)"
                      name="lucide:check"
                      class="size-4 text-accent"
                    />
                  </span>
                </button>
                <p
                  v-if="!filteredDistrictEntries.length"
                  :class="metaClass"
                >
                  Kein Bezirk gefunden.
                </p>
              </div>
            </div>

            <!-- More -->
            <div
              v-else-if="openSegment === 'more'"
              class="flex flex-col gap-5"
            >
              <div>
                <label :class="labelClass">Fläche</label>
                <div class="flex items-center gap-1.5">
                  <div class="relative min-w-0 flex-1">
                    <input
                      v-model="preferences.areaMin"
                      type="number"
                      inputmode="numeric"
                      :class="inputClass"
                      placeholder="ab"
                      :min="filterMetadata.area.min"
                      :max="filterMetadata.area.max"
                      aria-label="Fläche mindestens"
                      @focus="onRangeFocus"
                      @input="scheduleNumberCommit"
                      @blur="onRangeBlur"
                    />
                    <span
                      class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-main/40"
                      aria-hidden="true"
                      >m²</span
                    >
                  </div>
                  <span
                    class="text-main/40"
                    aria-hidden="true"
                    >–</span
                  >
                  <div class="relative min-w-0 flex-1">
                    <input
                      v-model="preferences.areaMax"
                      type="number"
                      inputmode="numeric"
                      :class="inputClass"
                      placeholder="bis"
                      :min="filterMetadata.area.min"
                      :max="filterMetadata.area.max"
                      aria-label="Fläche höchstens"
                      @focus="onRangeFocus"
                      @input="scheduleNumberCommit"
                      @blur="onRangeBlur"
                    />
                    <span
                      class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-main/40"
                      aria-hidden="true"
                      >m²</span
                    >
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <button
                    v-for="p in areaPresets"
                    :key="p.label"
                    type="button"
                    :class="
                      pillClass(
                        preferences.areaMin === p.min &&
                          preferences.areaMax == null,
                      )
                    "
                    @click="applyAreaPreset(p.min)"
                  >
                    {{ p.label }}
                  </button>
                </div>
              </div>

              <div>
                <p :class="labelClass">Merkmale</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    :class="pillClass(onlyNew)"
                    :aria-pressed="onlyNew"
                    @click="
                      onlyNew = !onlyNew;
                      commitFilters();
                    "
                  >
                    {{ tags.new }}
                  </button>
                  <button
                    v-for="[id, title] in titleTagEntries"
                    :key="id"
                    type="button"
                    :class="pillClass(preferences.tags.includes(id))"
                    :aria-pressed="preferences.tags.includes(id)"
                    @click="toggleChip(preferences.tags, id)"
                  >
                    {{ title }}
                  </button>
                </div>
              </div>

              <div>
                <p :class="labelClass">Verwaltungen</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="{ id, title } in propertyManagementEntries"
                    :key="id"
                    type="button"
                    :class="
                      pillClass(preferences.propertyManagements.includes(id))
                    "
                    :aria-pressed="preferences.propertyManagements.includes(id)"
                    @click="toggleChip(preferences.propertyManagements, id)"
                  >
                    {{ title }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="pb-5 pl-7 pr-5 pt-1 sm:pb-6 sm:pl-8 sm:pr-6">
            <FatButton
              class="w-full"
              :action="closePanel"
            >
              {{ resultLabel ? `${resultLabel} Wohnungen anzeigen` : "Fertig" }}
            </FatButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.filter-num {
  appearance: textfield;
}
.filter-num::-webkit-outer-spin-button,
.filter-num::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .filters-root * {
    transition: none !important;
  }
}
</style>
