<script setup lang="ts">
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

const onlyNew = ref(false);
const rangeInputFocused = ref(false);

const preferences = reactive({
  priceMin: null,
  priceMax: null,
  roomsMin: null,
  roomsMax: null,
  areaMin: null,
  areaMax: null,
  tags: [] as string[],
  districts: [] as string[],
  propertyManagements: [] as string[],
} as {
  priceMin: number | null;
  priceMax: number | null;
  roomsMin: number | null;
  roomsMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  tags: string[];
  districts: string[];
  propertyManagements: string[];
});

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
  price: { min: 100, max: 10000, unit: "€", label: "Warmmiete" },
  rooms: { min: 1, max: 10, unit: "Zi.", label: "Zimmer" },
  area: { min: 1, max: 1000, unit: "m²", label: "Fläche" },
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
  ({ slug, name }) => ({
    id: slug,
    title: name,
  }),
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
    if (key.startsWith(metaKey)) {
      return meta;
    }
  }
  return null;
};

const hasRange = (min: number | null, max: number | null) =>
  typeof min === "number" || typeof max === "number";

/** Counts filter groups, not every bound. */
const activePrefsCount = computed(() => {
  let n = 0;
  if (hasRange(preferences.priceMin, preferences.priceMax)) n += 1;
  if (hasRange(preferences.roomsMin, preferences.roomsMax)) n += 1;
  if (hasRange(preferences.areaMin, preferences.areaMax)) n += 1;
  if (onlyNew.value) n += 1;
  n += preferences.tags.length;
  n += districtFilterCount.value;
  n += preferences.propertyManagements.length;
  return n;
});

const districtSummary = computed(() => {
  const n = preferences.districts.length;
  if (n === 0 || n === districtEntries.length) return "alle Bezirke";
  if (n === 1) {
    const id = preferences.districts[0]!;
    if (id === UNKNOWN_DISTRICT_ID) return unknownDistrict.shortName;
    return (
      berlinDistricts[id as keyof typeof berlinDistricts]?.shortName ??
      "1 Bezirk"
    );
  }
  return `${n} Bezirke`;
});

/** Count districts only when a real subset is selected. */
const districtFilterCount = computed(() => {
  const n = preferences.districts.length;
  if (n === 0 || n === districtEntries.length) return 0;
  return n;
});

const resultLabel = computed(() => {
  const filtered = props.resultCount;
  const total = props.totalCount;
  if (filtered == null) return null;
  if (filtered === 0) return "Keine Wohnungen";
  if (total != null && filtered !== total) {
    return `${filtered} von ${total} Wohnungen`;
  }
  return `${filtered} Wohnungen`;
});

const telegramLoading = ref(false);
const telegramError = ref<string | null>(null);

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

const buildFilterFromDraft = (): FlatFilter => {
  const num = (key: PreferenceKey, v: number | string | null) => {
    const parsed = parsePreferenceNumber(key, v);
    return parsed ?? undefined;
  };
  const arr = (v: string[]) => (v.length ? v : undefined);
  const allTags = [...preferences.tags, ...(onlyNew.value ? ["new"] : [])];
  return {
    priceMin: num("priceMin", preferences.priceMin),
    priceMax: num("priceMax", preferences.priceMax),
    roomsMin: num("roomsMin", preferences.roomsMin),
    roomsMax: num("roomsMax", preferences.roomsMax),
    areaMin: num("areaMin", preferences.areaMin),
    areaMax: num("areaMax", preferences.areaMax),
    tags: arr(allTags),
    districts: arr(preferences.districts),
    propertyManagements: arr(
      preferences.propertyManagements,
    ) as FlatFilter["propertyManagements"],
  };
};

const buildFilterFromUrl = (): FlatFilter => {
  const s = urlState.value;
  const num = (key: PreferenceKey): number | undefined => {
    const v = s[key]?.[0];
    return typeof v === "number" ? v : undefined;
  };
  return {
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    roomsMin: num("roomsMin"),
    roomsMax: num("roomsMax"),
    areaMin: num("areaMin"),
    areaMax: num("areaMax"),
    tags: s.tags?.length ? s.tags : undefined,
    districts: s.districts?.length ? s.districts : undefined,
    propertyManagements: s.propertyManagements?.length
      ? (s.propertyManagements as FlatFilter["propertyManagements"])
      : undefined,
  };
};

const isDraftDirty = computed(() => {
  return (
    JSON.stringify(buildFilterFromDraft()) !==
    JSON.stringify(buildFilterFromUrl())
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

onUnmounted(() => {
  if (numberCommitTimer) clearTimeout(numberCommitTimer);
});

const resetFilters = () => {
  if (numberCommitTimer) {
    clearTimeout(numberCommitTimer);
    numberCommitTimer = null;
  }
  const query: Record<string, null> = {};
  for (const key of FILTER_KEYS) {
    query[key] = null;
  }
  updateQueryState(query);
};

const toggleChip = (list: string[], id: string) => {
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(id);
  }
  commitFilters();
};

const clearDistricts = () => {
  preferences.districts = [];
  commitFilters();
};

const selectAllDistricts = () => {
  preferences.districts = districtEntries.map(({ id }) => id);
  commitFilters();
};

const onOnlyNewChange = () => {
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

const notifyOnTelegram = async () => {
  telegramError.value = null;
  telegramLoading.value = true;
  const popup = window.open("about:blank", "_blank");
  if (isDraftDirty.value) {
    flushNumberCommit();
  }
  const filter = buildFilterFromDraft();
  try {
    const { url } =
      await $client.notification.createTelegramLink.mutate(filter);
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

const onRangeFocus = () => {
  rangeInputFocused.value = true;
};

const onRangeBlur = () => {
  rangeInputFocused.value = false;
  flushNumberCommit();
};

const rangeInputClass =
  "filter-num w-full min-w-0 rounded-md border border-black bg-white py-1.5 pl-2 pr-7 text-center text-sm tabular-nums text-main placeholder:text-main/35 focus:border-accent focus:outline-none";

const presetClass = (active: boolean) =>
  [
    "rounded-md border px-2 py-0.5 text-[0.65rem] font-medium",
    active
      ? "border-accent bg-accent/10 text-accent"
      : "border-black/20 bg-white text-main/60 hover:border-accent hover:text-accent",
  ].join(" ");

const chipClass = (selected: boolean) =>
  [
    "rounded-full border px-2.5 py-1 text-xs font-medium",
    selected
      ? "border-accent bg-accent text-white"
      : "border-black/40 bg-white text-main hover:border-accent hover:text-accent",
  ].join(" ");
</script>

<template>
  <div class="filter-rail mb-6 flex flex-col gap-4">
    <!-- Ranges -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label class="mb-1 block text-xs font-medium text-main">
          Warmmiete
        </label>
        <div class="flex items-center gap-1.5">
          <div class="relative min-w-0 flex-1">
            <input
              v-model="preferences.priceMin"
              type="number"
              inputmode="numeric"
              :class="rangeInputClass"
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
            class="shrink-0 text-main/40"
            aria-hidden="true"
            >–</span
          >
          <div class="relative min-w-0 flex-1">
            <input
              v-model="preferences.priceMax"
              type="number"
              inputmode="numeric"
              :class="rangeInputClass"
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
        <div class="mt-1.5 flex flex-wrap gap-1">
          <button
            v-for="p in pricePresets"
            :key="p.label"
            type="button"
            :class="
              presetClass(
                preferences.priceMin == null && preferences.priceMax === p.max,
              )
            "
            @click="applyPricePreset(p.max)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium text-main">Zimmer</label>
        <div class="flex items-center gap-1.5">
          <div class="relative min-w-0 flex-1">
            <input
              v-model="preferences.roomsMin"
              type="number"
              inputmode="numeric"
              :class="rangeInputClass"
              placeholder="ab"
              :min="filterMetadata.rooms.min"
              :max="filterMetadata.rooms.max"
              aria-label="Zimmer mindestens"
              @focus="onRangeFocus"
              @input="scheduleNumberCommit"
              @blur="onRangeBlur"
            />
            <span
              class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-main/40"
              aria-hidden="true"
              >Zi.</span
            >
          </div>
          <span
            class="shrink-0 text-main/40"
            aria-hidden="true"
            >–</span
          >
          <div class="relative min-w-0 flex-1">
            <input
              v-model="preferences.roomsMax"
              type="number"
              inputmode="numeric"
              :class="rangeInputClass"
              placeholder="bis"
              :min="filterMetadata.rooms.min"
              :max="filterMetadata.rooms.max"
              aria-label="Zimmer höchstens"
              @focus="onRangeFocus"
              @input="scheduleNumberCommit"
              @blur="onRangeBlur"
            />
            <span
              class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-main/40"
              aria-hidden="true"
              >Zi.</span
            >
          </div>
        </div>
        <div class="mt-1.5 flex flex-wrap gap-1">
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

      <div>
        <label class="mb-1 block text-xs font-medium text-main">Fläche</label>
        <div class="flex items-center gap-1.5">
          <div class="relative min-w-0 flex-1">
            <input
              v-model="preferences.areaMin"
              type="number"
              inputmode="numeric"
              :class="rangeInputClass"
              placeholder="ab"
              :min="filterMetadata.area.min"
              :max="filterMetadata.area.max"
              aria-label="Fläche mindestens"
              @focus="onRangeFocus"
              @input="scheduleNumberCommit"
              @blur="onRangeBlur"
            />
            <span
              class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-main/40"
              aria-hidden="true"
              >m²</span
            >
          </div>
          <span
            class="shrink-0 text-main/40"
            aria-hidden="true"
            >–</span
          >
          <div class="relative min-w-0 flex-1">
            <input
              v-model="preferences.areaMax"
              type="number"
              inputmode="numeric"
              :class="rangeInputClass"
              placeholder="bis"
              :min="filterMetadata.area.min"
              :max="filterMetadata.area.max"
              aria-label="Fläche höchstens"
              @focus="onRangeFocus"
              @input="scheduleNumberCommit"
              @blur="onRangeBlur"
            />
            <span
              class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-main/40"
              aria-hidden="true"
              >m²</span
            >
          </div>
        </div>
        <div class="mt-1.5 flex flex-wrap gap-1">
          <button
            v-for="p in areaPresets"
            :key="p.label"
            type="button"
            :class="
              presetClass(
                preferences.areaMin === p.min && preferences.areaMax == null,
              )
            "
            @click="applyAreaPreset(p.min)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bezirke -->
    <div>
      <div class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p class="text-xs font-medium text-main">Bezirke</p>
        <span class="text-xs text-main/45">{{ districtSummary }}</span>
        <div class="ml-auto flex items-center gap-2">
          <button
            type="button"
            class="text-xs text-main/55 underline-offset-2 hover:text-accent hover:underline disabled:opacity-30"
            :disabled="preferences.districts.length === districtEntries.length"
            @click="selectAllDistricts"
          >
            Alle
          </button>
          <button
            type="button"
            class="text-xs text-main/55 underline-offset-2 hover:text-accent hover:underline disabled:opacity-30"
            :disabled="preferences.districts.length === 0"
            @click="clearDistricts"
          >
            Keine
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="{ id, title, shortName } in districtEntries"
          :key="id"
          type="button"
          :title="title"
          :aria-label="title"
          :aria-pressed="preferences.districts.includes(id)"
          :class="chipClass(preferences.districts.includes(id))"
          @click="toggleChip(preferences.districts, id)"
        >
          {{ shortName }}
        </button>
      </div>
    </div>

    <!-- Verwaltungen -->
    <div>
      <p class="mb-2 text-xs font-medium text-main">Verwaltungen</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="{ id, title } in propertyManagementEntries"
          :key="id"
          type="button"
          :aria-pressed="preferences.propertyManagements.includes(id)"
          :class="chipClass(preferences.propertyManagements.includes(id))"
          @click="toggleChip(preferences.propertyManagements, id)"
        >
          {{ title }}
        </button>
      </div>
    </div>

    <!-- Merkmale -->
    <div>
      <p class="mb-2 text-xs font-medium text-main">Merkmale</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          :class="chipClass(onlyNew)"
          :aria-pressed="onlyNew"
          @click="
            onlyNew = !onlyNew;
            onOnlyNewChange();
          "
        >
          {{ tags.new }}
        </button>
        <button
          v-for="[id, title] in titleTagEntries"
          :key="id"
          type="button"
          :class="chipClass(preferences.tags.includes(id))"
          @click="toggleChip(preferences.tags, id)"
        >
          {{ title }}
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div
      class="flex flex-col gap-2 border-t border-black/15 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p
          v-if="resultLabel"
          class="text-sm font-medium text-main"
        >
          {{ resultLabel }}
        </p>
        <button
          v-if="activePrefsCount"
          type="button"
          class="text-sm text-main/55 underline-offset-2 hover:text-accent hover:underline"
          @click="resetFilters"
        >
          Zurücksetzen ({{ activePrefsCount }})
        </button>
      </div>

      <div
        v-if="telegramEnabled"
        class="flex flex-col gap-1 sm:items-end"
      >
        <button
          type="button"
          class="text-sm inline-flex items-center gap-1.5 self-start text-accent underline-offset-2 hover:underline disabled:opacity-60 sm:self-end"
          :disabled="telegramLoading"
          @click="notifyOnTelegram"
        >
          <Icon
            name="lucide:bell"
            class="size-3.5 shrink-0"
          />
          {{ telegramLoading ? "Link wird erstellt…" : "Benachrichtigen" }}
        </button>
        <p
          v-if="telegramError"
          class="text-xs text-red-600"
        >
          {{ telegramError }}
        </p>
      </div>
    </div>
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
  .filter-rail * {
    transition: none !important;
  }
}
</style>
