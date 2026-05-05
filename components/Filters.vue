<script setup lang="ts">
import { berlinDistricts } from "~/data/districts";
import { propertyManagementConfigs } from "~/data/propertyManagements/configs";
import { tags } from "~/data/tags";

const { updateQueryState, urlState } = useFlatFilterUrlState();
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
} as Record<
  "priceMin" | "priceMax" | "roomsMin" | "roomsMax" | "areaMin" | "areaMax",
  number | null
> &
  Record<"tags" | "districts" | "propertyManagements", string[]>);

interface Metadata {
  [key: string]: {
    min: number;
    max: number;
    unit: string;
  };
}

const activePrefsCount = computed(() => {
  return Object.keys(urlState.value).filter(
    (key) =>
      modalPreferences[key as keyof typeof modalPreferences] !== undefined,
  ).length;
});

const filterMetadata: Metadata = {
  price: { min: 100, max: 10000, unit: "€" },
  rooms: { min: 1, max: 10, unit: "Zimmer" },
  area: { min: 1, max: 1000, unit: "m²" },
};

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
  const filters: any[] = [];

  for (const [key, value] of Object.entries(modalPreferences)) {
    if (key === "tags") {
      for (const tag of value) {
        filters.push({ filter: tag, id: key, title: tags[tag] });
      }
      continue;
    }

    if (key === "districts") {
      for (const district of value) {
        filters.push({
          filter: district,
          id: key,
          title: berlinDistricts[district].name,
        });
      }
      continue;
    }

    if (key === "propertyManagements") {
      for (const slug of value) {
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

    if (value) {
      const filter = createFilter(
        value,
        getFilterMetadata(key)?.unit ?? "",
        getLimitByKeyName(key),
      );
      filters.push({ filter, id: key });
    }
  }

  return filters;
});

const applyFilters = () => {
  modalOpen.value = false;

  const query: Record<string, number | number[] | string[] | null | string> =
    {};

  for (const [key, value] of Object.entries(modalPreferences)) {
    if (Array.isArray(value)) {
      query[key] = value.length ? value : null;
      continue;
    }

    if (typeof value === "number" && filterMetadata[key]) {
      query[key] = Math.min(
        Math.max(value, filterMetadata[key].min),
        filterMetadata[key].max,
      );
    }

    query[key] = value ? [value].flat() : null;
  }

  updateQueryState(query);
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
          @click="
            () => {
              if (urlState[filterObj.id].length > 1) {
                updateQueryState({
                  [filterObj.id]: urlState[filterObj.id].filter(
                    (item) => item !== filterObj.filter,
                  ),
                });
                return;
              }
              updateQueryState({ [filterObj.id]: undefined });
            }
          "
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
