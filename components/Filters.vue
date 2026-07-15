<script setup lang="ts">
import { berlinDistricts } from "~/data/districts";
import { propertyManagementConfigs } from "~/data/propertyManagements/configs";
import { tags } from "~/data/tags";
import { type FlatFilter } from "~/lib/flat-filters";

const { updateQueryState, urlState } = useFlatFilterUrlState();
const { $client } = useNuxtApp();
const config = useRuntimeConfig();
const telegramEnabled = computed(() => !!config.public.telegramBotUsername);
const modalOpen = ref(false);

const modalPreferences = reactive({
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

type ModalPreferenceKey = keyof typeof modalPreferences;

const filterMetadata = {
  price: { min: 100, max: 10000, unit: "€" },
  rooms: { min: 1, max: 10, unit: "Zimmer" },
  area: { min: 1, max: 1000, unit: "m²" },
} as const;

const activePrefsCount = computed(() => {
  return Object.keys(urlState.value).filter(
    (key) => modalPreferences[key as ModalPreferenceKey] !== undefined,
  ).length;
});

watch(urlState, () => {
  syncStateWithUrl();
});

const syncStateWithUrl = () => {
  for (const key of typedObjectKeys(modalPreferences)) {
    if (key === "tags" || key === "districts" || key === "propertyManagements")
      modalPreferences[key] = urlState.value[key] ?? [];
    else modalPreferences[key] = urlState.value[key]?.[0] ?? null;
  }
};

syncStateWithUrl();

const getFilterMetadata = (key: string) => {
  for (const [metaKey, meta] of Object.entries(filterMetadata)) {
    if (key.startsWith(metaKey)) {
      return meta;
    }
  }
  return null;
};

type UiFilter = {
  filter: string;
  id: ModalPreferenceKey;
  title?: string;
};

const getLimitByKeyName = (keyName: string) => {
  if (keyName.toLowerCase().includes("min")) {
    return "≥";
  } else if (keyName.toLowerCase().includes("max")) {
    return "≤";
  } else {
    return "";
  }
};

const createFilter = (
  value: number | string,
  unit: string,
  lessOrMore: string,
) => {
  if (value) {
    return `${lessOrMore} ${value} ${unit}`;
  }
  return null;
};

const uiFilters = computed(() => {
  const filters: UiFilter[] = [];

  for (const key of typedObjectKeys(modalPreferences)) {
    if (key === "tags") {
      for (const tag of modalPreferences.tags) {
        filters.push({
          filter: tag,
          id: key,
          title: tags[tag as keyof typeof tags],
        });
      }
      continue;
    }

    if (key === "districts") {
      for (const district of modalPreferences.districts) {
        const districtData =
          berlinDistricts[district as keyof typeof berlinDistricts];
        filters.push({
          filter: district,
          id: key,
          title: districtData?.name ?? district,
        });
      }
      continue;
    }

    if (key === "propertyManagements") {
      for (const slug of modalPreferences.propertyManagements) {
        const cfg =
          propertyManagementConfigs[
            slug as keyof typeof propertyManagementConfigs
          ];
        filters.push({
          filter: slug,
          id: key,
          title: cfg?.name ?? slug,
        });
      }
      continue;
    }

    const value = modalPreferences[key];
    if (typeof value === "number") {
      const filter = createFilter(
        value,
        getFilterMetadata(key)?.unit ?? "",
        getLimitByKeyName(key),
      );
      if (filter) {
        filters.push({ filter, id: key });
      }
    }
  }

  return filters;
});

const removeFilter = (filterObj: UiFilter) => {
  const current = urlState.value[filterObj.id];
  if (Array.isArray(current) && current.length > 1) {
    updateQueryState({
      [filterObj.id]: current.filter((item) => item !== filterObj.filter),
    });
    return;
  }
  updateQueryState({ [filterObj.id]: undefined });
};

const telegramLoading = ref(false);
const telegramError = ref<string | null>(null);

const clampPreference = (key: string, value: number): number => {
  const meta = getFilterMetadata(key);
  return meta ? Math.min(Math.max(value, meta.min), meta.max) : value;
};

const applyFilters = () => {
  modalOpen.value = false;

  const query: Record<string, number | number[] | string[] | null | string> =
    {};

  for (const [key, value] of Object.entries(modalPreferences)) {
    if (Array.isArray(value)) {
      query[key] = value.length ? value : null;
      continue;
    }

    if (typeof value === "number") {
      query[key] = [clampPreference(key, value)];
      continue;
    }

    query[key] = null;
  }

  updateQueryState(query);
};

const buildFilter = (): FlatFilter => {
  const num = (key: ModalPreferenceKey, v: number | string | null) => {
    const n = typeof v === "number" ? v : Number(v);
    if (v == null || v === "" || !Number.isFinite(n)) return undefined;
    return clampPreference(key, n);
  };
  const arr = (v: string[]) => (v.length ? v : undefined);
  return {
    priceMin: num("priceMin", modalPreferences.priceMin),
    priceMax: num("priceMax", modalPreferences.priceMax),
    roomsMin: num("roomsMin", modalPreferences.roomsMin),
    roomsMax: num("roomsMax", modalPreferences.roomsMax),
    areaMin: num("areaMin", modalPreferences.areaMin),
    areaMax: num("areaMax", modalPreferences.areaMax),
    tags: arr(modalPreferences.tags),
    districts: arr(modalPreferences.districts),
    propertyManagements: arr(
      modalPreferences.propertyManagements,
    ) as FlatFilter["propertyManagements"],
  };
};

const notifyOnTelegram = async () => {
  telegramError.value = null;
  telegramLoading.value = true;
  // Open sync so the browser keeps the gesture; set URL after mint.
  const popup = window.open("about:blank", "_blank");
  try {
    const { url } =
      await $client.notification.createTelegramLink.mutate(buildFilter());
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
    // Only surface server messages we intentionally wrote for the user.
    telegramError.value =
      (code === "TOO_MANY_REQUESTS" || code === "PRECONDITION_FAILED") &&
      e instanceof Error
        ? e.message
        : "Konnte den Telegram-Link nicht erstellen.";
  } finally {
    telegramLoading.value = false;
  }
};

const tagsSuggestions = Object.entries(tags).map(([id, title]) => ({
  id,
  title,
}));
const districtSuggestions = Object.entries(berlinDistricts).map(
  ([id, { name }]) => ({
    id,
    title: name,
  }),
);
const propertyManagementSuggestions = Object.values(
  propertyManagementConfigs,
).map(({ slug, name }) => ({
  id: slug,
  title: name,
}));
</script>

<template>
  <div class="relative mb-4 flex gap-2 overflow-x-visible">
    <button
      class="text-nowrap rounded-xl border-2 border-accent px-4 py-2"
      @click="modalOpen = !modalOpen"
    >
      Filter ▼
    </button>
    <Modal
      :open="modalOpen"
      :on-close="() => (modalOpen = false)"
      class="absolute top-12 z-20 flex w-96 flex-col gap-4 rounded-xl border border-black bg-white p-4 shadow-xl"
    >
      <div>
        <strong>Preis (€)</strong>
        <div class="flex items-center justify-between gap-2">
          <input
            v-model="modalPreferences.priceMin"
            type="number"
            class="w-36 rounded-md border-2 border-accent px-4 py-2"
            :placeholder="'min. ' + filterMetadata.price.min.toLocaleString()"
            :min="filterMetadata.price.min"
            :max="filterMetadata.price.max"
          />
          <span>-</span>
          <input
            v-model="modalPreferences.priceMax"
            type="number"
            class="w-36 rounded-md border-2 border-accent px-4 py-2"
            :placeholder="'max. ' + filterMetadata.price.max.toLocaleString()"
            :min="filterMetadata.price.min"
            :max="filterMetadata.price.max"
          />
        </div>
      </div>
      <div>
        <strong>Zimmer</strong>
        <div class="flex items-center justify-between gap-2">
          <input
            v-model="modalPreferences.roomsMin"
            type="number"
            class="w-36 rounded-md border-2 border-accent px-4 py-2"
            :placeholder="'min. ' + filterMetadata.rooms.min.toLocaleString()"
            :min="filterMetadata.rooms.min"
            :max="filterMetadata.rooms.max"
          />
          <span>-</span>
          <input
            v-model="modalPreferences.roomsMax"
            type="number"
            class="w-36 rounded-md border-2 border-accent px-4 py-2"
            :placeholder="'max. ' + filterMetadata.rooms.max.toLocaleString()"
            :min="filterMetadata.rooms.min"
            :max="filterMetadata.rooms.max"
          />
        </div>
      </div>
      <div>
        <strong>Fläche (m²)</strong>
        <div class="flex items-center justify-between gap-2">
          <input
            v-model="modalPreferences.areaMin"
            type="number"
            class="w-36 rounded-md border-2 border-accent px-4 py-2"
            :placeholder="'min. ' + filterMetadata.area.min.toLocaleString()"
            :min="filterMetadata.area.min"
            :max="filterMetadata.area.max"
          />
          <span>-</span>
          <input
            v-model="modalPreferences.areaMax"
            type="number"
            class="w-36 rounded-md border-2 border-accent px-4 py-2"
            :placeholder="'max. ' + filterMetadata.area.max.toLocaleString()"
            :min="filterMetadata.area.min"
            :max="filterMetadata.area.max"
          />
        </div>
      </div>
      <div>
        <strong>Hausverwaltung</strong>
        <div class="flex items-center gap-2">
          <TextFieldWithAutocomplete
            v-model="modalPreferences.propertyManagements"
            :suggestions="propertyManagementSuggestions"
          />
        </div>
      </div>
      <div>
        <strong>Bezirk</strong>
        <div class="flex items-center gap-2">
          <TextFieldWithAutocomplete
            v-model="modalPreferences.districts"
            :suggestions="districtSuggestions"
          />
        </div>
      </div>
      <div>
        <strong>Tags</strong>
        <div class="flex items-center gap-2">
          <TextFieldWithAutocomplete
            v-model="modalPreferences.tags"
            :suggestions="tagsSuggestions"
          />
        </div>
      </div>
      <button
        class="rounded-md bg-accent px-4 py-2 text-m text-white"
        @click="applyFilters"
      >
        Anwenden
      </button>
      <template v-if="telegramEnabled">
        <button
          class="flex items-center justify-center gap-2 rounded-md border-2 border-accent px-4 py-2 text-m text-accent disabled:opacity-60"
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
              : "Auf Telegram benachrichtigen"
          }}
        </button>
        <p
          v-if="telegramError"
          class="text-sm text-red-600"
        >
          {{ telegramError }}
        </p>
      </template>
    </Modal>
    <div
      v-if="activePrefsCount"
      class="scrollbar-hide flex gap-2 overflow-y-scroll whitespace-nowrap"
    >
      <div
        v-for="filterObj in uiFilters"
        :key="filterObj.filter"
        class="flex items-center gap-2 text-nowrap rounded-full border-accent bg-secondary px-4 py-2"
      >
        {{ filterObj.title ?? filterObj.filter }}
        <span
          class="cursor-pointer text-accent"
          @click="removeFilter(filterObj)"
          >x</span
        >
      </div>
    </div>
  </div>
</template>
<style scoped>
/* For Webkit-based browsers (Chrome, Safari and Opera) */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* For IE, Edge and Firefox */
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
