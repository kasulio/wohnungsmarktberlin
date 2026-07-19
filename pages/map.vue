<script setup lang="ts">
import { GoogleMap, Polygon } from "vue3-google-map";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "~/tailwind.config";
import { ringbahnCoordinates } from "~/data/coordinates";

const config = useRuntimeConfig();
const pageDescription =
  "Berliner Mietwohnungen auf der Karte – sieh auf einen Blick, wo günstige Wohnungen in deinem Wunschbezirk verfügbar sind.";
useSeoMeta({
  title: "Karte",
  description: pageDescription,
  ogTitle: "Wohnungskarte Berlin | WohnungsMarktBerlin",
  ogDescription: pageDescription,
  ogUrl: `${config.public.deploymentUrl}/map`,
  twitterTitle: "Wohnungskarte Berlin | WohnungsMarktBerlin",
  twitterDescription: pageDescription,
});
definePageMeta({
  pageTransition: {
    name: "rotate",
  },
});

const { theme } = resolveConfig(tailwindConfig);
const consent = useConsent();

const {
  flatsQuery,
  mapFlats,
  mapCenter,
  mapZoom,
  mapContainer,
  selectedFlat,
  isTouch,
  tooltipPos,
  isMarkerHighlighted,
  onMarkerClick,
  onMarkerMouseEnter,
  onMarkerMouseLeave,
  onMapMouseMove,
  dismissCard,
} = useMapFlats();

await flatsQuery;

const countText = computed(() => {
  const total = flatsQuery.data.value?.totalElementsCount ?? 0;
  const filtered = flatsQuery.data.value?.filteredElementsCount ?? 0;
  if (filtered === 0) {
    return "Keine Wohnungen";
  }
  if (filtered === total) {
    return `${total} Wohnungen`;
  }
  return `${filtered} von ${total} Wohnungen`;
});
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <div class="mb-4 md:mb-6">
      <h1 class="text-xl leading-tight text-main">
        {{ countText }}
      </h1>
    </div>
    <Filters
      :result-count="flatsQuery.data.value?.filteredElementsCount ?? null"
      :total-count="flatsQuery.data.value?.totalElementsCount ?? null"
      :show-bar-count="false"
    />
    <div
      ref="mapContainer"
      class="relative h-full min-h-[70vh] grow overflow-hidden rounded-xl bg-background"
      @mousemove="onMapMouseMove"
      @click.self="dismissCard"
    >
      <ClientOnly>
        <GoogleMap
          v-if="consent.state?.value?.maps"
          class="h-full w-full"
          :center="mapCenter"
          :zoom="mapZoom"
          :api-key="$config.public.googleMapsApiKey"
          :map-id="$config.public.googleMapsId"
        >
          <Polygon
            :options="{
              paths: ringbahnCoordinates,
              fillColor: theme.colors.accent,
              fillOpacity: 0,
              strokeColor: theme.colors.primary,
            }"
          />
          <MapFlatMarker
            v-for="flat in mapFlats"
            :key="flat.id"
            :flat="flat"
            :highlighted="isMarkerHighlighted(flat.id)"
            @click="(e) => onMarkerClick(flat, e)"
            @mouseenter="(e) => onMarkerMouseEnter(flat, e)"
            @mouseout="onMarkerMouseLeave"
          />
        </GoogleMap>
        <div
          v-else
          class="flex h-full w-full flex-col items-center justify-center gap-4 p-8"
        >
          <p class="text-center">
            Um die Karte zu sehen, musst du der Nutzung von Google Maps
            zustimmen.
          </p>
          <SimpleButton @click="consent.set({ maps: true })">
            Zustimmen
          </SimpleButton>
        </div>
      </ClientOnly>

      <MapFlatPreview
        v-if="selectedFlat && !isTouch"
        :flat="selectedFlat"
        variant="tooltip"
        :position="tooltipPos"
      />

      <MapFlatPreview
        v-if="selectedFlat && isTouch"
        :flat="selectedFlat"
        variant="card"
        @dismiss="dismissCard"
      />
    </div>
  </div>
</template>
