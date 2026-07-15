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
  }>(),
  { resultCount: null, totalCount: null },
);

const { updateQueryState, urlState } = useFlatFilterUrlState();
const { $client } = useNuxtApp();
const config = useRuntimeConfig();
const telegramEnabled = computed(() => !!config.public.telegramBotUsername);

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
  { label: "bis 900", max: 900 },
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

const hasRange = (min: number | null, max: number | null) =>
  typeof min === "number" || typeof max === "number";

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
  return clampPreference(key, n);
};

const districtFilterCount = computed(() => {
  const n = preferences.districts.length;
  if (n === 0 || n === districtEntries.length) return 0;
  return n;
});

const moreActiveCount = computed(() => {
  let n = 0;
  if (hasRange(preferences.areaMin, preferences.areaMax)) n += 1;
  if (onlyNew.value) n += 1;
  n += preferences.tags.length;
  n += preferences.propertyManagements.length;
  return n;
});

const activePrefsCount = computed(() => {
  let n = 0;
  if (hasRange(preferences.priceMin, preferences.priceMax)) n += 1;
  if (hasRange(preferences.roomsMin, preferences.roomsMax)) n += 1;
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
  if (!hasRange(preferences.priceMin, preferences.priceMax)) return "Warmmiete";
  return formatRange(preferences.priceMin, preferences.priceMax, "€");
});

const roomsLabel = computed(() => {
  if (!hasRange(preferences.roomsMin, preferences.roomsMax)) return "Zimmer";
  return formatRange(preferences.roomsMin, preferences.roomsMax, "Zi.");
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
  if (n === 2) {
    return preferences.districts
      .map((id) => {
        if (id === UNKNOWN_DISTRICT_ID) return unknownDistrict.shortName;
        return (
          berlinDistricts[id as keyof typeof berlinDistricts]?.shortName ?? id
        );
      })
      .join(" / ");
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

onMounted(() => window.addEventListener("keydown", onWindowKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onWindowKeydown);
  if (numberCommitTimer) clearTimeout(numberCommitTimer);
  if (typeof document !== "undefined") document.body.style.overflow = "";
});

const segmentBtn = (active: boolean, filled: boolean) =>
  [
    "rounded-md px-2.5 py-1.5 text-s font-medium transition-colors",
    active
      ? "bg-secondary text-primary"
      : filled
        ? "text-main hover:bg-white"
        : "text-main/55 hover:bg-white hover:text-main",
  ].join(" ");

const inputClass =
  "filter-num w-full min-w-0 rounded-md border border-main/20 bg-white py-2 pl-2.5 pr-7 text-center text-s tabular-nums text-main placeholder:text-main/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

const presetClass = (active: boolean) =>
  [
    "rounded-md border px-2.5 py-1 text-xs font-medium",
    active
      ? "border-accent bg-secondary text-primary"
      : "border-main/20 bg-white text-main/65 hover:border-accent hover:text-accent",
  ].join(" ");

const chipClass = (selected: boolean) =>
  [
    "rounded-full border px-3 py-1.5 text-xs font-medium",
    selected
      ? "border-accent bg-accent text-white"
      : "border-main/20 bg-white text-main hover:border-accent hover:text-accent",
  ].join(" ");

const labelClass = "mb-1.5 block text-xs font-medium text-main";
const metaClass = "text-xs text-main/50";
</script>

<template>
  <div class="filters-root mb-4">
    <div class="sticky top-0 z-30 rounded-xl bg-background px-3 py-2.5 sm:px-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div class="flex items-center justify-between gap-2 sm:contents">
          <span class="shrink-0 text-xs font-medium text-main/50">Filter</span>
          <div class="flex items-center gap-1 sm:order-last sm:ml-auto">
            <p
              v-if="resultLabel"
              class="mr-1 hidden text-xs tabular-nums text-main/55 sm:block"
            >
              {{ resultLabel }} Wohnungen
            </p>
            <button
              v-if="activePrefsCount"
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-md text-main/55 hover:bg-white hover:text-accent"
              aria-label="Filter zurücksetzen"
              title="Filter zurücksetzen"
              @click="resetFilters"
            >
              <Icon
                name="lucide:rotate-ccw"
                class="size-3.5"
              />
            </button>
            <button
              v-if="telegramEnabled && activePrefsCount"
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-md text-accent hover:bg-white disabled:opacity-60"
              :disabled="telegramLoading"
              :aria-label="
                telegramLoading
                  ? 'Link wird erstellt'
                  : 'Per Telegram benachrichtigen'
              "
              :title="'Per Telegram benachrichtigen'"
              @click="notifyOnTelegram"
            >
              <Icon
                name="lucide:bell"
                class="size-4"
              />
            </button>
          </div>
        </div>

        <div
          class="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            class="shrink-0"
            :class="
              segmentBtn(
                openSegment === 'price',
                hasRange(preferences.priceMin, preferences.priceMax),
              )
            "
            :aria-expanded="openSegment === 'price'"
            @click="openPanel('price')"
          >
            {{ priceLabel }}
          </button>
          <button
            type="button"
            class="shrink-0"
            :class="
              segmentBtn(
                openSegment === 'rooms',
                hasRange(preferences.roomsMin, preferences.roomsMax),
              )
            "
            :aria-expanded="openSegment === 'rooms'"
            @click="openPanel('rooms')"
          >
            {{ roomsLabel }}
          </button>
          <button
            type="button"
            class="shrink-0"
            :class="
              segmentBtn(openSegment === 'place', districtFilterCount > 0)
            "
            :aria-expanded="openSegment === 'place'"
            @click="openPanel('place')"
          >
            {{ placeLabel }}
          </button>
          <button
            type="button"
            class="shrink-0"
            :class="segmentBtn(openSegment === 'more', moreActiveCount > 0)"
            :aria-expanded="openSegment === 'more'"
            @click="openPanel('more')"
          >
            {{ moreLabel }}
            <Icon
              name="lucide:chevron-down"
              class="ml-0.5 inline size-3.5 opacity-60"
              :class="{ 'rotate-180': openSegment === 'more' }"
            />
          </button>
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
        class="fixed inset-0 z-50 flex items-end justify-center bg-main/40 sm:items-start sm:justify-center sm:px-4 sm:pt-28"
        @click.self="closePanel"
      >
        <div
          class="flex max-h-[85vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:max-h-[min(70vh,32rem)] sm:w-full sm:max-w-md sm:rounded-xl"
          role="dialog"
          aria-modal="true"
          :aria-label="panelTitle"
        >
          <div
            class="flex items-center justify-between gap-2 border-b border-main/10 px-4 py-3"
          >
            <p class="text-s font-medium text-main">{{ panelTitle }}</p>
            <button
              type="button"
              class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-main/60 hover:bg-main/5 hover:text-main"
              aria-label="Schließen"
              @click="closePanel"
            >
              <Icon
                name="lucide:x"
                class="size-5"
              />
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-4">
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
                    presetClass(
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
                    presetClass(
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
                  class="w-full rounded-md border border-main/20 bg-white py-2 pl-9 pr-3 text-s text-main placeholder:text-main/45 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  placeholder="Bezirk suchen…"
                  aria-label="Bezirk suchen"
                />
              </label>
              <div class="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                <button
                  v-for="{ id, title } in filteredDistrictEntries"
                  :key="id"
                  type="button"
                  class="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-s hover:bg-background"
                  :aria-pressed="preferences.districts.includes(id)"
                  @click="toggleChip(preferences.districts, id)"
                >
                  <span class="text-main">{{ title }}</span>
                  <Icon
                    v-if="preferences.districts.includes(id)"
                    name="lucide:check"
                    class="size-4 shrink-0 text-accent"
                  />
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
                      presetClass(
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
                    :class="chipClass(onlyNew)"
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
                    :class="chipClass(preferences.tags.includes(id))"
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
                      chipClass(preferences.propertyManagements.includes(id))
                    "
                    :aria-pressed="preferences.propertyManagements.includes(id)"
                    @click="toggleChip(preferences.propertyManagements, id)"
                  >
                    {{ title }}
                  </button>
                </div>
              </div>

              <button
                v-if="telegramEnabled"
                type="button"
                class="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-accent/30 bg-white px-3 py-2 text-s font-medium text-accent hover:bg-secondary disabled:opacity-60"
                :disabled="telegramLoading"
                @click="notifyOnTelegram"
              >
                <Icon
                  name="lucide:bell"
                  class="size-4 shrink-0"
                />
                {{
                  telegramLoading
                    ? "Link wird erstellt…"
                    : "Per Telegram benachrichtigen"
                }}
              </button>
              <p
                v-if="telegramError"
                class="text-xs text-red-600"
              >
                {{ telegramError }}
              </p>
            </div>
          </div>

          <div class="border-t border-main/10 p-3 sm:p-4">
            <button
              type="button"
              class="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-accent px-4 py-2.5 text-s font-medium text-white hover:bg-primary"
              @click="closePanel"
            >
              {{ resultLabel ? `${resultLabel} Wohnungen anzeigen` : "Fertig" }}
            </button>
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
